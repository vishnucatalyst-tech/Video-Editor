# Premium motion: Weequb's locked element flow

**Status: approved by the user on 2026-11-16 ("this flow is perfect").** Every new icon, element or motion-graphics Reel for Weequb uses these components and timings. Add content; don't change the motion.

| File | What it is |
|---|---|
| `premium.css` | Components: backdrop (`pm-bg`, `pm-orb`, `pm-grain`), `glass`, type (`pm-kicker`, `pm-setup`, `pm-key`), icon card (`pm-card`, `pm-ic`), logo lockup (`pm-logo`, `pm-sweep`, `pm-brand`), CTA pill (`pm-cta`) |
| `premium.js` | Motion: `PM.enter`, `PM.drawIcon`, `PM.scene` (transitions), `PM.ambient`, `PM.logo`; icon set `PM.ICONS`; builders `PM.card`, `PM.grain`; locked timings `PM.T` |
| `sfx.py` | Sound kit: whoosh / tick / boom / chime and an ambient pad, placed from a cue list |
| `render.js` | Renders any scene page to 1080x1920 30 fps mp4 |
| `example.html` + `example.cues.json` | The approved 5 s reference (hook → 3 icon cards → logo + CTA). Start every new one by copying these. |

## The flow (locked)
1. **Hook scene (0–1.55 s):** setup line (`pm-setup`, y 400) enters at −0.25 s so it's visible on frame 0; the key word (`pm-key`, accent yellow, y 490) enters at 0.15 s; a glass panel showing the problem (y 820) enters at 0.35 s.
2. **Transition:** zoom-through blur. The outgoing scene scales to 1.10, blurs to 22 px and fades over 0.35 s, while the incoming scene settles from 1.06 → 1.0 in the same 0.35 s. No hard cuts or wipes.
3. **Element scene:** a kicker label (y 420), then icon cards at y 540 + 230·i, **0.28 s apart**. Each card enters over 1.0 s and its icon stroke draws on from +0.15 to +0.85 s.
4. **End scene:** logo blur-in with scale 0.86 → 1 (0.9 s), light sweep 0.4 s later, brand name, kicker, then the CTA pill.
5. **Every entrance:** blur 14 px → 0, rise 30–90 px, scale 0.96 → 1, ease-out expo (no bounce). After landing, every element keeps drifting up 6 px/s, and the background glows drift all the time.
6. **Sound, one per event:** whoosh 0.3 s before each transition, tick at each element's entrance + 0.35 s, boom at logo + 0.05 s, chime at CTA + 0.1 s, quiet pad underneath.

## Making a new one
```
cp templates/premium-motion/example.html brands/<brand>/projects/<project>/scenes/scene.html   # fix the relative paths to premium.css/js and the logo
cp templates/premium-motion/example.cues.json brands/<brand>/projects/<project>/scenes/cues.json
# edit words, CARDS rows (icon from PM.ICONS), and move cues to match the entrance times
node templates/premium-motion/render.js <scene.html> <seconds+0.5> <project>/raw/01_scene.mp4
python templates/premium-motion/sfx.py <cues.json> <project>/raw/music.wav
python tools/render.py <project> --preview      # cutlist: one segment, "captions": null, "logo": false
```
New icons go into `PM.ICONS` in the same style (24×24, stroke only, round caps). New components go into `premium.css` and reuse `glass`, the type classes and `PM.enter`.
