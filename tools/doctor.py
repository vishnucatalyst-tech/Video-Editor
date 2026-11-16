#!/usr/bin/env python3
"""Check that this machine has everything the Reels workflow needs (setup guide section 1–4).

Usage: python tools/doctor.py
"""
from __future__ import annotations

import importlib
import shutil
import subprocess
import sys

from common import ROOT

OK, WARN, FAIL = "✓", "!", "✗"
results: list[tuple[str, str, str]] = []


def check(name: str, status: str, detail: str = ""):
    results.append((status, name, detail))


def version(cmd: list[str]) -> str | None:
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        return (out.stdout or out.stderr).strip().splitlines()[0] if out.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def main():
    # Binaries
    for name, cmd, need in [
        ("ffmpeg", ["ffmpeg", "-version"], True),
        ("ffprobe", ["ffprobe", "-version"], True),
        ("node", ["node", "-v"], True),
        ("npm", ["npm", "-v"], True),
        ("git", ["git", "--version"], True),
        ("claude", ["claude", "--version"], False),
    ]:
        v = version(cmd)
        check(name, OK if v else (FAIL if need else WARN), v or "not found")
    node = version(["node", "-v"]) or ""
    if node.startswith("v") and int(node[1:].split(".")[0]) < 20:
        check("node ≥ 20", FAIL, node)

    magick = version(["magick", "-version"]) or version(["convert", "-version"])
    check("ImageMagick", OK if magick else WARN, magick or "not found (thumbnails/overlays only)")

    # FFmpeg build features
    conf = subprocess.run(["ffmpeg", "-hide_banner", "-buildconf"], capture_output=True, text=True).stdout if shutil.which("ffmpeg") else ""
    filters = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True).stdout if shutil.which("ffmpeg") else ""
    for lib in ("libx264", "libx265", "libass", "libfreetype"):
        check(f"ffmpeg --enable-{lib}", OK if f"--enable-{lib}" in conf else FAIL)
    for flt in ("subtitles", "loudnorm", "lut3d", "zoompan", "sidechaincompress", "gblur"):
        check(f"ffmpeg filter {flt}", OK if f" {flt} " in filters else FAIL)

    # Python
    check("python ≥ 3.11", OK if sys.version_info >= (3, 11) else FAIL, sys.version.split()[0])
    in_venv = sys.prefix != sys.base_prefix
    check("virtualenv active", OK if in_venv else WARN, sys.prefix if in_venv else "run: source scripts/activate.sh")
    for mod, pkg in [("faster_whisper", "faster-whisper"), ("scenedetect", "scenedetect"), ("librosa", "librosa"),
                     ("cv2", "opencv"), ("PIL", "pillow"), ("numpy", "numpy"), ("pydub", "pydub"),
                     ("moviepy", "moviepy"), ("yt_dlp", "yt-dlp")]:
        try:
            m = importlib.import_module(mod)
            check(f"python: {pkg}", OK, getattr(m, "__version__", ""))
        except Exception as exc:  # noqa: BLE001
            check(f"python: {pkg}", FAIL, f"{type(exc).__name__} — pip install -r requirements.txt")

    # Fonts
    fc = subprocess.run(["fc-list", ":", "family"], capture_output=True, text=True).stdout.lower() if shutil.which("fc-list") else ""
    local = " ".join(p.stem.lower() for p in (ROOT / "fonts").rglob("*") if p.suffix.lower() in (".ttf", ".otf"))
    for font in ("Inter", "Montserrat", "Poppins", "Bebas Neue"):
        key = font.lower()
        found = key in fc or key.replace(" ", "") in local
        check(f"font {font}", OK if found else WARN, "" if found else "install, or put the .ttf in fonts/")
    tamil = any(k in fc or k.replace(" ", "") in local for k in ("noto sans tamil", "mukta malar"))
    check("Tamil font (Noto Sans Tamil / Mukta Malar)", OK if tamil else WARN)

    # Remotion
    rem = ROOT / "templates" / "remotion" / "node_modules" / "remotion"
    check("Remotion template installed", OK if rem.exists() else WARN, "" if rem.exists() else "cd templates/remotion && npm install")

    width = max(len(n) for _, n, _ in results)
    for status, name, detail in results:
        print(f" {status}  {name.ljust(width)}  {detail}")
    fails = sum(1 for s, _, _ in results if s == FAIL)
    warns = sum(1 for s, _, _ in results if s == WARN)
    print(f"\n{'Ready.' if not fails else f'{fails} problem(s) to fix.'} {warns} warning(s).")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
