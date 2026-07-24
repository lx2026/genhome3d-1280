#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
site_output="$repo_root/_site"

rm -rf "$site_output"
mkdir -p "$site_output"
cp -R "$repo_root/site/." "$site_output/"
cp "$repo_root/catalog.json" "$site_output/catalog.json"
cp -R "$repo_root/previews" "$site_output/previews"
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
