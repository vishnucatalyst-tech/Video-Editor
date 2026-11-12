---
name: preview
description: "Render a fast 540x960 preview of a Reel from its cut list and review it. Use after the cut list is approved or after any change, before the final render."
argument-hint: "[project]"
---
Render a low-res preview of the current project. Arguments: $ARGUMENTS

1. Make sure `work/cutlist.json` exists (otherwise run `/cutlist` first).
2. Run `source scripts/activate.sh && python tools/render.py $ARGUMENTS --preview`.
3. Run the **reel-qc** skill on `work/preview.mp4` (it extracts and inspects frames).
4. Report the render line (length, loudness) and the QC checklist in a few lines.
5. Ask for approval before `/final`.
