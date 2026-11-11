---
description: Full-quality export, loudness normalize, cover frame, edit-log
argument-hint: [project]
---
Render the final Reel for the current project. Arguments: $ARGUMENTS

Only run this after the preview has been approved.

1. Run `source ~/reels-env/bin/activate && python tools/render.py $ARGUMENTS --final`.
2. Confirm every check passes (1080x1920, H.264, AAC, −14 LUFS ±1, length). If one fails, fix the cause and re-render. Don't hand over a failing file.
3. Look at `export/cover.jpg`. If it's weak (motion blur, eyes closed, no subject), pick a better timestamp: `python tools/cover.py export/final.mp4` or `ffmpeg -ss <t> -i export/final.mp4 -frames:v 1 -q:v 2 export/cover.jpg`.
4. Summarise in a few lines: file paths, length, loudness, and anything to flag for the brand or the hook.
