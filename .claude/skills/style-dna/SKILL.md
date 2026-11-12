---
name: style-dna
description: "Analyse a reference video (file, URL, screenshots or a description) and write a reusable style guide — shot length, hook, captions, zooms, transitions, music/SFX, colour, text placement, ending — that later edits can follow. Use when the user shares a video or Reel they like, says 'edit like this', 'copy this style', or wants their taste captured."
argument-hint: "[video file or URL] [name]"
---
# Style DNA: capture an editing style once, reuse it forever

Copy the *style*, never the content. Reference footage is for analysis only: it never goes into a client Reel.

## 1. Measure
- **Video file or URL**: `source ~/reels-env/bin/activate && python tools/analyze_reference.py <file-or-url> --name <short-name> [--transcribe]`
  It writes `knowledge/references/<name>/`: `metrics.json` (shot lengths, cut rhythm, first cut, tempo, loudness, speech density, colour), `shots.png` (one frame per shot) and `hook.png` (0–3 s). Downloads use yt-dlp. If the site or network blocks it, ask the user to download the video and send the file.
- **Screenshots only**: save them into `knowledge/references/<name>/` and work from those, plus whatever timings the user gives.
- **A description only**: write the guide from it, and mark every value "estimated".

## 2. Look
Open `hook.png` and `shots.png` and actually look at them. Note:
- the hook: what's on screen at 0.0 s, when the text appears, the motion
- captions: words per line, case, weight, colours, highlight rule, position, animation
- zooms/punch-ins, transitions, B-roll/overlays/graphics
- text placement relative to the safe zones, colour grade, ending/CTA, loopability
For the audio, use `metrics.json`: tempo, loudness, silence ratio (a low ratio with music means a constant bed), words/second. For tighter frame timing, pull extra frames: `ffmpeg -ss <t> -i <file> -frames:v 1 knowledge/references/<name>/f_<t>.jpg`.

## 3. Write the style guide
Fill in `knowledge/references/<name>/style.md` (the tool pre-fills the measured numbers) as **about 15 bullets with numbers wherever possible**: average shot length · hook style · caption style · zoom and transition habits · music and SFX · colour look · text placement · ending style. Then fill in "Settings to reuse", mapping it onto our pipeline knobs: `pacing`, `max_shot_seconds`, `caption_style/size/case/position`, punch-in frequency, music tempo/ducking. Use `../reels-craft/taste-dictionary.md` for the vocabulary.

## 4. Make it stick
- Add a row to `knowledge/INDEX.md` (date, name, source, one-line summary).
- Ask where it should apply:
  - one brand → link it from that brand's `BRAND.md` ("Style reference: knowledge/references/<name>/style.md") and update its front-matter values
  - this editor's default taste → `knowledge/editor-preferences.md`
  - one Reel only → the project's `brief.md` "Style reference" line
- The **reel-brief** and **cutlist** steps read the linked style guide, so future edits follow it without being told.

## 5. Report
The 15-bullet guide in short form, the 3–5 settings that will change in our edits, and anything our tools can't reproduce yet (e.g. speed ramps, animated stickers). Note those as tool gaps in `knowledge/INDEX.md`.
