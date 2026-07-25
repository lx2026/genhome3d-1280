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
python3 - "$repo_root" "$site_output" <<'PY'
import json
import shutil
import sys
from pathlib import Path

repo_root, site_output = Path(sys.argv[1]), Path(sys.argv[2])
document = json.loads((repo_root / "benchmarks.json").read_text(encoding="utf-8"))
for bench in document.get("benches", []):
    for entry in bench["entries"]:
        source = repo_root / entry["usdz"]
        destination = site_output / entry["usdz"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        print(f"bench package {entry['usdz']}")
PY
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

printf 'Built landing page at %s\n' "$site_output"
