#!/usr/bin/env python3
"""Create a dated Reel project for a brand and probe its raw footage.

Usage: python tools/new_reel.py BRAND TOPIC [--date YYYY-MM-DD]
Creates brands/<brand>/projects/<date>_<topic>/{raw,work,export,brief.md}.
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import shutil
import subprocess
import sys

from common import BRANDS, TEMPLATES


def slug(s: str) -> str:
    s = re.sub(r"[^\w\s-]", "", s.strip().lower(), flags=re.UNICODE)
    return re.sub(r"[\s_]+", "-", s).strip("-") or "untitled"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("brand")
    ap.add_argument("topic", nargs="+")
    ap.add_argument("--date", default=dt.date.today().isoformat())
    args = ap.parse_args()

    brand = slug(args.brand)
    brand_dir = BRANDS / brand
    if not (brand_dir / "BRAND.md").exists():
        (brand_dir / "assets" / "logo").mkdir(parents=True, exist_ok=True)
        (brand_dir / "assets" / "fonts").mkdir(parents=True, exist_ok=True)
        (brand_dir / "assets" / "music").mkdir(parents=True, exist_ok=True)
        text = (TEMPLATES / "BRAND.md").read_text(encoding="utf-8").replace("<Brand Name>", args.brand)
        (brand_dir / "BRAND.md").write_text(text, encoding="utf-8")
        print(f"⚠ New brand '{brand}': created a BRAND.md template. Run /brand-onboard {brand} before editing for real.")

    proj = brand_dir / "projects" / f"{args.date}_{slug(' '.join(args.topic))}"
    if proj.exists():
        print(f"Project already exists: {proj}")
    for d in ("raw", "work", "export"):
        (proj / d).mkdir(parents=True, exist_ok=True)
    if not (proj / "brief.md").exists():
        shutil.copy(TEMPLATES / "brief.md", proj / "brief.md")

    print(f"Project: {proj}")
    print("  raw/      ← drop footage, voiceover, images here")
    print("  brief.md  ← paste the Creative Director prompt here")
    subprocess.run([sys.executable, str(TEMPLATES.parent / "tools" / "probe.py"), str(proj)])


if __name__ == "__main__":
    main()
