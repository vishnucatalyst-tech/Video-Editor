---
name: reel-brief
description: "Turn a request or Creative Director prompt into a complete 12-point Reel brief (goal, platform, audience, raw material, structure, pacing, captions, audio, visuals, brand rules, must keep/cut, deliverable) and interview the user for gaps before any editing. Use at the start of every Reel, when brief.md is empty or vague, or when the user describes what they want in loose words."
argument-hint: "[project]"
---
# Reel brief: the quality of the edit = the quality of the brief

Run this before **cutlist**. The aim is a `brief.md` where every point is specific enough to edit from without guessing.

## 1. Gather what's already known
- The project's `brief.md`, using the 12-point template in `templates/brief.md`. Add the template's sections if the file uses the old layout.
- The brand's `BRAND.md` (front matter + prose + "Learned preferences"), and `knowledge/editor-preferences.md`.
- The raw material: `work/probe.json` (run `python tools/probe.py <project>` if missing), plus `work/words.json` if transcribed. Make a contact sheet of the footage and look at it: `ffmpeg -v error -i raw/<clip> -vf "fps=1/3,scale=200:-2,tile=6x3" -frames:v 1 work/contact_<clip>.png`.
- The user's message and any pasted Creative Director prompt.
- If the brief names a style reference, read `knowledge/references/<name>/style.md`.

## 2. Fill the 12 points
Write concrete values into `brief.md`, translating vague words with `../reels-craft/taste-dictionary.md`. Points 1–5 are required. For 6–12, fill from the brand and editor defaults and mark them "(default)" so the user can see what was assumed.

## 3. Ask, don't assume
If anything important is still missing or ambiguous, ask **up to 5 questions in one message**, most important first, each answerable in a few words, offering options where you can. Required gaps (goal, length, audience/language, CTA, must-keep) always get asked. Then **wait for the answers**. Don't start the cut list on guesses.

## 4. Checklist (all ✓ before /cutlist)
Goal stated · platform/aspect/length · audience + language · transcript or clip descriptions · clips named with notes · structure or "give me options" · pacing in numbers · caption + audio rules · brand colours/fonts/forbidden words · must keep / must cut · deliverable + tool.

## 5. Hand over
Show the filled brief in a compact list, plus your first reading: the goal → hook idea, and the CTA. Then continue with **reels-workflow** step 2. If the user gave a preference that applies beyond this Reel ("we never use emojis"), also run **learn-editing** so it sticks.
