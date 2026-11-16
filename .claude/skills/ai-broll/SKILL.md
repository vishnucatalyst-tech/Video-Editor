---
name: ai-broll
description: "Plan AI-generated B-roll for a Reel: find the shots the footage doesn't have, write ready-to-paste prompts for Grok Imagine (SuperGrok) and Google Flow (Veo), then import the clips the user downloads and cut them into the edit. Use when a Reel needs extra shots (product close-ups, mood, establishing, backgrounds for text) or the user mentions Grok, Flow, Veo or AI video."
argument-hint: "[project] [number of shots]"
---
# AI B-roll with Grok Imagine and Google Flow (subscription accounts)

The user has **subscriptions only** (SuperGrok, Google Flow), and neither has an official API. Two routes:
- **Flow, automatic, when the `flow_*` tools are available.** The user has installed **flow-mcp** on their own computer, signed into Google by hand in its Chrome window, and connected it to Claude Code. See "Connect Google Flow" in README.md. Use step 3b.
- **Manual, always available (Grok Imagine; Flow without flow-mcp).** The user generates in the app from your prompts. Use step 3a.
You never type, ask for or store a Google, X or other password, and you never sign into an account yourself. If the `flow_*` tools report a sign-in problem, ask the user to fix it in the flow-mcp Chrome window (`npm run login`). flow-mcp is unofficial automation of Flow; the user chose it for their own account.
If the user later gets API keys (xAI API, or the Gemini API for Veo), generation could be automated officially. Say so and ask before building it: API use is billed separately from the subscriptions.

## 1. Find the B-roll slots
From `brief.md`, `work/cutlist.json` and the transcript (`work/words.json`), list the shots the edit needs but the footage lacks: product close-up, a mood/establishing shot, a visual for an abstract line ("save hours every week"), a clean background behind text, a pattern break every 3–5 s in fast Reels.
For each slot, note: **ID** (B1, B2…), timeline position, **length needed** (usually 1.5–3 s on screen; generate 5–8 s so there's room to pick the best part), what's being said or shown there, and why the shot helps.

Audio warning: the renderer has no B-roll overlay yet. A B-roll segment *replaces* the shot and its source audio. Put B-roll where music or a voiceover carries the sound, or where the speaker's line isn't needed. For talking-head Reels that keep source audio, say so and pick slots between sentences. This is logged under "Tool gaps" in `knowledge/INDEX.md`.

## 2. Write the prompts → `work/broll-prompts.md`
One block per slot, with **both** versions so the user can pick whichever app gives the better result:

```
### B1 — 0:03–0:05 · product close-up · need 2 s (generate 6–8 s)
Grok Imagine (9:16):  <prompt>
Google Flow / Veo (portrait 9:16, audio off or ignored):  <prompt>
Save as: raw/broll_B1.mp4
```

Prompt recipe (one flowing sentence or two, concrete nouns, no jargon soup):
**subject + action** → **setting** → **camera** (slow push-in, orbit, top-down, handheld, locked-off) → **lighting** (soft window light, golden hour, studio rim light) → **look** (the brand palette from `BRAND.md` by colour name, warm/clean/moody per `reels-craft/taste-dictionary.md`) → **framing** (vertical 9:16, subject centred, empty space in the lower third for captions).
Always add: *no text, no letters, no logos, no watermarks*. Captions and the logo are added by the pipeline, and AI text comes out as gibberish.
Never ask for: real people's or celebrities' likeness, other brands' logos or products, copyrighted characters, or anything the brand bible forbids. Keep claims honest: no fake results or testimonials.
If there's a product, ask the user for a clean product photo. Both apps can animate an uploaded image (image-to-video), and that keeps the real product accurate.

Check `knowledge/broll-prompts.md` first: reuse prompt patterns that worked, and skip ones marked bad.

## 3a. Manual route: hand over to the user
Short steps: open Grok Imagine or Flow → choose **9:16 / portrait** → paste the prompt (attach the product photo if given) → generate 2–4 takes → download the best → name it as listed (`raw/broll_B1.mp4`) → drop it into the project's `raw/` folder → tell the agent.

## 3b. Automatic route: flow-mcp
1. Check that it's connected and signed in: `flow_status`. If it isn't signed in, stop and ask the user to sign in by hand (above).
2. Show the user the shot list and the expected credit use. Flow gives 50 free credits a day, and more on paid plans. Get an OK before queuing. **Always ask** before anything that shows no credit quote (agent mode, `flow_continue_shot`).
3. `flow_generate` with `project` = this Reel's folder name and one scene per slot: the Flow prompt from `work/broll-prompts.md`, **aspect ratio portrait / 9:16**, and the file name `broll_B1`… Attach the product photo where image-to-video was planned.
4. `flow_wait` until `finished` is true (it returns within about 40 s; call again). Then copy each returned file into the project: `cp "<path>" <project>/raw/broll_B1.mp4`. Failed jobs: `flow_retry` once, then report.
5. Continue with step 4. Use only the clips. flow-mcp also has its own captions, narration and assembly tools, but the Reel is still edited, captioned and rendered by this pipeline, so the brand style and the Instagram spec stay intact.

## 4. Import and cut in
1. `python tools/probe.py <project>`: check each `broll_*` file for 9:16 (or plan a crop), resolution (720p clips are upscaled, which is fine for 1–3 s of B-roll), and duration.
2. Look at the clip. Contact sheet: `ffmpeg -v error -i raw/broll_B1.mp4 -vf "fps=2,scale=160:-2,tile=8x2" -frames:v 1 work/contact_B1.png`. Pick the cleanest 1.5–3 s, and avoid AI artifacts: morphing hands or faces, warped text, flicker, and the first and last 0.5 s (often unstable).
3. Insert a segment into `work/cutlist.json` at the slot: `{"src": "raw/broll_B1.mp4", "in": <s>, "out": <s>, "punch_in": 1.0, "note": "AI B-roll B1 (Grok|Flow): <what>"}`. Shift or trim the neighbouring segments so the total length and the beat cuts still work. Keep `cutlist.md` in step.
4. **preview** → **reel-qc**. QC also checks the AI shots for artifacts, and that brand colours match the real footage.

## 5. Learn
After the user reacts, add each prompt to `knowledge/broll-prompts.md` with: date, brand, tool (Grok/Flow), the prompt, result ★1–5, and what to change. **learn-editing** rules apply: patterns that keep working become defaults.
