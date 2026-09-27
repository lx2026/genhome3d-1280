#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
site_output="$repo_root/_site"

rm -rf "$site_output"
mkdir -p "$site_output"
cp -R "$repo_root/site/." "$site_output/"
cp "$repo_root/catalog.json" "$site_output/catalog.json"
cp "$repo_root/benchmarks.json" "$site_output/benchmarks.json"
cp -R "$repo_root/previews" "$site_output/previews"
cp -R "$repo_root/references" "$site_output/references"
# USDZ downloads live on the repository's existing raw-content host. Keeping
# packages out of Pages avoids its 1 GB published-site limit as model runs grow.
cp -R "$repo_root/reports" "$site_output/reports"
if [[ "${1:-}" == "--local-assets" ]]; then
  # Local verification needs the unpublished candidate packages. This switch is
  # never used by the deployment workflow and creates no published symlinks.
  ln -s "$repo_root/assets" "$site_output/assets"
  python3 - "$site_output" <<'PY_LOCAL'
import json
import sys
from pathlib import Path
site = Path(sys.argv[1])
for filename, collection in (("catalog.json", "assets"), ("benchmarks.json", "benches")):
    path = site / filename
    document = json.loads(path.read_text())
    entries = document[collection] if collection == "assets" else [entry for bench in document[collection] for entry in bench["entries"]]
    for entry in entries:
        entry["download_url"] = "./" + entry["usdz"]
    path.write_text(json.dumps(document, separators=(",", ":")) + "\n")
PY_LOCAL
elif [[ $# -gt 0 ]]; then
  printf 'Unknown build option: %s\n' "$1" >&2
  exit 2
fi
mkdir -p "$site_output/vendor/addons/controls"
mkdir -p "$site_output/vendor/addons/environments"
mkdir -p "$site_output/vendor/addons/loaders"
mkdir -p "$site_output/vendor/addons/libs"
cp "$repo_root/node_modules/three/build/three.module.js" "$site_output/vendor/three.module.js"
cp "$repo_root/node_modules/three/build/three.core.js" "$site_output/vendor/three.core.js"
cp "$repo_root/node_modules/three/examples/jsm/controls/OrbitControls.js" "$site_output/vendor/addons/controls/OrbitControls.js"
cp "$repo_root/node_modules/three/examples/jsm/environments/RoomEnvironment.js" "$site_output/vendor/addons/environments/RoomEnvironment.js"
cp "$repo_root/node_modules/three/examples/jsm/loaders/USDLoader.js" "$site_output/vendor/addons/loaders/USDLoader.js"
cp -R "$repo_root/node_modules/three/examples/jsm/loaders/usd" "$site_output/vendor/addons/loaders/usd"
cp "$repo_root/node_modules/three/examples/jsm/libs/fflate.module.js" "$site_output/vendor/addons/libs/fflate.module.js"
touch "$site_output/.nojekyll"

python3 - "$site_output" <<'PY_SIZE'
import sys
from pathlib import Path
site = Path(sys.argv[1])
size = sum(path.stat().st_size for path in site.rglob("*") if path.is_file())
# Leave headroom below GitHub Pages' 1 GB published-site limit.
if size >= 900 * 1024 * 1024:
    raise SystemExit(f"Pages artifact exceeds the 900 MiB release budget: {size:,} bytes")
print(f"Built landing page at {site} ({size:,} bytes; USDZ fetched on demand)")
PY_SIZE
