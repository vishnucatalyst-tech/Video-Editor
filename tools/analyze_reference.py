#!/usr/bin/env python3
"""Measure a reference video's editing style ("Style DNA") so it can be turned into a reusable style guide.

Usage:
  python tools/analyze_reference.py VIDEO_OR_URL --name NAME [--transcribe] [--language auto]

URL inputs are downloaded with yt-dlp (for analysis only — never reuse the footage).
Writes knowledge/references/<name>/:
  metrics.json   shot lengths, cut times, hook timing, tempo, loudness, speech density, colour
  shots.png      first frame of each shot (up to 30), in order
  hook.png       frames at 0.0 / 0.5 / 1.0 / 1.5 / 2.0 / 3.0 s
  style.md       measured numbers + sections for the visual observations (filled in by Claude)
The source video itself is git-ignored.
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
import subprocess
import sys
from pathlib import Path

from common import ROOT, die, require, summarize

REFS = ROOT / "knowledge" / "references"


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "reference"


def download(url: str, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    tmpl = str(out_dir / "source.%(ext)s")
    cmd = [sys.executable, "-m", "yt_dlp", "-f", "bv*[height<=1920]+ba/b", "--merge-output-format", "mp4", "-o", tmpl, url]
    print("$ " + " ".join(cmd))
    if subprocess.run(cmd).returncode != 0:
        die("download failed — the site may block downloads or the network may not allow it. Download the video yourself and pass the file.")
    files = sorted(out_dir.glob("source.*"))
    if not files:
        die("download produced no file")
    return files[0]


def shot_cuts(path: Path, duration: float) -> list[float]:
    from scenedetect import AdaptiveDetector, detect

    scenes = detect(str(path), AdaptiveDetector(adaptive_threshold=2.6, min_scene_len=6))
    sec = lambda tc: tc.seconds if hasattr(type(tc), "seconds") else tc.get_seconds()
    cuts = [round(sec(s), 3) for s, _ in scenes][1:]
    return [c for c in cuts if 0 < c < duration]


def audio_stats(path: Path, duration: float) -> dict:
    out: dict = {}
    res = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "loudnorm=print_format=json", "-f", "null", "-"],
                         capture_output=True, text=True)
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", res.stderr, re.S)
    if m:
        j = json.loads(m.group(0))
        out["loudness_lufs"] = float(j["input_i"])
        out["true_peak_dbtp"] = float(j["input_tp"])
    # Sound vs silence (a rough proxy for speech density / music bed)
    res = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "silencedetect=noise=-35dB:d=0.3", "-f", "null", "-"],
                         capture_output=True, text=True)
    silences = [float(x) for x in re.findall(r"silence_duration: ([\d.]+)", res.stderr)]
    out["silence_ratio"] = round(sum(silences) / duration, 3) if duration else 0
    try:
        import tempfile

        import librosa

        with tempfile.TemporaryDirectory() as td:
            wav = Path(td) / "a.wav"
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(path), "-t", "120", "-ac", "1", "-ar", "22050", str(wav)], check=True)
            y, sr = librosa.load(str(wav), sr=22050, mono=True)
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        out["tempo_bpm"] = round(float(tempo[0] if hasattr(tempo, "__len__") else tempo))
    except Exception as exc:  # no audio stream etc.
        out["tempo_bpm"] = None
        out["tempo_note"] = str(exc)[:120]
    return out


def colour_stats(path: Path, times: list[float]) -> dict:
    import cv2
    import numpy as np

    cap = cv2.VideoCapture(str(path))
    vals = []
    for t in times:
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, f = cap.read()
        if not ok:
            continue
        f = cv2.resize(f, (160, 284))
        hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
        b, g, r = [float(f[..., i].mean()) for i in range(3)]
        vals.append((float(hsv[..., 2].mean()), float(hsv[..., 1].mean()), r - b, float(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).std())))
    cap.release()
    if not vals:
        return {}
    a = np.array(vals)
    bright, sat, warm, contrast = a.mean(axis=0)
    return {
        "brightness_0_255": round(bright),
        "saturation_0_255": round(sat),
        "warmth_r_minus_b": round(warm, 1),
        "contrast_std": round(contrast, 1),
        "look": ", ".join([
            "bright" if bright > 150 else "dark" if bright < 90 else "mid-exposure",
            "saturated" if sat > 120 else "muted" if sat < 60 else "natural saturation",
            "warm" if warm > 12 else "cool" if warm < -12 else "neutral temperature",
            "high contrast" if contrast > 65 else "soft contrast" if contrast < 40 else "medium contrast",
        ]),
    }


def tiles(path: Path, times: list[float], out: Path, cols: int):
    if not times:
        return
    sel = "+".join(f"between(t\\,{t:.3f}\\,{t + 0.04:.3f})" for t in times)
    rows = (len(times) + cols - 1) // cols
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(path), "-vf",
                    f"select='{sel}',scale=180:-2,tile={cols}x{rows}:padding=4:color=0x111111", "-frames:v", "1", "-vsync", "vfr", str(out)],
                   check=False)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source", help="video file or URL")
    ap.add_argument("--name", help="short name for the reference (default: file name)")
    ap.add_argument("--transcribe", action="store_true", help="also transcribe with faster-whisper (words/second, first words)")
    ap.add_argument("--language", default="auto")
    ap.add_argument("--model", default="small")
    args = ap.parse_args()
    require("ffmpeg")

    is_url = re.match(r"https?://", args.source)
    name = slug(args.name or (Path(args.source).stem if not is_url else "reference"))
    out = REFS / name
    out.mkdir(parents=True, exist_ok=True)
    video = download(args.source, out) if is_url else Path(args.source).resolve()
    if not video.exists():
        die(f"not found: {video}")

    info = summarize(video)
    dur = info["duration"]
    print(f"Analysing {video.name}: {info.get('width')}x{info.get('height')} {info.get('fps')} fps, {dur:.1f}s")
    cuts = shot_cuts(video, dur)
    bounds = [0.0] + cuts + [dur]
    shots = [round(b - a, 3) for a, b in zip(bounds, bounds[1:]) if b - a > 0.05]
    metrics = {
        "source": args.source if is_url else video.name,
        "duration_s": dur,
        "resolution": f"{info.get('width')}x{info.get('height')}",
        "aspect": info.get("aspect"),
        "fps": info.get("fps"),
        "shots": len(shots),
        "avg_shot_s": round(statistics.mean(shots), 2) if shots else dur,
        "median_shot_s": round(statistics.median(shots), 2) if shots else dur,
        "shortest_shot_s": min(shots) if shots else dur,
        "longest_shot_s": max(shots) if shots else dur,
        "cuts_per_10s": round(len(cuts) / dur * 10, 2) if dur else 0,
        "first_cut_s": cuts[0] if cuts else None,
        "cut_times_s": cuts,
        "shot_lengths_s": shots,
    }
    if info.get("has_audio"):
        metrics.update(audio_stats(video, dur))
    sample_times = [min(dur - 0.05, (a + b) / 2) for a, b in zip(bounds, bounds[1:])][:40] or [dur / 2]
    metrics["colour"] = colour_stats(video, sample_times)

    if args.transcribe and info.get("has_audio"):
        try:
            from faster_whisper import WhisperModel

            model = WhisperModel(args.model, device="auto", compute_type="int8")
            segs, tinfo = model.transcribe(str(video), language=None if args.language == "auto" else args.language, word_timestamps=True, vad_filter=True)
            words = [w for s in segs for w in (s.words or [])]
            metrics["language"] = tinfo.language
            metrics["words"] = len(words)
            metrics["words_per_second"] = round(len(words) / dur, 2) if dur else 0
            metrics["first_word_s"] = round(words[0].start, 2) if words else None
            metrics["transcript"] = " ".join(w.word.strip() for w in words)
            (out / "transcript.txt").write_text(metrics["transcript"] + "\n", encoding="utf-8")
        except Exception as exc:
            metrics["transcribe_error"] = str(exc)[:200]
            print(f"⚠ transcription skipped: {exc}")

    tiles(video, [b + 0.05 for b in bounds[:-1]][:30], out / "shots.png", cols=6)
    tiles(video, [t for t in (0.0, 0.5, 1.0, 1.5, 2.0, 3.0) if t < dur], out / "hook.png", cols=6)
    (out / "metrics.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    m = metrics
    c = m.get("colour", {})
    style = f"""# Style guide — {name}

