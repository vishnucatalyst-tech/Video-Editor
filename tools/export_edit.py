#!/usr/bin/env python3
"""Export a Reel's edit for other editing apps and for review.

Usage: python tools/export_edit.py [PROJECT] [--start-tc 00:00:00:00]

Writes into export/:
  edit-plan.md   timecoded plan table: Time | Source clip | Visual / action | Caption / on-screen text | Audio
  edit.edl       CMX3600 EDL (import in Premiere Pro, DaVinci Resolve, Final Cut via the EDL importers)
  captions.srt   from work/words.json (if present)
Source clips are referenced by file name: relink to the project's raw/ folder after importing.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from common import IMAGE_EXT, die, load_json, resolve_project
from subtitles import write_srt


def tc(seconds: float, fps: int) -> str:
    f = int(round(seconds * fps))
    h, f = divmod(f, 3600 * fps)
    m, f = divmod(f, 60 * fps)
    s, f = divmod(f, fps)
    return f"{h:02d}:{m:02d}:{s:02d}:{f:02d}"


def mmss(t: float) -> str:
    return f"{int(t // 60)}:{t % 60:04.1f}"


def parse_tc(s: str, fps: int) -> float:
    h, m, sec, f = (int(x) for x in s.split(":"))
    return h * 3600 + m * 60 + sec + f / fps


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", nargs="?")
    ap.add_argument("--start-tc", default="00:00:00:00", help="record start timecode (Premiere often uses 01:00:00:00)")
    args = ap.parse_args()
    proj = resolve_project(args.project)
    cl = proj.work / "cutlist.json"
    if not cl.exists():
        die("no work/cutlist.json — run /cutlist first")
    cut = load_json(cl)
    fps = int(cut.get("fps", 30))
    words = load_json(proj.work / "words.json") if (proj.work / "words.json").exists() else []
    rec0 = parse_tc(args.start_tc, fps)
    proj.export.mkdir(exist_ok=True)

    # --- EDL ---------------------------------------------------------------
    track = "B" if cut.get("keep_source_audio") else "V"  # B = video + audio
    lines = [f"TITLE: {proj.path.name}", "FCM: NON-DROP FRAME", ""]
    t = 0.0
    for i, s in enumerate(cut["segments"], 1):
        d = s["out"] - s["in"]
        src_in, src_out = (0.0, d) if s.get("still") or Path(s["src"]).suffix.lower() in IMAGE_EXT else (s["in"], s["out"])
        lines.append(f"{i:03d}  AX       {track:<5} C        {tc(src_in, fps)} {tc(src_out, fps)} {tc(rec0 + t, fps)} {tc(rec0 + t + d, fps)}")
        lines.append(f"* FROM CLIP NAME: {Path(s['src']).name}")
        if float(s.get("punch_in", 1) or 1) > 1.001:
            lines.append(f"* PUNCH-IN: {float(s['punch_in']) * 100:.0f}% (scale, centred)")
        if s.get("note"):
            lines.append(f"* NOTE: {s['note']}")
        lines.append("")
        t += d
    length = t
    (proj.export / "edit.edl").write_text("\n".join(lines), encoding="utf-8")

    # --- Edit plan table ---------------------------------------------------
    music = cut.get("music")
    vo = cut.get("voiceover")
    rows = ["| Time | Source clip | Visual / action | Caption / on-screen text | Audio |", "|---|---|---|---|---|"]
    t = 0.0
    for i, s in enumerate(cut["segments"]):
        d = s["out"] - s["in"]
        still = s.get("still") or Path(s["src"]).suffix.lower() in IMAGE_EXT
        visual = []
        p = float(s.get("punch_in", 1) or 1)
        visual.append(f"punch-in {p * 100:.0f}%" if p > 1.001 else ("still, slow push 100→106%" if still else "full frame"))
        visual.append("hard cut" if i else "opens")
        if s.get("note"):
            visual.append(s["note"])
        caps = " ".join(w["word"] for w in words if t <= w["start"] < t + d)
        audio = []
        if cut.get("keep_source_audio"):
            audio.append("source audio")
        if vo and t + d > float(vo.get("offset", 0)):
            audio.append("voiceover")
        if music:
            audio.append(f"music{' (ducked under voice)' if (vo or cut.get('keep_source_audio')) and music.get('duck_db', -14) else ''}")
        if i == 0:
            audio.append("0.3 s fade in")
        if i == len(cut["segments"]) - 1:
            audio.append("0.3 s fade out")
        src = Path(s["src"]).name + ("" if still else f" ({mmss(s['in'])}–{mmss(s['out'])})")
        rows.append(f"| {mmss(t)}–{mmss(t + d)} | {src} | {'; '.join(visual)} | {('“' + caps + '”') if caps else '—'} | {', '.join(audio) or '—'} |")
        t += d
    plan = [f"# Edit plan — {proj.path.name}", "",
            f"{length:.2f} s · {fps} fps · 1080×1920 · {len(cut['segments'])} shots" + (f" · music: {Path(music['src']).name}" if music else ""), "",
            *rows, "",
            "Files: `edit.edl` (Premiere / DaVinci / Final Cut — relink clips to raw/), `captions.srt` (import as subtitles).",
            "CapCut / VN: add the clips in this order, trim each to the Source in–out times, apply the punch-ins as scale, import captions.srt."]
    (proj.export / "edit-plan.md").write_text("\n".join(plan) + "\n", encoding="utf-8")

    if words:
        write_srt(words, proj.export / "captions.srt")
    print(f"✓ export/edit-plan.md, export/edit.edl{', export/captions.srt' if words else ''} ({len(cut['segments'])} events, {length:.2f}s)")


if __name__ == "__main__":
    main()
