#!/usr/bin/env python3
"""Transcribe the voice track with faster-whisper (word-level timestamps).

Usage: python tools/transcribe.py [PROJECT] [--input FILE] [--offset SEC] [--language en|ta|auto] [--model small]

Input defaults to the voiceover in raw/ (a file named vo*/voiceover*/narration*, or the only
audio file). For talking-head footage with no separate voiceover, render /preview first and
pass --input work/preview.mp4 so timestamps match the edited timeline.

Writes (timestamps are on the edit timeline, i.e. shifted by --offset):
  work/words.json      word list [{word, start, end, prob}]
  work/captions.srt    phrase-level subtitles
  work/transcript.txt  plain text
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

from common import AUDIO_EXT, die, load_json, resolve_project, save_json
from subtitles import write_srt


def find_voiceover(proj) -> Path | None:
    audio = proj.raw_files(AUDIO_EXT)
    named = [p for p in audio if re.match(r"(vo|voice|voiceover|narration)", p.stem, re.I)]
    if named:
        return named[0]
    return audio[0] if len(audio) == 1 else None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", nargs="?")
    ap.add_argument("--input")
    ap.add_argument("--offset", type=float)
    ap.add_argument("--language", default="auto", help="en, ta, or auto (Tanglish: auto)")
    ap.add_argument("--model", default="small", help="tiny/base/small/medium/large-v3 (Tamil: medium or large-v3)")
    ap.add_argument("--device", default="auto")
    args = ap.parse_args()
    proj = resolve_project(args.project)

    src = Path(args.input).resolve() if args.input else find_voiceover(proj)
    if not src or not src.exists():
        die("no voiceover found in raw/. Name it vo.wav (or pass --input). For talking-head footage, run /preview then --input work/preview.mp4")

    offset = args.offset
    if offset is None:
        offset = 0.0
        cl = proj.work / "cutlist.json"
        if cl.exists() and not args.input:
            vo = load_json(cl).get("voiceover") or {}
            offset = float(vo.get("offset", 0))

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        die("faster-whisper is not installed — activate the venv: source scripts/activate.sh")

    print(f"Transcribing {src.name} with faster-whisper '{args.model}' (language={args.language}, offset={offset:+.2f}s)…")
    model = WhisperModel(args.model, device=args.device, compute_type="int8" if args.device in ("auto", "cpu") else "float16")
    segments, info = model.transcribe(
        str(src),
        language=None if args.language == "auto" else args.language,
        word_timestamps=True,
        vad_filter=True,
        beam_size=5,
    )
    words = []
    for seg in segments:
        for w in seg.words or []:
            words.append(
                {"word": w.word.strip(), "start": round(w.start + offset, 3), "end": round(w.end + offset, 3), "prob": round(w.probability, 3)}
            )
    if not words:
        die("no speech detected")

    save_json(proj.work / "words.json", words)
    write_srt(words, proj.work / "captions.srt")
    (proj.work / "transcript.txt").write_text(" ".join(w["word"] for w in words) + "\n", encoding="utf-8")

    low = [w for w in words if w["prob"] < 0.5]
    print(f"Language: {info.language} ({info.language_probability:.0%}). {len(words)} words, {words[0]['start']:.2f}s → {words[-1]['end']:.2f}s.")
    print(f"Wrote work/words.json, work/captions.srt, work/transcript.txt")
    if low:
        print(f"⚠ {len(low)} low-confidence word(s) — check spelling of names/brand terms: " + ", ".join(w["word"] for w in low[:12]))


if __name__ == "__main__":
    main()
