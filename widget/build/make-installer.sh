#!/usr/bin/env bash
# Windows 설치 파일 만들기 (리눅스·맥에서도 wine 없이)
#  1) electron-builder 로 dist/win-unpacked 만들기 (afterPack 이 아이콘 넣음)
#  2) NSIS(makensis) 로 dist/TreeWidget-Setup-버전.exe 만들기
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
npx electron-builder --win dir --x64

NSIS_DIR=$(ls -d "${HOME}"/.cache/electron-builder/nsis-3.*/nsis-3.* 2>/dev/null | head -1 || true)
RES_DIR=$(ls -d "${HOME}"/.cache/electron-builder/nsis-resources-*/nsis-resources-* 2>/dev/null | head -1 || true)
MAKENSIS="${MAKENSIS:-}"
if [ -z "$MAKENSIS" ]; then
  if command -v makensis >/dev/null; then MAKENSIS=makensis
  elif [ -n "$NSIS_DIR" ]; then
    case "$(uname)" in Darwin) MAKENSIS="$NSIS_DIR/mac/makensis" ;; *) MAKENSIS="$NSIS_DIR/linux/makensis" ;; esac
    export NSISDIR="$NSIS_DIR"
  else
    echo "makensis 가 없어요. 'npx electron-builder --win nsis' 를 한 번 실행해 NSIS 를 받거나 NSIS 를 설치해 주세요." >&2; exit 1
  fi
fi
[ -n "$RES_DIR" ] || { echo "WinShell 플러그인이 없어요 (electron-builder nsis-resources)." >&2; exit 1; }

SRC="$(pwd)/dist/win-unpacked"
OUT="$(pwd)/dist/TreeWidget-Setup-${VERSION}.exe"
SIZE_KB=$(du -sk "$SRC" | cut -f1)
chmod +x "$MAKENSIS" 2>/dev/null || true
(cd build && "$MAKENSIS" -INPUTCHARSET UTF8 -V2 \
  -X"!addplugindir /x86-unicode \"$RES_DIR/plugins/x86-unicode\"" \
  -DVERSION="$VERSION" -DSRC="$SRC" -DOUT="$OUT" -DSIZE_KB="$SIZE_KB" installer.nsi)
ls -la "$OUT"
