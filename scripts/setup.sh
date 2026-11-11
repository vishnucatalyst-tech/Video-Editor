#!/usr/bin/env bash
# One-time workstation setup (guide sections 3–4). Machine prerequisites (section 1) must be installed first.
set -euo pipefail
cd "$(dirname "$0")/.."

VENV="${REELS_ENV:-$HOME/reels-env}"
if [ ! -d "$VENV" ]; then
  echo "Creating Python virtualenv at $VENV"
  python3 -m venv "$VENV"
fi
# shellcheck disable=SC1091
source "$VENV/bin/activate"
python -m pip install --upgrade pip >/dev/null
pip install -r requirements.txt

echo "Installing Remotion template (templates/remotion)"
(cd templates/remotion && npm install)

echo
python tools/doctor.py || true
echo
echo "Done. In each new terminal: source $VENV/bin/activate"
