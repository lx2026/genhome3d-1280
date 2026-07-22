#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
site_output="$repo_root/_site"

rm -rf "$site_output"
mkdir -p "$site_output"
cp -R "$repo_root/site/." "$site_output/"
cp "$repo_root/catalog.json" "$site_output/catalog.json"
cp -R "$repo_root/previews" "$site_output/previews"
touch "$site_output/.nojekyll"

printf 'Built landing page at %s\n' "$site_output"
