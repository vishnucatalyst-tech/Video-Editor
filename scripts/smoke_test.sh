#!/usr/bin/env bash
# End-to-end pipeline check on synthetic media (no camera footage or Whisper model needed).
# Covers setup-guide §9 steps 1, 3, 4, 5. For step 2 (/transcribe), test with a real voiceover.
# Usage: bash scripts/smoke_test.sh   (leaves brands/smoke-test/ behind for inspection; it is git-ignored)
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${PYTHON:-$(command -v python >/dev/null 2>&1 && echo python || echo python3)}
DATE=2000-01-01
P=brands/smoke-test/projects/${DATE}_smoke-test
rm -rf brands/smoke-test

$PY tools/new_reel.py smoke-test smoke-test --date $DATE >/dev/null
gen() { ffmpeg -y -v error "$@"; }
gen -f lavfi -i testsrc2=size=1920x1080:rate=30 -f lavfi -i sine=f=330:sample_rate=48000 -t 6 -c:v libx264 -pix_fmt yuv420p -c:a aac "$P/raw/landscape.mp4"
gen -f lavfi -i mandelbrot=size=1080x1920:rate=30 -t 5 -c:v libx264 -pix_fmt yuv420p "$P/raw/vertical.mp4"
gen -f lavfi -i "aevalsrc='0.6*sin(2*PI*60*t)*exp(-30*mod(t,0.5))':s=44100:d=20" "$P/raw/music.wav"
gen -f lavfi -i "aevalsrc='0.3*sin(2*PI*220*t)*lt(mod(t,3),2)':s=48000:d=8" "$P/raw/vo.wav"

$PY tools/probe.py "$P"
$PY tools/cutlist.py "$P" | tail -n 4
# Stand-in transcript so the caption path is exercised without downloading a Whisper model.
cat > "$P/work/words.json" <<'JSON'
[{"word":"Smoke","start":0.1,"end":0.5,"prob":1},{"word":"test","start":0.5,"end":1.0,"prob":1},
 {"word":"passes!","start":1.0,"end":1.8,"prob":1},{"word":"Follow","start":3.0,"end":3.5,"prob":1},
 {"word":"for","start":3.5,"end":3.7,"prob":1},{"word":"more","start":3.7,"end":4.4,"prob":1}]
JSON
$PY tools/captions.py "$P"
$PY tools/render.py "$P" --preview 2>&1 | grep -v '^\$'
$PY tools/render.py "$P" --final 2>&1 | grep -v '^\$' | tee "$P/work/final.log"
$PY tools/export_edit.py "$P"
for f in edit-plan.md edit.edl; do test -s "$P/export/$f" || { echo "missing export/$f"; exit 1; }; done
grep -q "✗" "$P/work/final.log" && { echo "SMOKE TEST FAILED"; exit 1; }
for f in final.mp4 cover.jpg edit-log.md; do test -s "$P/export/$f" || { echo "missing export/$f"; exit 1; }; done
echo "SMOKE TEST PASSED"
