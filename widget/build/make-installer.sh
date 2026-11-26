#!/usr/bin/env bash
# Build the Windows installer: dist/TreeWidget-Setup-<version>.exe
#  1) electron-builder packs the app into dist/win-unpacked (afterPack sets the icon)
#  2) NSIS (makensis) wraps it into an installer — no Wine needed
# Requires NSIS: apt install nsis | brew install makensis | https://nsis.sourceforge.io (Windows, run from Git Bash)
set -euo pipefail
cd "$(dirname "$0")/.."

MAKENSIS="${MAKENSIS:-$(command -v makensis || true)}"
if [ -z "$MAKENSIS" ]; then
  echo "makensis not found. Install NSIS (apt install nsis / brew install makensis) or set MAKENSIS=/path/to/makensis." >&2
  exit 1
fi

VERSION=$(node -p "require('./package.json').version")
npx electron-builder --win dir --x64

SRC="$(pwd)/dist/win-unpacked"
OUT="$(pwd)/dist/TreeWidget-Setup-${VERSION}.exe"
SIZE_KB=$(du -sk "$SRC" | cut -f1)
(cd build && "$MAKENSIS" -INPUTCHARSET UTF8 -V2 \
  -X"!addplugindir /x86-unicode \"$(pwd)/nsis-plugins/x86-unicode\"" \
  -DVERSION="$VERSION" -DSRC="$SRC" -DOUT="$OUT" -DSIZE_KB="$SIZE_KB" installer.nsi)
ls -la "$OUT"
