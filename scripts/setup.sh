#!/usr/bin/env bash
# One-time workstation setup (guide sections 3–4). Works on macOS, Linux and Windows (Git Bash).
# Machine prerequisites (Python 3.11+, Node 22+, FFmpeg, Git, Chrome) must be installed first — see docs/SETUP-WINDOWS.md.
set -euo pipefail
cd "$(dirname "$0")/.."

# Find a real Python 3 (on Windows, "python3" is often only a Microsoft Store shortcut).
PY=""
for c in python3 python py; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' >/dev/null 2>&1; then
    PY="$c"; break
  fi
done
[ -n "$PY" ] || { echo "Python 3.11+ not found. Install it (Windows: winget install Python.Python.3.12) and reopen the terminal."; exit 1; }

VENV="${REELS_ENV:-$HOME/reels-env}"
if [ ! -d "$VENV" ]; then
  echo "Creating Python virtualenv at $VENV"
  "$PY" -m venv "$VENV"
fi
# shellcheck disable=SC1091
source scripts/activate.sh
python -m pip install --upgrade pip >/dev/null
pip install -r requirements.txt

echo "Installing Remotion template (templates/remotion)"
(cd templates/remotion && npm install)

echo
python tools/doctor.py || true
echo
echo "Done. In each new terminal, from the repo root: source scripts/activate.sh"
