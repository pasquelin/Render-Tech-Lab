"""Read GLB metadata and embedded PNG dimensions without decoding textures or rendering."""
import argparse
from collections import Counter
import json
from pathlib import Path
import struct

p = argparse.ArgumentParser()
p.add_argument('glb', type=Path)
a = p.parse_args()
with a.glb.open('rb') as stream:
    magic, version, total = struct.unpack('<4sII', stream.read(12))
    length, kind = struct.unpack('<I4s', stream.read(8))
    assert magic == b'glTF' and version == 2 and kind == b'JSON'
    assert total == a.glb.stat().st_size
    doc = json.loads(stream.read(length))
    bin_length, bin_kind = struct.unpack('<I4s', stream.read(8))
    assert bin_kind == b'BIN\0'
    binary_start = stream.tell()
    dimensions = []
    for image in doc.get('images', []):
        assert 'uri' not in image, 'external texture'
        view = doc['bufferViews'][image['bufferView']]
        stream.seek(binary_start + view.get('byteOffset', 0))
        header = stream.read(24)
        assert header[:8] == b'\x89PNG\r\n\x1a\n', 'unexpected image encoding'
        width, height = struct.unpack('>II', header[16:24])
        dimensions.append((width, height))
    mesh_triangles = []
    for mesh in doc['meshes']:
        triangles = 0
        for primitive in mesh['primitives']:
            assert primitive.get('mode', 4) == 4
            accessor = primitive.get('indices', primitive['attributes']['POSITION'])
            assert doc['accessors'][accessor]['count'] % 3 == 0
            triangles += doc['accessors'][accessor]['count'] // 3
        mesh_triangles.append(triangles)
    print(json.dumps({
        'file': str(a.glb), 'bytes': total,
        'trianglesAcrossNodes': sum(mesh_triangles[n['mesh']] for n in doc['nodes'] if 'mesh' in n),
        'meshes': len(mesh_triangles), 'materials': len(doc.get('materials', [])),
        'alphaModes': dict(Counter(m.get('alphaMode', 'OPAQUE') for m in doc.get('materials', []))),
        'doubleSidedMaterials': sum(m.get('doubleSided', False) for m in doc.get('materials', [])),
        'animations': len(doc.get('animations', [])), 'skins': len(doc.get('skins', [])),
        'images': len(dimensions), 'embeddedPngDimensions': {
            f'{w}x{h}': count for (w, h), count in sorted(Counter(dimensions).items())},
        'decodedRgbaBytesWithoutMipmaps': sum(w * h * 4 for w, h in dimensions),
        'samplers': doc.get('samplers', []), 'extensionsUsed': doc.get('extensionsUsed', []),
    }, indent=2))
