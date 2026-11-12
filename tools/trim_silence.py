#!/usr/bin/env python3
"""Jump-cut a talking-head clip: drop pauses and filler words using word timestamps.

Usage:
  python tools/transcribe.py PROJECT --input raw/CLIP.mp4 --offset 0      # words in the clip's own time
  python tools/trim_silence.py PROJECT --source raw/CLIP.mp4 [--max-gap 0.4] [--pad 0.08]
                               [--max-shot 3] [--punch 1.1] [--fillers "basically,actually"]

Reads work/words.json (timestamps in the SOURCE clip), writes:
  work/cutlist.json   segments = the kept speech, in order (other cut-list settings such as music are kept)
  work/words.json     words re-timed onto the new edit (the source-timed copy is saved as words.source.json)
  work/cutlist.md     a summary of what was removed
Long takes are split at word boundaries every --max-shot seconds with alternating punch-ins
(1.0 / --punch), so there is a visual change at least every few seconds without losing words.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil

from common import die, load_json, resolve_project, save_json, summarize

FILLERS = {"um", "umm", "uh", "uhh", "uhm", "erm", "er", "ah", "ahh", "hmm", "mm", "mhm"}


def norm(w: str) -> str:
    return re.sub(r"[^\w]", "", w.lower(), flags=re.UNICODE)


def plan(words: list[dict], duration: float, max_gap: float, pad: float, fillers: set[str], max_shot: float, punch: float):
    """Return (segments, retimed_words, stats). Segments are dicts with in/out (source time) and punch_in."""
    kept: list[dict] = []
    removed_fillers = 0
    breaks: set[int] = set()  # indices in `kept` that must start a new chunk
    for w in words:
        if norm(w["word"]) in fillers:
            removed_fillers += 1
            breaks.add(len(kept))
            continue
        kept.append(w)
    if not kept:
        return [], [], {"removed_fillers": removed_fillers}

    # 1. Speech chunks: break at long pauses and where a filler was cut out.
    chunks: list[list[dict]] = [[kept[0]]]
    for i in range(1, len(kept)):
        if kept[i]["start"] - kept[i - 1]["end"] > max_gap or i in breaks:
            chunks.append([kept[i]])
        else:
            chunks[-1].append(kept[i])

    # 2. Split chunks longer than max_shot at word boundaries (visual change for pacing).
    pieces: list[tuple[int, list[dict]]] = []  # (chunk index, words)
    for ci, ch in enumerate(chunks):
        cur = [ch[0]]
        for w in ch[1:]:
            if w["end"] - cur[0]["start"] > max_shot and len(cur) >= 2:
                pieces.append((ci, cur))
                cur = [w]
            else:
                cur.append(w)
        pieces.append((ci, cur))

    # 3. Source ranges: padded around speech; pieces split from one take meet at the gap midpoint.
    segs = []
    prev_out = 0.0
    for i, (ci, p) in enumerate(pieces):
        a = max(prev_out, p[0]["start"] - pad, 0.0)
        b = min(duration, p[-1]["end"] + pad)
        if i + 1 < len(pieces) and pieces[i + 1][0] == ci:
            b = (p[-1]["end"] + pieces[i + 1][1][0]["start"]) / 2
        segs.append({"in": round(a, 3), "out": round(max(b, a + 0.1), 3), "words": p})
        prev_out = segs[-1]["out"]

    # 4. Punch-ins: alternate on back-to-back pieces of the same take, so jump cuts read as intentional.
    zoom = False
    for i, s in enumerate(segs):
        contiguous = i > 0 and abs(s["in"] - segs[i - 1]["out"]) < 0.02
        zoom = (not zoom) if contiguous else False
        s["punch_in"] = punch if zoom else 1.0

    # 5. Re-time words onto the new timeline.
    retimed = []
    t = 0.0
    for s in segs:
        for w in s["words"]:
            retimed.append({**w, "start": round(t + max(0.0, w["start"] - s["in"]), 3), "end": round(t + min(s["out"], w["end"]) - s["in"], 3)})
        t += s["out"] - s["in"]
    new_len = round(t, 3)
    stats = {
        "source_duration": round(duration, 3),
        "new_duration": new_len,
        "removed_seconds": round(duration - new_len, 3),
        "removed_fillers": removed_fillers,
        "pauses_cut": len(chunks) - 1,
        "segments": len(segs),
    }
    return segs, retimed, stats


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", nargs="?")
    ap.add_argument("--source", required=True, help="the talking-head clip, e.g. raw/A1_talking_head.mp4")
    ap.add_argument("--max-gap", type=float, default=0.4, help="pauses longer than this (s) are cut")
    ap.add_argument("--pad", type=float, default=0.08, help="breathing room kept around speech (s)")
    ap.add_argument("--max-shot", type=float, default=3.0, help="split takes longer than this (s) with a punch-in")
    ap.add_argument("--punch", type=float, default=1.1, help="punch-in scale on alternate pieces (1.05–1.15)")
    ap.add_argument("--fillers", default="", help="extra filler words to remove, comma-separated")
    args = ap.parse_args()
    proj = resolve_project(args.project)
    src_path = proj.path / args.source
    if not src_path.exists():
        die(f"{args.source} not found in the project")
    wp = proj.work / "words.json"
    if not wp.exists():
        die(f"no work/words.json — first: python tools/transcribe.py {proj.path} --input {args.source} --offset 0")
    words = load_json(wp)
    fillers = FILLERS | {norm(f) for f in args.fillers.split(",") if f.strip()}
    duration = summarize(src_path)["duration"]

    segs, retimed, stats = plan(words, duration, args.max_gap, args.pad, fillers, args.max_shot, args.punch)
    if not segs:
        die("no speech left after trimming")

    shutil.copy(wp, proj.work / "words.source.json")
    save_json(wp, retimed)
    cl = proj.work / "cutlist.json"
    cut = load_json(cl) if cl.exists() else {"fps": 30, "voiceover": None, "music": None, "logo": bool(proj.brand.get("logo"))}
    cut.update({
        "keep_source_audio": True,
        "voiceover": None,
        "captions": cut.get("captions") or "work/captions.ass",
        "segments": [{"src": args.source, "in": s["in"], "out": s["out"], "punch_in": s["punch_in"],
                      "note": " ".join(w["word"] for w in s["words"])[:60]} for s in segs],
    })
    cut["length"] = stats["new_duration"]
    save_json(cl, cut)

    lines = [f"# Cut list — {proj.path.name} (jump-cut talking head)", "",
             f"{args.source}: {stats['source_duration']:.1f}s → **{stats['new_duration']:.1f}s** "
             f"(removed {stats['removed_seconds']:.1f}s: {stats['pauses_cut']} pauses > {args.max_gap}s, {stats['removed_fillers']} filler words)", "",
             "| # | Timeline | In → Out | Punch-in | Words |", "|---|---|---|---|---|"]
    t = 0.0
    for i, s in enumerate(cut["segments"], 1):
        d = s["out"] - s["in"]
        lines.append(f"| {i} | {t:.2f} → {t + d:.2f} | {s['in']:.2f} → {s['out']:.2f} | {s['punch_in']:.2f}× | {s['note']} |")
        t += d
    lines += ["", "Captions are re-timed (work/words.json). Next: /captions → /preview."]
    (proj.work / "cutlist.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(stats, indent=2))
    print("✓ work/cutlist.json, work/words.json (re-timed), work/cutlist.md")


if __name__ == "__main__":
    main()
