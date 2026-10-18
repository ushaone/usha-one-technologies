#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
curl -fsSL https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js -o dist/xlsx.full.min.js
printf '%s\n' 'cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41  dist/xlsx.full.min.js' | sha256sum -c -
if [ ! -f dist/logo.png ]; then
 cp ../ASSETS/logo/usha-one-full-logo-blue-bg.png dist/logo.png
fi
