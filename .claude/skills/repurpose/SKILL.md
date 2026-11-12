---
name: repurpose
description: "Turn one long video (podcast, talk, tutorial, interview, YouTube video) into several standalone Reels, each with its own hook, captions and CTA. Use when the user gives a long recording and asks for clips, shorts, Reels, highlights or 'cut this into pieces'."
argument-hint: "[brand] [long video] [number of Reels]"
---
# Repurpose a long video into Reels

## 1. Ingest once
1. Make a parent project: `python tools/new_reel.py <brand> <topic>-source`, and put the long video in its `raw/`.
2. Transcribe the whole thing in source time: `python tools/transcribe.py <parent> --input raw/<video> --offset 0` (Tamil/Tanglish: `--model medium`).
3. Probe it, and make a contact sheet every 10 s to see the visuals: `ffmpeg -v error -i raw/<video> -vf "fps=1/10,scale=160:-2,tile=8x8" -frames:v 1 work/contact.png`.

## 2. Pick the moments (default 5, or what was asked)
Read the transcript and choose self-contained moments of 20–45 s. Each one needs:
- a strong **opening line**: a claim, number, question or story beat (it becomes the hook, so it must work without context)
- **one idea**, start to finish, with no dependency on earlier context
- a **natural end**: a punchline, lesson or strongest sentence
Rank the moments by hook strength and by value to the brief's goal. Show a table: # · source in–out · hook line · why it works · proposed CTA. **Wait for the user to choose** before cutting.

## 3. Build each Reel
For each approved moment:
1. Make a child project: `python tools/new_reel.py <brand> <topic>-clip<N>`. Copy (or hard-link) the source video into its `raw/`. Write `words.json` with only that range's words, shifted to start at 0.
2. Jump-cut it: `python tools/trim_silence.py <child> --source raw/<video>` (pauses > 0.4 s and fillers removed, punch-ins added). Then set the `in`/`out` of the first and last segments so the moment starts on the hook line and ends cleanly.
3. Write a hook caption for 0–1.5 s if the spoken opening needs help (on-screen text), and an end-card CTA. Follow **reels-craft**.
4. **captions** → **preview** → **reel-qc**.

## 4. Deliver
Previews for all the clips at once, in a short table: clip · length · hook · CTA · anything flagged. After approval, **final** for each one. Keep the clips consistent: same caption style, same end card, same loudness.
