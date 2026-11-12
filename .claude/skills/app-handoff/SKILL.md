---
name: app-handoff
description: "Deliver a Reel's edit for another editing app or person — timecoded edit-plan table, CMX3600 EDL (Premiere Pro, DaVinci Resolve, Final Cut), SRT captions, and click-by-click steps for CapCut / VN / InShot. Use when the user or a team member edits in an app instead of (or after) the pipeline, or asks for the edit plan, EDL, SRT or app steps."
argument-hint: "[project] [capcut|premiere|davinci|finalcut|vn]"
---
# App hand-off: the edit, in the format the editor's tool needs

## 1. Export
`source scripts/activate.sh && python tools/export_edit.py <project>` (add `--start-tc 01:00:00:00` for Premiere's default sequence start).
It writes `export/edit-plan.md`, `export/edit.edl` and `export/captions.srt` from `work/cutlist.json` and `work/words.json`. Clips are referenced by file name, so the editor relinks them to `raw/`.

## 2. Add the tool-specific layer
| Tool | Give them |
|---|---|
| **CapCut / VN / InShot** | `edit-plan.md` + `captions.srt`, plus numbered steps: import clips in plan order → trim each to its in–out → *Adjust › Scale* for punch-ins → *Text › Auto captions* or import the SRT → caption style (font, size, highlight colour from `BRAND.md`) → music at the stated level → *Export 1080p, 30 fps*. Add effect names to search for (e.g. "Zoom in", "Shake") only if the brief allows them. |
| **Premiere Pro** | `edit.edl` (*File › Import*, set the sequence to 1080×1920 @ fps), `captions.srt` (*File › Import*, drag to a captions track), marker list = the plan's Time column, Lumetri values if a colour look is set (exposure, contrast, temperature), export: H.264, 1080×1920, CRF/VBR ≈ 16–20 Mbps, AAC 192k, −14 LUFS (Loudness Normalization). |
| **DaVinci Resolve** | `edit.edl` (*File › Import › Timeline*, uncheck "automatically set project settings" if needed), SRT on a subtitle track, colour page values, Deliver: H.264 1080×1920, audio normalised to −14 LUFS. |
| **Final Cut Pro** | `edit.edl` via an EDL import tool (e.g. EDL-X) or the plan table, SRT captions, compound clip for the end card. |

## 3. Keep the brand rules in the hand-off
Spell out the safe zones (text ≥ 250 px from top, ≥ 320 px from bottom, ≥ 60 px from the sides), the caption style, the logo rules, the forbidden words and disclaimers from `BRAND.md`, and the output spec from `CLAUDE.md`, so the result matches what the pipeline would have produced.

## 4. Report
List the files with their paths, the 3–6 steps that matter most for their tool, and what they should send back (an exported MP4 for **reel-qc**, or their timeline notes for **reel-feedback**).
