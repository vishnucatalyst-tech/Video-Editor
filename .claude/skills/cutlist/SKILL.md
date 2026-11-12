---
name: cutlist
description: "Draft and refine a Reel's cut list — scene + beat detection, hook in the first 1.5 s, beat-synced cuts, punch-ins. Use when planning or changing the edit (order, timing, length) of a Reel project."
argument-hint: "[project] [--music FILE] [--length SEC]"
---
Draft the cut list for the current project. Arguments: $ARGUMENTS

1. Read `BRAND.md` (pacing, max shot length, learned preferences), any linked style reference in `knowledge/references/`, `knowledge/editor-preferences.md`, and `brief.md` (length, hook, must-include shots). Talking-head footage: use `python tools/trim_silence.py <project> --source raw/<clip>` instead of scene detection, then refine.
2. Run `source ~/reels-env/bin/activate && python tools/cutlist.py $ARGUMENTS`. Pass `--length` if the brief gives a number.
3. Review the draft against the brief and CLAUDE.md quality rules, then improve `work/cutlist.json` directly:
   - The hook lands in the first 1.5 s: the strongest visual plus the strongest line.
   - Must-include shots from the brief are present. Order serves the story.
   - Punch-in (1.05–1.15) on emphasis words. No shot over the brand's max length.
Apply the **reels-craft** skill while reviewing (hook, pacing, structure, red flags).
4. Update `work/cutlist.md` to match, and present it: hook (with the 5 options from the content pass), the edit-plan table (`python tools/export_edit.py <project>` → `export/edit-plan.md`: Time | Source clip | Visual / action | Caption | Audio), and anything you changed and why. Do not render. Wait for my approval, then `/preview`.
