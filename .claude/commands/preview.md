---
description: Render a 540x960 preview from the cut list
argument-hint: [project]
---
Render a low-res preview of the current project. Arguments: $ARGUMENTS

1. Make sure `work/cutlist.json` exists (otherwise run `/cutlist` first).
2. Run `source ~/reels-env/bin/activate && python tools/render.py $ARGUMENTS --preview`.
3. Report the output line (length, loudness). Extract 3–4 frames, including the first frame and a captioned frame, with `ffmpeg -ss <t> -i work/preview.mp4 -frames:v 1 work/frame_<t>.jpg`, and look at them. Check that the hook reads at frame 1, captions sit inside the safe zones and don't cover faces or product, and nothing is stretched.
4. Ask for approval before `/final`.
