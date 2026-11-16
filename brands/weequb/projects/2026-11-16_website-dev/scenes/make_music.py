#!/usr/bin/env python3
"""Generate an original 120 BPM music bed (22.5 s) into raw/music.wav using the demo synth (no licence needed)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(ROOT / "scripts"))
from demo_assets import music  # noqa: E402

music(Path(__file__).resolve().parent.parent / "raw" / "music.wav", seconds=22.5)
