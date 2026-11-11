#!/usr/bin/env python3
"""ffprobe every file in a project's raw/ folder and report resolution, fps, duration and audio.

Usage: python tools/probe.py [PROJECT]
Writes work/probe.json and prints a markdown table.
"""
from __future__ import annotations

import argparse

from common import resolve_project, save_json, summarize


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", nargs="?")
    args = ap.parse_args()
    proj = resolve_project(args.project)
    files = proj.raw_files()
    if not files:
        print(f"No media in {proj.raw}. Drop footage, voiceover and images there, then re-run.")
        return
    rows = [summarize(f) for f in files]
    save_json(proj.work / "probe.json", rows)

    print("| File | Kind | Resolution | FPS | Duration | Audio | Notes |")
    print("|---|---|---|---|---|---|---|")
    for r in rows:
        res = f"{r['width']}×{r['height']}" if r.get("width") else "—"
        fps = f"{r['fps']:g}" if r.get("fps") and r["kind"] == "video" else "—"
        audio = f"{r['acodec']} {r['channels']}ch {r['sample_rate'] // 1000}kHz" if r.get("has_audio") else "none"
        notes = []
        if r["kind"] == "video":
            if not r["vertical"]:
                notes.append(f"not 9:16 ({r['aspect']}) → blur-fill or smart crop")
            if r.get("rotation"):
                notes.append(f"rotated {r['rotation']}°")
            if r.get("fps") and r["fps"] not in (24, 25, 30, 50, 60) and abs(r["fps"] - 29.97) > 0.01 and abs(r["fps"] - 59.94) > 0.01:
                notes.append("variable/unusual fps")
            if min(r.get("width", 0), r.get("height", 0)) < 1080:
                notes.append("below 1080p — will be upscaled")
        print(f"| {r['file']} | {r['kind']} | {res} | {fps} | {r['duration']:.2f}s | {audio} | {'; '.join(notes)} |")
    vids = [r for r in rows if r["kind"] == "video"]
    if vids:
        fps_set = {round(r["fps"]) for r in vids}
        target = 60 if fps_set == {60} else 30
        print(f"\nTotal footage: {sum(r['duration'] for r in vids):.1f}s across {len(vids)} clip(s). Output fps: {target}.")


if __name__ == "__main__":
    main()