Source: {m['source']} · {m['resolution']} · {m['duration_s']:.1f} s · analysed with tools/analyze_reference.py

## Measured
- Shots: {m['shots']} · average {m['avg_shot_s']} s · median {m['median_shot_s']} s · range {m['shortest_shot_s']}–{m['longest_shot_s']} s · {m['cuts_per_10s']} cuts per 10 s
- First cut at {m['first_cut_s']} s
- Music/audio: tempo ≈ {m.get('tempo_bpm')} BPM · loudness {m.get('loudness_lufs')} LUFS · silence ratio {m.get('silence_ratio')}
- Speech: {m.get('words_per_second', 'not transcribed')} words/s · first word at {m.get('first_word_s', '?')} s
- Colour: {c.get('look', '?')} (brightness {c.get('brightness_0_255')}, saturation {c.get('saturation_0_255')}, warmth {c.get('warmth_r_minus_b')}, contrast {c.get('contrast_std')})

## Observed (fill in from shots.png and hook.png — see the style-dna skill)
1. Hook style:
2. Caption style (words per line, case, font feel, highlight, position, animation):
3. Zoom / punch-in habits:
4. Transitions:
5. Text placement and safe zones:
6. B-roll / overlays / graphics:
7. SFX use:
8. Ending style (CTA, loop):

## Settings to reuse (pipeline)
- `pacing` / `max_shot_seconds`:
- `caption_style` / `caption_size` / `caption_case` / `caption_position`:
- `punch_in` usage:
- music tempo / ducking:
"""
    if not (out / "style.md").exists():
        (out / "style.md").write_text(style, encoding="utf-8")
    else:
        (out / "style.measured.md").write_text(style, encoding="utf-8")
    print(json.dumps({k: v for k, v in m.items() if k not in ("cut_times_s", "shot_lengths_s", "transcript")}, indent=2, ensure_ascii=False))
    print(f"✓ knowledge/references/{name}/ — metrics.json, shots.png, hook.png, style.md")


if __name__ == "__main__":
    main()
