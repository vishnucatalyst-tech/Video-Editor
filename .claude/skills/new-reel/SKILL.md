---
name: new-reel
description: "Create a dated Reel project for a brand and probe its raw footage. Use when starting a new Reel/short video for a brand or when footage needs to be checked (resolution, fps, duration, audio)."
argument-hint: "<brand> <topic>"
---
Create a new Reel project: `$ARGUMENTS` (first word = brand, rest = topic).

1. Run `source scripts/activate.sh && python tools/new_reel.py $ARGUMENTS`.
2. If the brand was just created (no BRAND.md before), stop and tell me to run `/brand-onboard <brand>` first.
3. Otherwise read `brands/<brand>/BRAND.md`, then show the probe table. If `raw/` is empty, tell me to drop the footage, voiceover and images into `raw/` and paste the Creative Director prompt into `brief.md`.
4. Flag anything in the probe that will hurt quality: non-9:16 sources, footage below 1080p, variable frame rate, HDR, missing audio.
