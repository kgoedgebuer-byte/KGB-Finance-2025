#!/bin/zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[[ -x "$CHROME" ]] || { echo "❌ Google Chrome niet gevonden op $CHROME"; exit 1; }

cd "$ROOT"
[[ -f docs/icons/kgb-green-v2.svg && -f docs/icons/kgb-blue-v2.svg ]] || {
  echo "❌ SVG's ontbreken in docs/icons (kgb-*-v2.svg)"; exit 1; }

render_set () {
  local svg="$1" base="$2" ; shift 2
  local sizes=(512 192 144 96 72 48)
  for s in "${sizes[@]}"; do
    local out="docs/icons/${base}-${s}.png"
    "$CHROME" --headless --disable-gpu \
      --screenshot="$PWD/$out" \
      --window-size="${s},${s}" \
      "file://$PWD/docs/icons/_rasterize.html?svg=$(python3 - <<PY
import urllib.parse,sys; print(urllib.parse.quote('docs/icons/' + '$svg'))
PY
)"
    echo "✔ $out"
  done
}

echo "🖼  Genereren PNG's…"
render_set "kgb-green-v2.svg" "budget"
render_set "kgb-blue-v2.svg"  "full"

echo "✅ Klaar. Commit en push indien gewenst:"
echo "   git add docs/icons && git commit -m 'Rebuild icons' && git push"
