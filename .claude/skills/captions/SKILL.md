---
name: captions
description: "Build brand-styled captions for a Reel (pop, karaoke or minimal; libass or Remotion animated overlay; Tamil-capable fonts). Use when captions need to be created, restyled, moved or re-timed after text changes."
argument-hint: "[project] [--style pop|karaoke|minimal] [--position lower|middle|upper] [--remotion]"
---
Build brand-styled captions for the current project. Arguments: $ARGUMENTS

1. Make sure `work/words.json` exists (otherwise run `/transcribe` first) and read the caption settings in `BRAND.md`.
2. Run `source scripts/activate.sh && python tools/captions.py $ARGUMENTS`.
   - Default: ASS subtitles burned in by libass. Fast, and good for pop, karaoke and minimal styles.
   - `--remotion`: an animated overlay (spring pop and karaoke highlight) rendered by `templates/remotion` to a transparent ProRes 4444 `.mov`. Needs `npm install` in `templates/remotion` once.
3. The cut list's `captions` field is updated automatically. Re-run `/preview` and check that captions don't cover faces or product. If they do, use `--position upper` or `--position middle`.
