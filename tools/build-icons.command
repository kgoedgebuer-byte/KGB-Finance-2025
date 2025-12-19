#!/bin/zsh
set -euo pipefail

REPO="$(dirname "$0")/.."
cd "$REPO"

ICON_DIR="docs/icons"
FULL_SVG="$ICON_DIR/kgb_full_v1.svg"
BUDGET_SVG="$ICON_DIR/kgb_budget_v1.svg"

# Check Chrome
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [[ ! -x "$CHROME" ]]; then
  echo "❌ Google Chrome niet gevonden!"
  echo "Installeer Chrome om iconen automatisch te genereren."
  exit 1
fi

echo "➡️ SVG gevonden:"
echo "   Full   : $FULL_SVG"
echo "   Budget : $BUDGET_SVG"

SIZES=(512 192 180 144 96 72 48)

echo "➡️ Genereer PNG-iconen..."
for s in "${SIZES[@]}"; do
  echo "   - ${s}x${s}"
  "$CHROME" --headless --disable-gpu \
    --window-size="${s},${s}" \
    --screenshot="$ICON_DIR/kgb_full_v1-${s}.png" \
    "file://$REPO/$FULL_SVG" >/dev/null 2>&1

  "$CHROME" --headless --disable-gpu \
    --window-size="${s},${s}" \
    --screenshot="$ICON_DIR/kgb_budget_v1-${s}.png" \
    "file://$REPO/$BUDGET_SVG" >/dev/null 2>&1
done

echo "➡️ Klaar!"
echo "PNG's staan in docs/icons/"
