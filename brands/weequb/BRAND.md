---
# Machine-readable settings used by tools/ (edit values, keep keys). Colours are hex.
name: Weequb Technologies
primary_color: "#111111"
secondary_color: "#FFFFFF"
accent_color: "#FFD400"
text_color: "#FFFFFF"
headline_font: Montserrat
body_font: Inter
caption_font: Montserrat
caption_style: pop          # pop | karaoke | minimal
caption_case: upper         # upper | sentence
caption_size: 78            # px at 1080x1920
caption_color: "#FFFFFF"
caption_outline: "#000000"
caption_position: lower     # lower | middle | upper — move it if it would cover faces/product
pacing: fast                # fast (≤3 s shots) | medium (≤4 s) | calm (≤5 s)
max_shot_seconds: 3
fill: blur                  # blur (blurred background for non-9:16) | crop (smart centre crop)
logo: assets/logo/logo.png  # path inside this brand folder; leave blank for none
logo_position: top-right    # top-left | top-right | top-center
logo_width: 160
logo_opacity: 0.9
logo_when: always           # always | end (last 2 s only)
lut:                        # e.g. assets/brand.cube
music_mood: upbeat
tempo_range: 100-128
---

# Weequb Technologies — Brand Bible

> ⚠ DEMO VALUES — colours, fonts and the logo are placeholders used for the demo Reel.
> Run `/brand-onboard weequb` to replace them with the real brand bible.
>
> Filled in during `/brand-onboard` with the Creative Director. Everything below is read
> before every edit. Keep it current: when a Reel teaches you something, add it here.

## Brand
- **Name:** Weequb Technologies
- **Product / service:** Short-form video (Reels) editing for brands — TBD confirm
- **One-line positioning:**

## Audience
- **Age range:**
- **Language mix:** Tamil / English / Tanglish — and which script for captions (Tamil script or romanised)
- **Platform behaviour:** (when they watch, sound-on or sound-off, what they save/share)

## Tone
Three adjectives: **___, ___, ___** (e.g. bold, witty, premium)

## Colours
| Role | Hex | Use |
|---|---|---|
| Primary | | |
| Secondary | | |
| Accent | | caption highlight, CTA |
| Text | | |

## Fonts
- **Headline:**
- **Body:**
- **Caption style:** pop / karaoke / minimal — font files go in `assets/fonts/`

## Logo rules
- Placement, size, when it appears (always / end card only), clear space, never on faces.

## Music
- **Mood and tempo range:**
- **Licensed sources:** (only tracks we hold a licence for — list the licence/receipt location)

## Pacing
- fast / medium / calm · average shot length ___ s

## Hooks
- **Formulas that worked:**
- **Hooks to avoid:**

## Do / Don't
- **Do:**
- **Don't:**
- **Legal disclaimers** (pricing, health, finance, contests):

## Reference Reels
| Link | What to borrow |
|---|---|
| | |

## Style reference
- Style reference: knowledge/references/premium-elements/style.md (approved 2026-11-16). Motion graphics are built only with `templates/premium-motion/`.

## Learned preferences
<!-- Added automatically from feedback (reel-feedback / learn-editing). One rule per line, dated, with numbers. -->
- 2026-11-16: Premium element flow is LOCKED. Every icon/element/motion-graphics scene reuses `templates/premium-motion/` (premium.css, premium.js, sfx.py) and copies the layout of `example.html`: hook (setup line y 400, key word y 490, glass panel y 820) → icon cards at y 540 + 230·i → logo + CTA. Change words, icons and card count only. (source: user, "intha flow perfect-ah irukku… exact-ah intha structure, intha components use pannu")
- 2026-11-16: Entrances are calm: blur 14→0 px, rise 30–90 px, scale 0.96→1, ease-out expo over 0.9–1.1 s, no bounce; elements keep drifting 6 px/s after landing; grouped elements 0.28 s apart. (source: same)
- 2026-11-16: Scene changes are zoom-through blur dissolves (out: scale 1.10, blur 22 px, 0.35 s; in: 1.06→1). No hard cuts or flashy wipes in motion graphics. (source: same)
- 2026-11-16: One SFX per event: whoosh 0.3 s before each transition, glass tick at each landing (+0.35 s), low boom on the logo, chime on the CTA, quiet ambient pad under all. (source: same)
- 2026-11-16: Look: near-black base, gold + blue blurred glows, 7% grain, glass cards, thin line icons (2.2 stroke) that draw on, yellow used only for the key word, icon tiles and CTA. (source: same)
