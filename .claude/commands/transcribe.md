---
description: Transcribe the voiceover with faster-whisper (word-level JSON + SRT)
argument-hint: [project] [--language ta|en|auto] [--model small|medium|large-v3]
---
Transcribe the voice track for the current project. Arguments: $ARGUMENTS

1. Read the project's `brief.md` and the brand's `BRAND.md` to learn the language mix. For Tamil or Tanglish use `--model medium` (or `large-v3` if accuracy matters more than speed).
2. Run `source ~/reels-env/bin/activate && python tools/transcribe.py $ARGUMENTS`.
   - If there is no separate voiceover (talking-head footage), say so and run it on `work/preview.mp4` after `/preview`.
3. Show the transcript, and list low-confidence words. Fix brand names, product names and Tamil spellings directly in `work/words.json`, then regenerate the SRT with `python -c "import sys; sys.path.insert(0,'tools'); from subtitles import write_srt; from common import load_json; from pathlib import Path; p=Path('<project>/work'); write_srt(load_json(p/'words.json'), p/'captions.srt')"`.
