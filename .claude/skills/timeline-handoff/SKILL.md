---
name: timeline-handoff
description: "Hand a Reel project to the web editor for hands-on timeline changes and pick the edits back up — use when the user wants to trim, reorder, retime or retype captions themselves, or says they edited a Reel in the browser editor."
argument-hint: "[project]"
---
# Timeline hand-off (web editor ⇄ pipeline)

The web editor at https://weequb-video-editor.vercel.app (source: `web-editor/`) opens a Reel project folder as a timeline and saves the edits back into the cut list.

## Sending the project to the user
Tell them, briefly:
1. Open the editor in **Chrome or Edge** (they can save straight into the folder; other browsers download the files).
2. **Open Reel** → pick `brands/<brand>/projects/<date_topic>` (the folder with `raw/` and `work/`). Allow edit access when asked.
3. Tracks: **Shots** (trim edges, drag to reorder, `S` to split, Scale 105–115% = punch-in, a Note per shot), **Captions** (edit text in the Inspector, drag to retime), **Music/Voiceover** (volume, music in-point). Space = play.
4. **Save to Reel** → writes `work/cutlist.json`, `work/words.json`, `work/cutlist.md` (+ copies newly imported media into `raw/`). The dialog lists anything the pipeline will treat differently.
If the user works on another machine, the project folder must include `raw/` media — zip `raw/`, `brief.md` and `work/{cutlist.json,cutlist.md,words.json}` for them.

## Picking the edits back up
1. Get the saved `work/cutlist.json` and `work/words.json` into the project (they're written in place in Chrome/Edge; otherwise the user sends the two downloaded files).
2. Diff against what you had: `git diff -- <project>/work/` (or compare segment by segment) and summarise what changed in 2–4 lines.
3. Check the editor's warnings and the craft rules (**reels-craft**): gaps are closed automatically (shots play back to back), speed changes are ignored, framing/colour/fades are re-done by the pipeline, punch-ins > 1.15 break the style guide.
4. Caption text or timing changed → skill **captions** again (the styled captions are rebuilt from `words.json`). Then **preview** → **reel-qc** → approval → **final**.
