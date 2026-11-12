---
name: reels-workflow
description: "End-to-end Weequb Reels editing workflow — use whenever someone asks to edit, cut, make, render, fix or revise an Instagram Reel / short video for a brand (raw footage, voiceover, a long video to clip, or a Creative Director brief in hand), or asks \"what's next\" on a Reel project. Orchestrates the other reels skills in order with approval gates."
argument-hint: "[brand] [topic or project path]"
---
# Weequb Reels — end-to-end workflow

You are running the Reels pipeline in this repo. `CLAUDE.md` holds the binding output spec and quality rules. This skill is the order of operations: load the skill named at each stage, because it holds the exact commands and checks.

Always start with `source ~/reels-env/bin/activate` and work from the repo root. If a tool is missing, run `python tools/doctor.py` and report what to install. Don't improvise substitutes.

## 0. Know the taste before touching anything
Read these, in this precedence, every time:
`brands/<brand>/BRAND.md` (front matter, prose, "Learned preferences") → its linked style reference in `knowledge/references/` → `knowledge/editor-preferences.md` → **reels-craft** (+ `taste-dictionary.md`).
Never make the user repeat a preference that's already recorded.

## 1. Project + brief
- New Reel → **new-reel**. Unknown brand, or BRAND.md still DEMO/TBD → **brand-onboard** first (unless the user says to proceed with placeholders; then say so in every summary).
- A long video to cut into several Reels → **repurpose** instead of the steps below.
- **reel-brief**: fill the 12-point `brief.md` and ask up to 5 questions for anything missing. Wait for the answers. Don't invent the creative.
- The user shares a reference video ("like this one") → **style-dna** first.

## 2. Probe → 3. Transcribe
**new-reel** (probe), then **transcribe**. For talking-head footage, transcribe the clip in source time (`--input raw/<clip> --offset 0`), then jump-cut it with `tools/trim_silence.py` (pauses > 0.4 s and filler words out, punch-ins on alternate pieces).

## 4. Content pass → edit plan (two gates)
1. **Content pass** (story only, no visuals yet): what to cut, what order, and **5 hook options** (each under 7 words) with a recommendation. STOP for approval.
2. **Edit plan**: **cutlist** (+ **reels-craft**), presented as the table *Time | Source clip | Visual / action | Caption / on-screen text | Audio* (`python tools/export_edit.py <project>` writes it to `export/edit-plan.md`). STOP for approval. If the user asks, offer 3 versions (safe / bold / experimental).

## 5. Captions + preview
**captions** → **preview** → **reel-qc** on the preview frames. Present the preview and the QC findings, then STOP for approval.

## 6. Final + deliverables
Only after approval: **final** → **reel-qc** on the export. If the user or team edits in an app, add **app-handoff** (EDL, SRT, plan, CapCut/Premiere/DaVinci steps). Hand over the paths, length, loudness, and anything flagged.

## Revisions and learning
- Any reaction to a cut list, preview or final → **reel-feedback**: precise change, everything else unchanged, aiming to finish within 2–3 rounds, and save any lasting preference.
- The user wants to drag things themselves → **timeline-handoff** (web editor Open Reel / Save to Reel), then continue from step 5.
- The user shares learning material (PDF, notes, links, videos) or says "remember / always / never…" → **learn-editing**.

## Rules that never bend
- Approval gates: content pass → edit plan → preview → final. Never skip one silently.
- Never stretch footage, never reuse another brand's assets, music or fonts, and use only licensed music. Reference videos are for analysis only.
- Footage stays out of git (`raw/`, `work/`, `export/` media are ignored). Commit `brief.md`, `cutlist.json/md`, `words.json`, `edit-log.md` and knowledge files only when asked to save or commit.
- Keep updates short, show the commands you ran, explain the non-obvious cuts in one line each, and flag anything that would hurt the hook or the brand.
