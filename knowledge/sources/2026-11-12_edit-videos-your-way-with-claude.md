# Edit Videos Your Way with Claude — The Briefing Guide

- **Type:** PDF guide, 9 pages (author listed as "Divas"), shared by the user on 2026-11-12
- **Summary (our words):** Claude acts like a senior editor who only knows what it's told, so edit quality follows brief quality. The guide gives a 12-point brief (goal, platform, audience, raw material, structure, pacing, captions, audio, visuals, brand, must keep/cut, deliverable), a master prompt that ends with "ask me up to 5 questions first", a dictionary that turns taste words into numbers, a Style DNA method for capturing a reference video's style, a staged workflow (brief → story → plan → captions → build → revise with timestamps, max 2–3 rounds), deliverables per editing app, rules for precise feedback, power prompts (3 versions, explain the cut, critique, loopable, repurpose), three example briefs, ten common mistakes, and a pre-send checklist.

## Rules extracted → where they went
| Rule | Went to |
|---|---|
| 12-point brief; points 1–5 required; ask ≤ 5 questions, never assume; pre-send checklist | `.claude/skills/reel-brief/SKILL.md`, `templates/brief.md` |
| Taste words → numbers (fast, cinematic, clean, premium, viral, tutorial, documentary, podcast, warm, moody) | `.claude/skills/reels-craft/taste-dictionary.md` |
| Always offer 5 hook options; ad / talking-head / tutorial structures; loopable endings; 3 versions; explain cuts; critique rough cuts | `.claude/skills/reels-craft/SKILL.md` |
| Content pass (cut / order / hooks, no visuals) before the edit plan; plan table Time · Source · Visual · Caption · Audio | `.claude/skills/reels-workflow/SKILL.md`, `tools/export_edit.py` |
| Feedback = where + what + how much + what stays; max 2–3 rounds | `.claude/skills/reel-feedback/SKILL.md` |
| Save the style guide and preferences so nothing is explained twice | `.claude/skills/learn-editing/SKILL.md`, `knowledge/editor-preferences.md` |
| Style DNA from reference videos (15 bullets, with numbers) | `.claude/skills/style-dna/SKILL.md`, `tools/analyze_reference.py` |
| Deliverables per tool (CapCut steps, Premiere/DaVinci cut list + markers + colour values + export settings, SRT) | `.claude/skills/app-handoff/SKILL.md`, `tools/export_edit.py` (EDL + plan + SRT) |
| Remove silences > 0.4 s and filler words; jump cut on every pause; punch-in on key words | `tools/trim_silence.py` |
| Repurpose a long video into 5 short clips, each with its own hook and CTA | `.claude/skills/repurpose/SKILL.md` |
| Mention safe zones and length limits; forbidden words; disclaimers | already in `CLAUDE.md`; red flags in reels-craft; `templates/BRAND.md` |

## Not adopted / adapted
- "Claude cannot guarantee a finished MP4": in this repo the pipeline does render MP4s, so the workflow renders a 540×960 preview first instead of handing over only a plan.
- "Watch like a human": we measure footage (probe, scene and beat detection, transcripts) and look at extracted frames. The QC and style skills require real frame checks.
- SFX on text, non-hard-cut transitions and B-roll overlays → logged as tool gaps in `knowledge/INDEX.md`.
