#!/usr/bin/env python3
"""Draft a beat-synced cut list from raw footage: scene detection + music beats + hook pick.

Usage: python tools/cutlist.py [PROJECT] [--music FILE] [--length SEC] [--no-hook]

Writes work/cutlist.json (what /preview and /final render) and work/cutlist.md (for review).
Nothing is rendered: review the draft, edit cutlist.json if needed, then run /preview.
"""
from __future__ import annotations

import argparse
import math
import re
from pathlib import Path

from common import AUDIO_EXT, IMAGE_EXT, VIDEO_EXT, die, fmt_ts, load_json, resolve_project, save_json, summarize
from transcribe import find_voiceover

PACING = {"fast": 3.0, "medium": 4.0, "calm": 5.0}
MIN_SHOT = 0.6
HOOK_MAX = 1.5


def detect_scenes(path: Path, duration: float) -> list[tuple[float, float]]:
    from scenedetect import ContentDetector, detect

    try:
        scenes = detect(str(path), ContentDetector(threshold=27.0, min_scene_len=12), start_in_scene=True)
        sec = lambda tc: tc.seconds if hasattr(type(tc), "seconds") else tc.get_seconds()
        out = [(sec(s), sec(e)) for s, e in scenes]
    except Exception as exc:  # unreadable codec etc.
        print(f"⚠ scene detection failed on {path.name}: {exc}")
        out = []
    return [(s, e) for s, e in out if e - s >= MIN_SHOT] or [(0.0, duration)]


def visual_energy(path: Path, start: float, end: float, samples: int = 8) -> float:
    """Motion × sharpness score for a time range (higher = more striking)."""
    import cv2
    import numpy as np

    cap = cv2.VideoCapture(str(path))
    prev, motion, sharp, n = None, 0.0, 0.0, 0
    for i in range(samples):
        t = start + (end - start) * (i + 0.5) / samples
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, frame = cap.read()
        if not ok:
            continue
        g = cv2.cvtColor(cv2.resize(frame, (160, 284 if frame.shape[0] > frame.shape[1] else 90)), cv2.COLOR_BGR2GRAY)
        sharp += cv2.Laplacian(g, cv2.CV_64F).var()
        if prev is not None and prev.shape == g.shape:
            motion += float(np.mean(cv2.absdiff(g, prev)))
        prev, n = g, n + 1
    cap.release()
    if n == 0:
        return 0.0
    return (motion / max(1, n - 1) + 1) * math.log1p(sharp / n)


def detect_beats(path: Path) -> tuple[float, list[float]]:
    import librosa

    y, sr = librosa.load(str(path), sr=22050, mono=True, duration=180)
    tempo, frames = librosa.beat.beat_track(y=y, sr=sr)
    tempo = float(tempo[0] if hasattr(tempo, "__len__") else tempo)
    return tempo, [round(float(t), 3) for t in librosa.frames_to_time(frames, sr=sr)]


