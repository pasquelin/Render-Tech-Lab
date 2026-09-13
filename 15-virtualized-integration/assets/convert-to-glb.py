import argparse
import pathlib
import sys

import bpy


def import_file(path: pathlib.Path) -> None:
    suffix = path.suffix.lower()
    if suffix == '.fbx':
        bpy.ops.import_scene.fbx(filepath=str(path), use_image_search=True)
    elif suffix == '.obj':
        bpy.ops.wm.obj_import(filepath=str(path))
    else:
        raise ValueError(f'Unsupported source format: {path}')


def main() -> None:
    parser = argparse.ArgumentParser(description='Convert one OBJ/FBX source or an FBX collection to a static GLB.')
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--collection', action='store_true', help='Import each top-level FBX from the source directory.')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

    source = pathlib.Path(args.input).resolve()
    output = pathlib.Path(args.output).resolve()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    inputs = sorted(source.glob('*.fbx')) if args.collection else [source]
    if not inputs:
        raise ValueError(f'No FBX source found in {source}')
    for item in inputs:
        import_file(item)

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format='GLB',
        export_yup=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_materials='EXPORT',
        export_image_format='AUTO',
    )


if __name__ == '__main__':
    main()
