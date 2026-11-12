# Knowledge index

Everything the Reels agent has learned, and where it went. Maintained by the **learn-editing**, **style-dna** and **reel-feedback** skills: one row per source.

| Date | Source | Type | What changed | Record |
|---|---|---|---|---|
| 2026-11-12 | *Edit Videos Your Way with Claude — The Briefing Guide* (PDF, 9 pp.) | guide | 12-point brief + intake questions (reel-brief), taste dictionary + structures + power moves + red flags (reels-craft), content-pass gate + edit-plan table (reels-workflow), precise feedback + learning (reel-feedback), app deliverables (app-handoff), Style DNA (style-dna), long → short clips (repurpose), silence/filler trimming (tools/trim_silence.py) | [sources/2026-11-12_edit-videos-your-way-with-claude.md](sources/2026-11-12_edit-videos-your-way-with-claude.md) |

## Style references
Saved style guides live in `references/<name>/style.md` (made by **style-dna**).

| Name | Source | Summary | Used by |
|---|---|---|---|
| — | | | |

## Tool gaps
Things the knowledge asks for that the pipeline can't render yet. Don't fake these: tell the user.
- **SFX on text pop-ups** (whoosh/pop): no SFX track in the renderer yet. Ask for licensed SFX in `sfx/` and add an `sfx` list to the cut list.
- **Transitions other than hard cuts** (fades, L-cuts, speed ramps): not supported by `render.py`. Shot-level fades are preview-only in the web editor.
- **B-roll overlays over a voice track** (picture-in-picture, cutaways while the A-roll audio continues): not supported yet. Today, shots replace each other and the audio follows the voiceover or source.
- **Progress bar / waveform overlay** for podcast clips: not built in. It could be added as a Remotion overlay.
- **Automatic colour matching between clips**: only the brand LUT is applied.
