# Style DNA — premium-elements (APPROVED — locked 2026-11-16)

**Source:** https://www.instagram.com/reel/DfZEYA8PBUu/ — could not be downloaded (Instagram blocked from this environment).
**Status: APPROVED & LOCKED (2026-11-16).** The user approved the rendered flow ("this flow is perfect, use exactly this structure and these components"). The values below are now the standard, implemented in `templates/premium-motion/`. They were built from the user's description, not measured from the reference. Re-run `tools/analyze_reference.py <file> --name premium-elements` once the video file is shared, then replace the estimates.

User's words (Tamil, summarised): premium transitions; premium elements and icons; elements move in slow motion; every element enters calmly with no distraction; each entrance has a matching SFX; the whole video feels premium — use this kind of premium template / design structure.

## Guide (≈15 bullets)
1. **Pacing:** calm — a new element every 0.25–0.5 s, but scenes hold 1.5–2 s; average "shot" (scene) ≈ 1.7 s. *(est.)*
2. **Entrances:** blur 14 px → 0, rise 40–90 px, scale 0.96 → 1, opacity 0 → 1 over 0.8–1.1 s with ease-out-expo (fast start, long soft settle). Never bounce/overshoot.
3. **Slow motion:** after landing, every element keeps drifting (~6 px/s up, scale +1 %/s); background glows drift continuously. Nothing is ever fully still.
4. **Stagger:** grouped elements (cards, icons) enter one by one, 0.25–0.3 s apart.
5. **Transitions:** zoom-through blur dissolve — outgoing scene scales to 1.08–1.10 and blurs to ~22 px over 0.35 s while the next scene settles from 1.06 → 1.0. No hard cuts, no flashy wipes.
6. **Hook:** text-first; first words already visible at frame 0, key word lands by 0.5 s in accent colour.
7. **Elements:** glassmorphism cards (translucent white 3–10 %, 1.5 px light border, 40 px radius, deep soft shadow), dark charcoal/navy background, two large blurred colour glows, subtle film grain (≈7 %).
8. **Icons:** thin line icons (2.2 px stroke, rounded caps) in an accent-tinted rounded square; the stroke draws itself on (0.7 s) as the card lands.
9. **Typography:** two-weight pairing — light/medium sans for setup lines, heavy display for the key word; wide letter-spacing (8–10 px) for small kicker labels.
10. **Colour:** near-black base, one accent (brand yellow) used sparingly, low-saturation secondary glow (blue).
11. **SFX:** one sound per event — soft filtered whoosh into each transition, glass tick on each element landing, low boom on the logo, light chime on the CTA. Quiet bed underneath.
12. **Music:** ambient pad / minimal, no heavy drums; SFX carry the rhythm. *(est.)*
13. **Text placement:** centred, inside safe zones; generous negative space.
14. **Ending:** logo reveal with light sweep, brand name, then CTA pill (outline accent).
15. **Captions:** none burned in — on-screen text is designed typography, not subtitles. *(est.)*

## Settings to reuse
- `pacing: calm`-ish motion but scene holds ≤ 2 s; `max_shot_seconds: 2`
- No pipeline captions (`captions: null`); text is designed into the motion-graphics layer.
- Punch-ins: none — replaced by continuous slow drift.
- Music: ambient pad, `duck_db` only if a VO is added (−14).
- Motion template (locked): `templates/premium-motion/` — components, timings (`PM.T`), icon set, SFX kit and the approved `example.html`.

## Tool gaps
- The cut-list pipeline can't animate elements itself; premium motion is built as HTML scenes rendered with Playwright, then fed in as clips.
- Slow-motion of real footage (speed ramps, optical flow) isn't in `render.py` yet.
