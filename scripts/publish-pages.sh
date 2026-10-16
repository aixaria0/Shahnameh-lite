#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
TARGET="https://github.com/aixaria0/aixaria0.github.io.git"
SUBDIR="${PAGES_SUBDIR:-shahnameh-lite}"
BASE_PATH="/${SUBDIR}"
cd "$ROOT"
NEXT_PUBLIC_BASE_PATH="$BASE_PATH" npm run build
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
git clone --quiet --single-branch --branch gh-pages "$TARGET" "$TMP/publish"
rm -rf "$TMP/publish/$SUBDIR"
mkdir -p "$TMP/publish/$SUBDIR"
cp -a dist/. "$TMP/publish/$SUBDIR/"
cd "$TMP/publish"
git config user.name 'Shahnameh Publisher'
git config user.email 'actions@users.noreply.github.com'
git add "$SUBDIR"
if git diff --cached --quiet; then echo 'Published site is already current.'; exit 0; fi
git commit -m "publish: Shahnameh ${SUBDIR} $(date -u +%Y-%m-%dT%H:%M:%SZ)" >/dev/null
git push origin gh-pages
