"""Inspect all ZIP paths, then extract exterior FBX, shared textures and notices only."""
import argparse
import json
from pathlib import Path, PurePosixPath
import shutil
import stat
import zipfile

p = argparse.ArgumentParser()
p.add_argument('archive', type=Path)
p.add_argument('destination', type=Path)
a = p.parse_args()
root = a.destination.resolve()
with zipfile.ZipFile(a.archive) as z:
    entries = z.infolist()
    for info in entries:
        name = PurePosixPath(info.filename)
        if name.is_absolute() or '..' in name.parts or '\\' in info.filename or ':' in info.filename:
            raise ValueError('Unsafe archive path: ' + info.filename)
        mode = info.external_attr >> 16
        if stat.S_ISLNK(mode):
            raise ValueError('Archive symlink refused: ' + info.filename)
    if sum(i.file_size for i in entries) > 10 * 1024**3:
        raise ValueError('Unexpected expanded archive size')
    selected = [i for i in entries if i.filename.startswith('Bistro_v5_2/Textures/') or i.filename in {
        'Bistro_v5_2/BistroExterior.fbx', 'Bistro_v5_2/BistroExterior.pyscene',
        'Bistro_v5_2/LICENSE.txt', 'Bistro_v5_2/README.txt', 'Bistro_v5_2/CHANGELOG.txt'}]
    print(json.dumps({'archiveEntries': len(entries), 'selectedEntries': len(selected),
                      'selectedBytes': sum(i.file_size for i in selected)}, indent=2), flush=True)
    for info in selected:
        target = root.joinpath(*PurePosixPath(info.filename).parts)
        if not target.resolve().is_relative_to(root):
            raise ValueError('Resolved path escapes destination')
        if info.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.is_symlink():
                raise ValueError('Existing target symlink refused')
            with z.open(info) as src, target.open('wb') as dest:
                shutil.copyfileobj(src, dest)
