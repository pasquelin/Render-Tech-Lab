"""Run with Blender --background --factory-startup --python this.py -- --source ... --output ... --archive ...
CPU-only FBX import / glTF export. No decimation, texture resizing or rendering.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
from datetime import datetime, timezone
import bpy
import numpy as np
from mathutils import Vector


def sha256(p):
    h = hashlib.sha256()
    with Path(p).open('rb') as source:
        for block in iter(lambda: source.read(8 * 1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def map_orca_materials():
    """Apply the packing and DirectX-normal conventions from the source README."""
    normal_cache = {}
    mapped = []
    group = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    group.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    for material in bpy.data.materials:
        if not material.node_tree or material.users == 0:
            continue
        tree = material.node_tree
        shader = next((n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not shader:
            continue
        record = {'material': material.name, 'orm': None, 'normal': None}
        for node in list(tree.nodes):
            if node.type != 'TEX_IMAGE' or not node.image:
                continue
            file = Path(bpy.path.abspath(node.image.filepath))
            if file.stem.endswith('_Specular'):
                node.image.colorspace_settings.name = 'Non-Color'
                for link in list(tree.links):
                    if link.from_node == node:
                        tree.links.remove(link)
                separate = tree.nodes.new('ShaderNodeSeparateColor')
                separate.mode = 'RGB'
                tree.links.new(node.outputs['Color'], separate.inputs['Color'])
                tree.links.new(separate.outputs['Green'], shader.inputs['Roughness'])
                tree.links.new(separate.outputs['Blue'], shader.inputs['Metallic'])
                shader.inputs['Specular IOR Level'].default_value = 0.5
                gltf_node = tree.nodes.new('ShaderNodeGroup')
                gltf_node.node_tree = group
                tree.links.new(separate.outputs['Red'], gltf_node.inputs['Occlusion'])
                record['orm'] = file.name
            elif file.stem.endswith('_Normal'):
                key = str(file)
                if key not in normal_cache:
                    image = node.image
                    image.colorspace_settings.name = 'Non-Color'
                    width, height = image.size
                    if width == 0 or height == 0:
                        raise RuntimeError('Cannot decode normal image: ' + key)
                    pixels = np.empty(width * height * 4, dtype=np.float32)
                    image.pixels.foreach_get(pixels)
                    pixels[1::4] = 1.0 - pixels[1::4]
                    converted = bpy.data.images.new(image.name + '_glTF_OpenGL', width=width, height=height, alpha=True)
                    converted.colorspace_settings.name = 'Non-Color'
                    converted.pixels.foreach_set(pixels)
                    converted.update()
                    normal_cache[key] = converted
                node.image = normal_cache[key]
                record['normal'] = file.name
        mapped.append(record)
    return mapped


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--archive', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    source, output, archive = map(lambda s: Path(s).resolve(), [args.source, args.output, args.archive])
    if 'exterior' not in source.name.lower() or source.suffix.lower() != '.fbx':
        raise ValueError('Only the exterior FBX is supported by this fixture recipe')
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for material in list(bpy.data.materials):
        if material.users == 0:
            bpy.data.materials.remove(material)
    imported = bpy.ops.import_scene.fbx(filepath=str(source), use_image_search=True)
    if imported != {'FINISHED'}:
        raise RuntimeError('FBX import failed')
    # The benchmark fixture is explicitly static; both A/B variants load this same pose.
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if not objects:
        raise RuntimeError('No mesh objects imported')
    meshes = {obj.data.as_pointer(): obj.data for obj in objects}
    for mesh in meshes.values():
        mesh.calc_loop_triangles()
    triangle_count = sum(len(obj.data.loop_triangles) for obj in objects)
    corners = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    # glTF export_yup uses Blender (x,y,z) -> glTF (x,z,-y).
    gltf_corners = [(v.x, v.z, -v.y) for v in corners]
    bounds = {'min': [min(v[i] for v in gltf_corners) for i in range(3)],
              'max': [max(v[i] for v in gltf_corners) for i in range(3)]}
    if not all(math.isfinite(x) for x in bounds['min'] + bounds['max']):
        raise RuntimeError('Non-finite imported bounds')
    images = []
    missing = []
    for image in bpy.data.images:
        if image.name == 'Render Result':
            continue
        p = Path(bpy.path.abspath(image.filepath)) if image.filepath else None
        record = {'name': image.name, 'path': image.filepath, 'size': list(image.size),
                  'source': image.source, 'packed': bool(image.packed_file)}
        if p and p.is_file():
            record.update(bytes=p.stat().st_size, sha256=sha256(p))
        elif image.source == 'FILE' and not image.packed_file:
            missing.append(image.filepath)
        images.append(record)
    if missing:
        raise RuntimeError('Missing texture files: ' + repr(missing))
    material_mapping = map_orca_materials()
    import_stats = {'materialMapping': material_mapping, 'meshObjects': len(objects), 'uniqueMeshes': len(meshes),
                    'trianglesAcrossMeshObjects': triangle_count,
                    'trianglesUniqueMeshes': sum(len(m.loop_triangles) for m in meshes.values()),
                    'verticesUniqueMeshes': sum(len(m.vertices) for m in meshes.values()),
                    'materials': len(bpy.data.materials), 'images': images,
                    'actions': len(bpy.data.actions), 'actionNames': [a.name for a in bpy.data.actions], 'gltfBoundsFromImportedObjects': bounds,
                    'blenderSceneUnitScale': bpy.context.scene.unit_settings.scale_length,
                    'blenderSceneUnitSystem': bpy.context.scene.unit_settings.system}
    # Write import facts before export, so a failed export leaves useful diagnostics.
    (output.parent / 'import-stats.json').write_text(json.dumps(import_stats, indent=2) + '\n')
    print('BISTRO_IMPORT_STATS', json.dumps({k:v for k,v in import_stats.items() if k not in ['images', 'materialMapping']}), flush=True)
    result = bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB',
        export_image_format='AUTO', export_texcoords=True, export_normals=True,
        export_tangents=True, export_materials='EXPORT', export_yup=True,
        export_apply=False, export_animations=False, export_cameras=False,
        export_lights=False, export_gpu_instances=False,
        export_copyright='Amazon Lumberyard Bistro, ORCA, CC BY 4.0. Converted to glTF for Render Tech Lab.')
    if result != {'FINISHED'}:
        raise RuntimeError('glTF export failed')
    with output.open('rb') as f:
        magic, version, total = struct.unpack('<4sII', f.read(12))
        length, kind = struct.unpack('<I4s', f.read(8))
        if magic != b'glTF' or version != 2 or kind != b'JSON' or total != output.stat().st_size:
            raise RuntimeError('Invalid GLB header')
        gltf = json.loads(f.read(length))
    def mesh_triangles(mesh):
        total = 0
        for primitive in mesh['primitives']:
            if primitive.get('mode', 4) != 4:
                raise RuntimeError('Non-triangle primitive')
            accessor = primitive.get('indices', primitive['attributes']['POSITION'])
            total += gltf['accessors'][accessor]['count'] // 3
        return total
    gltf_mesh_counts = [mesh_triangles(mesh) for mesh in gltf.get('meshes', [])]
    output_triangles = sum(gltf_mesh_counts[node['mesh']] for node in gltf.get('nodes', []) if 'mesh' in node)
    if output_triangles != triangle_count:
        raise RuntimeError(f'Triangle count changed: {triangle_count} -> {output_triangles}')
    if any('uri' in image for image in gltf.get('images', [])):
        raise RuntimeError('Texture is not embedded in GLB')
    manifest = {'asset': 'Amazon Lumberyard Bistro exterior', 'createdAt': datetime.now(timezone.utc).isoformat(),
        'source': {'page': 'https://developer.nvidia.com/orca/amazon-lumberyard-bistro',
                   'download': 'https://developer.nvidia.com/bistro', 'archiveName': archive.name,
                   'archiveBytes': archive.stat().st_size, 'archiveSha256': sha256(archive),
                   'fbxName': source.name, 'fbxBytes': source.stat().st_size, 'fbxSha256': sha256(source),
                   'publishedExteriorTriangles': 2832120},
        'license': {'name': 'CC BY 4.0', 'url': 'https://creativecommons.org/licenses/by/4.0/',
                    'credit': 'Amazon Lumberyard Bistro, Open Research Content Archive (ORCA), Amazon Lumberyard, 2017'},
        'conversion': {'blender': bpy.app.version_string, 'scriptSha256': sha256(__file__),
                       'staticFixture': True, 'frame': 1, 'animationsExported': False,
                       'animationNote': 'Source includes wind animations. This benchmark freezes frame 1 identically for A and B; it does not benchmark animation.',
                       'geometryDecimation': False, 'textureResize': False, 'renderExecuted': False,
                       'upAxis': 'Y', 'imageEncoding': 'AUTO: preserve supported original formats; other formats encoded as PNG',
                       'materialNote': 'Source README packing applied: Specular R=occlusion G=roughness B=metalness; DirectX normal green inverted at original resolution. FBX base color/alpha/emissive retained. No claim of pixel parity with Falcor.'},
        'import': import_stats,
        'output': {'url': '/benchmark-assets/bistro/' + output.name, 'file': output.name,
                   'bytes': output.stat().st_size, 'sha256': sha256(output),
                   'trianglesAcrossNodes': output_triangles, 'trianglesUniqueMeshes': sum(gltf_mesh_counts),
                   'meshes': len(gltf.get('meshes', [])), 'meshNodes': sum('mesh' in n for n in gltf.get('nodes', [])),
                   'materials': len(gltf.get('materials', [])), 'images': len(gltf.get('images', [])),
                   'animations': len(gltf.get('animations', [])), 'bounds': bounds,
                   'extensionsUsed': gltf.get('extensionsUsed', []), 'extensionsRequired': gltf.get('extensionsRequired', [])}}
    (output.parent / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print('BISTRO_OUTPUT', json.dumps(manifest['output']), flush=True)

if __name__ == '__main__':
    main()