def snap_to_beat(t_min: float, t_want: float, t_max: float, beats: list[float]) -> float:
    cands = [b for b in beats if t_min <= b <= t_max]
    return min(cands, key=lambda b: abs(b - t_want)) if cands else t_want


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", nargs="?")
    ap.add_argument("--music", help="music track (default: raw/music*.*)")
    ap.add_argument("--length", type=float, help="target length in seconds (default: voiceover length, else ≤ 30s)")
    ap.add_argument("--no-hook", action="store_true", help="keep footage order; don't move the strongest moment to the front")
    args = ap.parse_args()
    proj = resolve_project(args.project)
    brand = proj.brand

    clips = [summarize(p) for p in proj.raw_files(VIDEO_EXT | IMAGE_EXT)]
    if not clips:
        die("no video or images in raw/")
    vo = find_voiceover(proj)
    music = Path(args.music).resolve() if args.music else next(
        (p for p in proj.raw_files(AUDIO_EXT) if re.match(r"(music|track|song|bgm)", p.stem, re.I)), None
    )
    if music and vo and music == vo:
        vo = None

    max_shot = float(brand.get("max_shot_seconds", PACING.get(str(brand.get("pacing", "fast")).lower(), 3.0)))
    vo_info = summarize(vo) if vo else None
    footage = sum(c["duration"] if c["kind"] == "video" else max_shot for c in clips)
    target = args.length or (vo_info["duration"] + 0.6 if vo_info else min(max(footage, 7.0), 30.0 if footage > 30 else footage))
    target = round(min(target, footage), 2)

    tempo, beats = (0.0, [])
    if music:
        tempo, beats = detect_beats(music)
        print(f"Music: {music.name} — {tempo:.0f} BPM, {len(beats)} beats")

    # 1. Scenes and scores
    pool = []  # {src, start, end, score, kind}
    for c in clips:
        src = Path(c["path"])
        if c["kind"] == "image":
            pool.append({"src": src, "start": 0.0, "end": max_shot, "score": 0.5, "kind": "image", "cursor": 0.0})
            continue
        for s, e in detect_scenes(src, c["duration"]):
            pool.append({"src": src, "start": s, "end": e, "score": visual_energy(src, s, e), "kind": "video", "cursor": s})
    print(f"Found {len(pool)} usable shot(s) in {len(clips)} file(s); target {target:.1f}s, max shot {max_shot:g}s")

    # 2. Hook: strongest ≤1.5s moment goes first
    segments = []
    t = 0.0
    hook = None
    if not args.no_hook and len(pool) > 1:
        hook = max((p for p in pool if p["kind"] == "video"), key=lambda p: p["score"], default=None)
        if hook:
            length = min(HOOK_MAX, hook["end"] - hook["start"])
            end = snap_to_beat(MIN_SHOT, length, HOOK_MAX, beats)
            segments.append({"src": hook["src"], "in": hook["start"], "out": hook["start"] + end, "note": "hook (strongest motion/sharpness)"})
            hook["cursor"] = hook["start"] + end
            t = end

    # 3. Fill in story order, cutting on beats
    guard = 0
    while t < target - 0.05 and guard < 500:
        guard += 1
        progressed = False
        for p in pool:
            if t >= target - 0.05:
                break
            avail = p["end"] - p["cursor"]
            if avail < MIN_SHOT:
                continue
            want = min(max_shot, avail, target - t)
            if want < MIN_SHOT:
                continue
            end_tl = snap_to_beat(t + min(MIN_SHOT, want), t + want, t + min(max_shot, avail, target - t), beats)
            dur = round(end_tl - t, 3)
            # Don't leave a sliver at the end: fold a short remainder into this shot.
            if 0 < target - (t + dur) < MIN_SHOT:
                dur = round(min(avail, target - t), 3)
            seg = {"src": p["src"], "in": round(p["cursor"], 3), "out": round(p["cursor"] + dur, 3), "note": ""}
            if p["kind"] == "image":
                seg["still"] = True
            segments.append(seg)
            p["cursor"] += dur
            t += dur
            progressed = True
        if not progressed:
            break
    if t < target - 0.1:
        print(f"⚠ Not enough distinct footage: reel will be {t:.1f}s instead of {target:.1f}s.")

    # 4. Punch-ins on emphasis words (if transcribed)
    words_path = proj.work / "words.json"
    words = load_json(words_path) if words_path.exists() else []
    vo_offset = 0.0
    tl = 0.0
    for s in segments:
        d = s["out"] - s["in"]
        emph = [w for w in words if tl <= w["start"] < tl + d and (w["word"].endswith("!") or len(re.sub(r"\W", "", w["word"])) >= 8 or w["word"].isupper())]
        s["punch_in"] = 1.1 if emph and not s.get("still") else 1.0
        if emph:
            s["note"] = (s["note"] + "; " if s["note"] else "") + f"punch-in on “{emph[0]['word']}”"
        tl += d

    rel = lambda p: str(Path(p).resolve().relative_to(proj.path)) if str(Path(p).resolve()).startswith(str(proj.path)) else str(Path(p).resolve())
    cut = {
        "length": round(sum(s["out"] - s["in"] for s in segments), 3),
        "fps": 60 if clips and all(round(c.get("fps") or 0) == 60 for c in clips if c["kind"] == "video") else 30,
        "keep_source_audio": vo is None,
        "source_audio_gain_db": 0,
        "voiceover": {"src": rel(vo), "offset": vo_offset, "gain_db": 0} if vo else None,
        "music": {"src": rel(music), "in": 0.0, "gain_db": -4, "duck_db": -14} if music else None,
        "captions": "work/captions.ass" if words else None,
        "logo": bool(brand.get("logo")),
        "segments": [{**s, "src": rel(s["src"])} for s in segments],
        "beats": [b for b in beats if b <= t + 1],
    }
    save_json(proj.work / "cutlist.json", cut)

    hook_line = next((" ".join(w["word"] for w in g) for g in [words[:12]] if g), None)
    md = [f"# Cut list — {proj.path.name}", "", f"Length **{cut['length']:.2f}s** · {cut['fps']} fps · "
          f"{len(segments)} cuts · {'music ' + str(round(tempo)) + ' BPM' if music else 'no music'} · "
          f"{'voiceover ' + Path(vo).name if vo else 'source audio'}", ""]
    md += ["## Hook (first 1.5 s)", ""]
    if hook:
        md.append(f"- Visual: {hook['src'].name} @ {hook['start']:.2f}s — highest motion × sharpness shot.")
    md.append(f"- Spoken: “{hook_line}…”" if hook_line else "- Spoken: (no transcript yet — run /transcribe for a text hook)")
    md.append("- Check: does the first frame read without sound? Put the on-screen hook text in the first 1.5 s.")
    md += ["", "## Cuts", "", "| # | Timeline | Source | In → Out | Len | Notes |", "|---|---|---|---|---|---|"]
    tl = 0.0
    for i, s in enumerate(segments, 1):
        d = s["out"] - s["in"]
        md.append(f"| {i} | {fmt_ts(tl)} | {Path(s['src']).name} | {s['in']:.2f} → {s['out']:.2f} | {d:.2f}s | {s.get('note', '')} |")
        tl += d
    long_shots = [i for i, s in enumerate(segments, 1) if s["out"] - s["in"] > max_shot + 1e-6]
    md += ["", "## Checks", ""]
    md.append(f"- Longest shot {max(s['out'] - s['in'] for s in segments):.2f}s (brand max {max_shot:g}s){' ⚠ shots ' + str(long_shots) if long_shots else ' ✓'}")
    if music:
        on_beat = sum(1 for x in range(1, len(segments)) if any(abs(sum(s['out'] - s['in'] for s in segments[:x]) - b) < 0.05 for b in beats))
        md.append(f"- Cuts on beat: {on_beat}/{max(0, len(segments) - 1)}")
    md += ["", "Edit `work/cutlist.json` to change order, in/out points or punch-ins, then run `/preview`."]
    (proj.work / "cutlist.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    main()
