# Taste dictionary — vague words → exact edit settings

People describe taste in feelings ("make it cinematic"). Translate each feeling into numbers before you edit, and say which translation you used so the user can adjust it. Defaults below; `BRAND.md` and `knowledge/editor-preferences.md` override them.

| They say… | Edit settings | Pipeline knobs |
|---|---|---|
| **Fast / energetic** | avg shot 1–2 s · jump cut on every breath · punch-in 110–120% every 3–4 s · beat-synced cuts · whoosh/pop SFX on text | `pacing: fast`, `max_shot_seconds: 2`, `punch_in: 1.1–1.15`, `caption_style: pop` |
| **Cinematic** | shots 3–6 s · ambient/orchestral music · warm highlights, cool shadows, slightly lower contrast · minimal text · soft fades or L-cuts | `pacing: calm`, `max_shot_seconds: 5`, `caption_style: minimal`, brand LUT |
| **Clean / minimal** | hard cuts only · one font, ≤ 2 colours · no emojis · no music with lyrics · lots of space around text | `caption_style: minimal`, `caption_case: sentence` |
| **Premium / luxury** | slow fades · soft music · thin elegant font · muted colours · slow subtle zooms · no flashy transitions, no shake | `pacing: calm`, thin `caption_font`, `caption_size: 64` |
| **Viral / trending** | hook in the first second · text on screen at 0:00 · word-by-word captions · pattern break every 3–5 s · loopable ending | first caption at 0.0 s, `caption_style: pop`, last line flows into the first |
| **Educational / tutorial** | screen recording with zoom on the clicked area · numbered steps on screen · 0.3 s pause after each key point · recap at the end | punch-ins on screen areas, numbered captions |
| **Documentary / storytelling** | B-roll over voice · lower-third name tags · room tone kept low · music builds slowly · emotional pause before the key line | `keep_source_audio: true` at low gain, `pacing: medium` |
| **Podcast clip** | speaker framing, punch-in on emphasis · big captions · waveform or progress bar · trim pauses > 0.4 s · end on the strongest sentence | `tools/trim_silence.py --max-gap 0.4`, `caption_size: 90` |
| **Warm, friendly** | warmth and saturation slightly up · natural skin · soft contrast · bright background · rounded font | LUT or colour grade warm, rounded `caption_font` (Poppins) |
| **Dark, moody** | lower exposure · crushed blacks · desaturated except one accent · slow music · sparse captions | `caption_style: minimal`, accent colour only on key words |
| **Raw / UGC / authentic** | handheld feel kept · hard cuts only · no stock music with vocals · captions in the speaker's language mix | no LUT, `keep_source_audio: true` |

## Numbers to always state
Average shot length (s) · punch-in % and how often · music level under voice (dB or %) · caption words per line, size, position, highlight colour · pause trimming threshold (s) · hook length (s) · total length (s).

## Conversions
- Music "at 15% under voice" ≈ −16 dB; "12%" ≈ −18 dB. Our default ducking is −14 dB (≈ 20%).
- Caption "20% bigger" → `caption_size` × 1.2 (78 → 94).
- "Cut every 1.5 s on average" → `max_shot_seconds: 2` and target segment lengths of 1–2 s in `cutlist.json`.
