#!/usr/bin/env bash
# Download and convert the licensed exterior fixture. No rendering or benchmark.
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
bistro_cache="${BISTRO_CACHE:-${TMPDIR:-/tmp}/render-bistro-source}"
blender_binary="${BLENDER_BIN:-/Applications/Blender.app/Contents/MacOS/Blender}"
mkdir -p "$bistro_cache"
archive="$bistro_cache/Bistro_v5_2.zip"
if [[ ! -f "$archive" ]]; then
  curl --fail --location --retry 3 --output "$archive.partial" https://developer.nvidia.com/bistro
  mv "$archive.partial" "$archive"
fi
python3 - "$archive" <<'PY'
import hashlib, sys
h = hashlib.sha256()
with open(sys.argv[1], 'rb') as stream:
    for block in iter(lambda: stream.read(8 * 1024 * 1024), b''):
        h.update(block)
digest = h.hexdigest()
expected = '0d50e3c724c6c5da19f8eb99ad3f53e36fec37ffa2df9621f9ccf0603f3934e1'
if digest != expected:
    raise SystemExit('Bistro archive differs from the documented fixture: ' + digest)
PY
python3 "$repo_root/14-open-world/assets-tools/extract_bistro.py" "$archive" "$bistro_cache/extracted"
source_dir="$bistro_cache/extracted/Bistro_v5_2"
output_dir="$repo_root/public/benchmark-assets/bistro"
mkdir -p "$output_dir"
"$blender_binary" --background --factory-startup \
  --python "$repo_root/14-open-world/assets-tools/convert_bistro.py" -- \
  --source "$source_dir/BistroExterior.fbx" \
  --output "$output_dir/bistro-exterior.glb" --archive "$archive"
python3 "$repo_root/14-open-world/assets-tools/normalize_opaque_materials.py" "$output_dir/bistro-exterior.glb"
cp "$source_dir/LICENSE.txt" "$output_dir/BISTRO-LICENSE.txt"
cp "$source_dir/README.txt" "$output_dir/BISTRO-SOURCE-README.txt"
python3 "$repo_root/14-open-world/assets-tools/inspect_glb.py" "$output_dir/bistro-exterior.glb" > "$output_dir/validation.json"
