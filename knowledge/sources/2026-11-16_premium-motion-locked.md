# 2026-11-16: Premium motion flow approved and locked

**Source:** the user's feedback in chat (Tamil) on the 5 s test `brands/weequb/projects/2026-11-16_premium-style-test/work/preview.mp4`.
The test was built from the user's description of a reference Reel (https://www.instagram.com/reel/DfZEYA8PBUu/), which couldn't be downloaded here.

**Summary:** The user said the element flow is perfect and must be kept. From now on, adding icons and elements must reuse exactly the current layout structure, element structure and components. Nothing new was asked for the motion itself; the request is to standardise it.

**Rules extracted → where they went**
- Lock the flow and reuse the same components → `templates/premium-motion/` (premium.css, premium.js, sfx.py, render.js, example.html, README.md); `brands/weequb/BRAND.md` › Learned preferences + Style reference
- Calm entrance spec (blur 14→0, rise, scale .96→1, ease-out expo 0.9–1.1 s, drift 6 px/s, stagger 0.28 s) → `PM.T` in premium.js; BRAND.md
- Zoom-through blur dissolve transitions (0.35 s) → `PM.scene`; BRAND.md
- One SFX per event (whoosh/tick/boom/chime + pad) → `sfx.py`; BRAND.md
- Layout grid (hook y 400/490/820, cards y 540 + 230·i, logo y 560, CTA y 1170) → `example.html`, README; BRAND.md
- Style guide status estimated → approved → `knowledge/references/premium-elements/style.md`

**Verification:** `example.html` rendered with the library matches the approved test render at an average PSNR of 57 dB (visually identical).
