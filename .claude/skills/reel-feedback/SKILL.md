---
name: reel-feedback
description: "Apply the user's feedback on a Reel precisely (where, what, how much; everything else unchanged) and learn from it so the same correction is never needed again. Use whenever the user reacts to a cut list, preview or final — 'too slow', 'captions too small', 'change the hook', 'at 0:07 cut earlier' — in English, Tamil or Tanglish."
argument-hint: "[project] [feedback]"
---
# Reel feedback → precise change → lasting lesson

## 1. Pin the feedback down
Rewrite each point as **where** (timestamp or element), **what**, and **how much**, and list what must stay unchanged.
- Specific ("0:07–0:12 cut feels late, trim 0.4 s earlier") → apply directly.
- Vague ("it feels slow", "make it better", "I don't like the captions") → translate with `../reels-craft/taste-dictionary.md`, then confirm in one line before changing: *"I'll take the average shot from 2.4 s to 1.5 s and punch in at 0:03, 0:08 and 0:12 — OK?"*. If it can't be translated, ask one sharp question. For hook complaints, offer 5 alternative hooks under 7 words each.
- Feedback with timestamps refers to the **rendered** timeline. Map it back to segments in `work/cutlist.json`: cumulative segment durations give the timeline position, and `words.json` covers caption times.

## 2. Make the smallest change
Edit `work/cutlist.json` and/or `work/words.json` only where needed, and keep `work/cutlist.md` in step. Caption text or timing changed → **captions**. Then **preview** → **reel-qc**, and show only what changed, with before/after timestamps. Aim to be done within 2–3 rounds. If round 3 is still off, step back and ask for a reference video (**style-dna**) instead of guessing again.

## 3. Learn from it (the important part)
For every piece of feedback, decide whether it was:
- **one-off**, about this video's content ("cut the sponsor mention") → nothing to learn;
- **brand preference** ("our captions are always yellow on numbers only") → add to `brands/<brand>/BRAND.md` under "Learned preferences" (front-matter value too, if a tool setting covers it);
- **editor taste** across brands ("I hate slow fades", "max 2 words per caption line") → add to `knowledge/editor-preferences.md`;
- **craft rule** that any good editor would follow → **reels-craft**.

Also treat feedback as a preference when the same kind of correction comes up a second time, even across projects. Check `knowledge/editor-preferences.md` and the brand's learned preferences before every edit: never make the user say it twice.
Write each lesson as one line with numbers, dated, e.g. `- 2026-11-12: captions max 2 words/line, size 94 (was 3 words/78) — from feedback on demo-promo`. Mention it in your reply: *"Saved: captions max 2 words per line for all Weequb Reels."*

## 4. Reply
Changes made (where → what), the new preview path, the lesson(s) saved and where, and the next decision for the user.
