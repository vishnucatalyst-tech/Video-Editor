---
name: reel-qc
description: "Quality-check a rendered Reel (work/preview.mp4 or export/final.mp4) against the Weequb output spec — looks at real frames for hook, safe zones, caption placement, stretching, logo, plus loudness and format. Use after every /preview and /final, or when asked to review/check a Reel."
argument-hint: "[project] [preview|final]"
---
# Reel QC

Check the rendered file — don't trust the render log alone. Arguments: $ARGUMENTS (default: the current project's latest render).

1. **Format** — `ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate:format=duration -of compact <file>`
   Final must be 1080x1920, h264 + aac, 30 fps (or 60 if the source was 60), length within the brief.
2. **Loudness** — `ffmpeg -hide_banner -i <file> -af loudnorm=print_format=summary -f null - 2>&1 | tail -12`
   Integrated −14 LUFS ±1, true peak ≤ −1 dBTP. Music must sit under voice (listen to the speech spans in `work/words.json`).
3. **Frames** — extract and LOOK at them:
   `ffmpeg -v error -i <file> -vf "select='eq(n\,0)+eq(n\,20)+eq(n\,45)+gt(scene\,0.3)',scale=270:480,tile=6x2" -frames:v 1 work/qc_contact.png`
   plus single frames at each caption start (`ffmpeg -ss <t> -i <file> -frames:v 1 work/qc_<t>.jpg`). Check:
   - Frame 0–1.5 s: does the hook read with sound off?
   - Captions inside safe zones (250 px top, 320 px bottom, 60 px sides) and not over faces or product.
   - No stretched or letterboxed footage (non-9:16 shots should show the blurred fill or a clean crop).
   - Logo: right place, not doubled on the end card. Brand colours/fonts match `BRAND.md`.
   - Tamil text renders as Tamil glyphs (no empty boxes).
4. **Deliverables (final only)** — `export/final.mp4`, `cover.jpg` (strong frame, not mid-word — replace via `python tools/cover.py` or `ffmpeg -ss <t> …` if weak), `captions.srt`, `edit-log.md`.

Report as a short checklist: ✓/✗ per item, with the timestamp of each problem and the fix you propose. Fix spec failures before hand-over; ask before changing creative choices.
