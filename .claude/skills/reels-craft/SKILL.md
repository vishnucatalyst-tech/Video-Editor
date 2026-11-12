---
name: reels-craft
description: "Editing judgment for short-form Reels — hooks, pacing, beat cuts, punch-ins, caption wording, Tamil/English/Tanglish captions, music choice. Use when drafting or improving a cut list, writing on-screen text or a hook, or reviewing whether an edit is engaging."
---
# Reels craft — how a good Weequb Reel is cut

Apply these when you draft or revise `work/cutlist.json`, write caption text, or review an edit. Precedence: `BRAND.md` → `knowledge/editor-preferences.md` → these defaults. When someone describes taste in feelings ("fast", "cinematic", "premium"), translate it with [taste-dictionary.md](taste-dictionary.md) and say which numbers you used.

## Hook (0–1.5 s)
- The first frame must read with the sound off: strongest visual + the strongest 2–4 words on screen.
- Lead with the payoff, a question, a bold claim, or motion — never a logo, black frame, slow fade-in or "Hi guys".
- If the best moment is mid-clip, move it to the front (the cutlist tool does this) and cut away before it's spent.
- Always offer **5 hook options** (each under 7 words) drawn from the transcript/footage, and recommend one. Hooks that work: a bold claim, a "nobody tells you…", a number, a before/after, or the payoff shown first.

## Pacing
- Fast brands: a visual change at least every 3 s; average 1.2–2 s per shot. Calm/luxury: up to 5 s, slower moves.
- Cut on the beat (`work/cutlist.json` → `beats`). Land big changes on bar starts (every 4 beats).
- Vary shot sizes: wide → close → detail. Two similar shots back to back read as a jump cut — use a punch-in (1.05–1.15) instead.
- Keep total length inside the brief (default 7–30 s). Shorter beats longer: cut anything that doesn't serve the hook or CTA.

## Structure
- Promo (default): hook (0–1.5 s) → problem/tease → 2–4 proof shots → payoff → CTA on a clean end card (2–3 s, logo watermark off: `"logo": {"from": 0, "to": <end-card start>}`).
- Direct-response / UGC ad: pain-point hook (0–3 s) → agitate → simple solution → proof (one result or testimonial) → button-style CTA. No income claims or guarantees.
- Talking-head tips: hook → 3 numbered tips → "save this & follow" CTA. Jump cut on every pause (`tools/trim_silence.py`), punch-in 110–115% on key words.
- Tutorial: numbered steps on screen, zoom on the clicked area, 0.3 s pause after each key instruction, recap at the end.
- Loopable Reel (when asked, or for viral style): the last line or shot flows back into the first.

## Captions / on-screen text
- 2–4 words per caption beat, one idea per line, verbs first. Cut filler ("so", "basically", "you know").
- Keep inside safe zones (the tools do this). If a face or product sits in the lower third, use `--position upper` or `middle`.
- Tamil: Tamil script for Tamil audiences, romanised Tanglish only if the brand bible says so. Font must cover Tamil (Noto Sans Tamil, Mukta Malar). Check spelling of names and brand terms in `words.json` — Whisper often mangles them.
- Emphasis words (numbers, prices, "free", "new", the product name) get the accent colour (pop style does this per word) and ideally a punch-in.

## Audio
- Voice is king: music ducked 12–15 dB under speech (default −14), 0.3 s fades, −14 LUFS final.
- Music tempo should match pacing (fast: 110–128 BPM). Only licensed tracks from `music/` or the brand's `assets/music/`.

## Power moves (offer when useful)
- **3 versions**: safe, bold, experimental. Cut lists side by side in `work/cutlist_v{1,2,3}.json`; the user picks and mixes.
- **Explain the cut**: say *why* for the hook and every non-obvious decision, in one line each.
- **Critique a rough cut**: retention dips (shots > max length, dead air, late hook), weak moments, sound problems, all with timestamps.
- **Repurpose** a long video into several Reels with the **repurpose** skill.

## Red flags to call out
Hook later than 1.5 s · any shot > brand max · captions over faces/product · stretched or letterboxed footage · logo on screen the whole time *and* on the end card · CTA missing or under 1.5 s · music louder than voice · another brand's assets · no stated goal (it decides the hook and CTA) · vague taste words left untranslated · text near the edges or UI buttons (safe zones) · forbidden words or missing disclaimers from `BRAND.md`.
