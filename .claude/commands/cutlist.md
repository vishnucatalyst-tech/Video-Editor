---
description: Scene + beat detection, draft work/cutlist.md with a hook suggestion
argument-hint: [project] [--music FILE] [--length SEC]
---
Draft the cut list for the current project. Arguments: $ARGUMENTS

1. Read `BRAND.md` (pacing, max shot length) and `brief.md` (length, hook, must-include shots).
2. Run `source ~/reels-env/bin/activate && python tools/cutlist.py $ARGUMENTS`. Pass `--length` if the brief gives a number.
3. Review the draft against the brief and CLAUDE.md quality rules, then improve `work/cutlist.json` directly:
   - The hook lands in the first 1.5 s: the strongest visual plus the strongest line.
   - Must-include shots from the brief are present. Order serves the story.
   - Punch-in (1.05–1.15) on emphasis words. No shot over the brand's max length.
4. Update `work/cutlist.md` to match, and present it: hook, cut table, and anything you changed and why. Do not render. Wait for my approval, then `/preview`.
