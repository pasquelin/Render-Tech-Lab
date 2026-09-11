"""Mark provably opaque GLB materials OPAQUE, preserving the binary chunk exactly.

Requires Pillow. This corrects FBX import material flags for the shared fixture;
it is not a benchmark optimization or a claim of parity with the source renderer.
"""
import argparse
from collections import Counter
import hashlib
import io
import json
import os
from pathlib import Path
import struct
import tempfile
from datetime import datetime, timezone
from PIL import Image, __version__ as pillow_version


def digest_file(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('glb', type=Path)
    parser.add_argument('--manifest', type=Path)
    args = parser.parse_args()
    manifest_path = args.manifest or args.glb.parent / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    before_hash = digest_file(args.glb)
    if manifest['output']['sha256'] != before_hash:
        raise ValueError('Manifest and current GLB disagree')
    with args.glb.open('rb') as stream:
        magic, version, total = struct.unpack('<4sII', stream.read(12))
        length, kind = struct.unpack('<I4s', stream.read(8))
        if magic != b'glTF' or version != 2 or kind != b'JSON' or total != args.glb.stat().st_size:
            raise ValueError('Invalid GLB')
        doc = json.loads(stream.read(length))
        if any('COLOR_0' in primitive.get('attributes', {})
               for mesh in doc.get('meshes', []) for primitive in mesh.get('primitives', [])):
            raise ValueError('Vertex colors need a separate alpha proof; this fixture has none')
        bin_length, bin_kind = struct.unpack('<I4s', stream.read(8))
        binary_start = stream.tell()
        if bin_kind != b'BIN\0' or binary_start + bin_length != total:
            raise ValueError('Expected one final binary chunk')
        alpha_cache, decisions = {}, []
        before_modes = Counter(m.get('alphaMode', 'OPAQUE') for m in doc.get('materials', []))
        for index, material in enumerate(doc.get('materials', [])):
            if material.get('alphaMode') != 'BLEND':
                continue
            pbr = material.get('pbrMetallicRoughness', {})
            factor = pbr.get('baseColorFactor', [1, 1, 1, 1])[3]
            image_index, extrema = None, (255, 255)
            if 'baseColorTexture' in pbr:
                texture = doc['textures'][pbr['baseColorTexture']['index']]
                # An alternate compressed image source would require its own proof.
                if texture.get('extensions') or 'source' not in texture:
                    continue
                image_index = texture['source']
                if image_index not in alpha_cache:
                    image = doc['images'][image_index]
                    if 'uri' in image or image.get('mimeType') != 'image/png':
                        raise ValueError('Expected embedded PNG base color image')
                    view = doc['bufferViews'][image['bufferView']]
                    if view.get('buffer', 0) != 0:
                        raise ValueError('External buffer')
                    stream.seek(binary_start + view.get('byteOffset', 0))
                    png = stream.read(view['byteLength'])
                    with Image.open(io.BytesIO(png)) as decoded:
                        extrema = decoded.convert('RGBA').getchannel('A').getextrema()
                    alpha_cache[image_index] = extrema
                extrema = alpha_cache[image_index]
            opaque = factor == 1 and extrema == (255, 255)
            decisions.append({'material': index, 'name': material.get('name'),
                              'baseColorImage': image_index, 'factorAlpha': factor,
                              'textureAlphaExtrema': list(extrema), 'changedToOpaque': opaque})
            if opaque:
                material['alphaMode'] = 'OPAQUE'
        # Preserve all other JSON fields and copy the binary chunk without decoding/re-encoding.
        encoded = json.dumps(doc, separators=(',', ':'), ensure_ascii=True).encode('utf-8')
        encoded += b' ' * (-len(encoded) % 4)
        binary_hash = hashlib.sha256()
        with tempfile.NamedTemporaryFile(dir=args.glb.parent, suffix='.glb.partial', delete=False) as dest:
            temporary = Path(dest.name)
            try:
                dest.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(encoded) + 8 + bin_length))
                dest.write(struct.pack('<I4s', len(encoded), b'JSON'))
                dest.write(encoded)
                dest.write(struct.pack('<I4s', bin_length, b'BIN\0'))
                stream.seek(binary_start)
                remaining = bin_length
                while remaining:
                    block = stream.read(min(8 * 1024 * 1024, remaining))
                    if not block:
                        raise ValueError('Truncated binary chunk')
                    dest.write(block)
                    binary_hash.update(block)
                    remaining -= len(block)
            except BaseException:
                temporary.unlink(missing_ok=True)
                raise
        # Re-read the new binary bytes and require an exact digest before replacing the file.
        copied_hash = hashlib.sha256()
        with temporary.open('rb') as candidate:
            candidate.seek(12 + 8 + len(encoded) + 8)
            for block in iter(lambda: candidate.read(8 * 1024 * 1024), b''):
                copied_hash.update(block)
        if copied_hash.digest() != binary_hash.digest():
            temporary.unlink()
            raise ValueError('Binary chunk changed')
    os.replace(temporary, args.glb)
    result = {'performedAt': datetime.now(timezone.utc).isoformat(),
              'scriptSha256': digest_file(__file__), 'pillowVersion': pillow_version,
              'beforeGlbSha256': before_hash, 'afterGlbSha256': digest_file(args.glb),
              'binaryChunkSha256BeforeAndAfter': binary_hash.hexdigest(),
              'binaryChunkBytes': bin_length, 'geometryAndTextureBinaryUnchanged': True,
              'doubleSidedUnchanged': True, 'beforeAlphaModes': dict(before_modes),
              'afterAlphaModes': dict(Counter(m.get('alphaMode', 'OPAQUE') for m in doc['materials'])),
              'decisions': decisions}
    previous = manifest['conversion'].get('opaqueMaterialNormalization')
    if previous:
        manifest['conversion'].setdefault('opaqueMaterialNormalizationHistory', []).append(previous)
    manifest['conversion']['opaqueMaterialNormalization'] = result
    manifest['output']['sha256'] = result['afterGlbSha256']
    manifest['output']['bytes'] = args.glb.stat().st_size
    manifest['output']['alphaModes'] = result['afterAlphaModes']
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k != 'decisions'}, indent=2))


if __name__ == '__main__':
    main()
