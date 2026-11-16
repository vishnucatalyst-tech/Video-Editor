#!/usr/bin/env python3
"""Build brand-styled captions from work/words.json and attach them to the cut list.

Usage:
  python tools/captions.py [PROJECT] [--style pop|karaoke|minimal] [--position lower|middle|upper]
      → work/captions.ass, burned in by libass at render time (fast, default)
  python tools/captions.py [PROJECT] --remotion
      → work/captions.mov, a transparent animated overlay rendered by the Remotion
        project in templates/remotion (word pop / karaoke highlight with spring motion)

Style, font, colours and position come from BRAND.md front matter unless overridden.
Captions stay inside Instagram safe zones (250 px top, 320 px bottom, 60 px sides).
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path

from common import ROOT, TEMPLATES, die, load_json, resolve_project, save_json
from subtitles import build_ass


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", nargs="?")
    ap.add_argument("--style", choices=["pop", "karaoke", "minimal"])
    ap.add_argument("--position", choices=["lower", "middle", "upper"])
    ap.add_argument("--remotion", action="store_true")
    args = ap.parse_args()
    proj = resolve_project(args.project)
    brand = proj.brand
    wp = proj.work / "words.json"
    if not wp.exists():
        die("no work/words.json — run /transcribe first")
    words = load_json(wp)
    cl = proj.work / "cutlist.json"
    cut = load_json(cl) if cl.exists() else None
    length = cut["length"] if cut else words[-1]["end"] + 0.5

    if args.remotion:
        rdir = TEMPLATES / "remotion"
        if not (rdir / "node_modules").exists():
            die(f"Remotion not installed — run: cd {rdir.relative_to(ROOT)} && npm install")
        fps = int(cut.get("fps", 30)) if cut else 30
        props = {
            "words": words,
            "durationInFrames": max(1, int(round(length * fps))),
            "fps": fps,
            "style": args.style or brand.get("caption_style", "pop"),
            "position": args.position or brand.get("caption_position", "lower"),
            "font": brand.get("caption_font", brand.get("headline_font", "Montserrat")),
            "textColor": brand.color("caption_color", "#FFFFFF"),
            "accentColor": brand.color("accent_color", "#FFD400"),
            "outlineColor": brand.color("caption_outline", "#000000"),
            "uppercase": str(brand.get("caption_case", "upper")).lower() == "upper",
        }
        props_path = proj.work / "captions.props.json"
        save_json(props_path, props)
        out = proj.work / "captions.mov"
        cmd = [shutil.which("npx") or "npx", "remotion", "render", "src/index.ts", "Captions", str(out), f"--props={props_path}",
               "--codec=prores", "--prores-profile=4444", "--pixel-format=yuva444p10le", "--image-format=png"]
        browser = shutil.which("chromium") or next((p for p in ("/opt/pw-browsers/chromium",) if Path(p).exists()), None)
        if browser:
            cmd.append(f"--browser-executable={browser}")
        print("$ " + " ".join(cmd))
        if subprocess.run(cmd, cwd=rdir).returncode != 0:
            die("Remotion render failed")
        rel = "work/captions.mov"
    else:
        ass = build_ass(words, brand, args.style, args.position)
        (proj.work / "captions.ass").write_text(ass, encoding="utf-8")
        rel = "work/captions.ass"
        style = args.style or brand.get("caption_style", "pop")
        print(f"✓ {rel}: {style} style, {ass.count('Dialogue:')} caption events")

    if cut is not None:
        cut["captions"] = rel
        cl.write_text(json.dumps(cut, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("Cut list updated — captions will be burned in on the next /preview or /final.")


if __name__ == "__main__":
    main()
