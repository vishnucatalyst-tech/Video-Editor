# Activate the Reels Python environment. Works on macOS/Linux (bin/) and Windows Git Bash (Scripts/).
# Usage (from the repo root):  source scripts/activate.sh
_reels_venv="${REELS_ENV:-$HOME/reels-env}"
if [ -f "$_reels_venv/bin/activate" ]; then
  . "$_reels_venv/bin/activate"
elif [ -f "$_reels_venv/Scripts/activate" ]; then
  . "$_reels_venv/Scripts/activate"
else
  echo "reels-env not found at $_reels_venv — run: bash scripts/setup.sh" >&2
  return 1 2>/dev/null || exit 1
fi
unset _reels_venv
