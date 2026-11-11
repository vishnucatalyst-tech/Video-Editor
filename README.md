# Weequb Reels

Claude Code set up as a short-form (Reels) video editing workstation for Weequb Technologies.

Once it's set up, every brand edit works the same way: drop footage into a project, paste the Creative Director prompt into `brief.md`, and run the slash commands to get a finished 1080×1920 Reel. Each Reel comes with a cover frame, an SRT file and an edit log.

`CLAUDE.md` holds the editing rules: the output spec, the workflow, the quality rules and how Claude should communicate. Claude Code reads it automatically in every session started in this folder.

## Setup (once per machine)

### 1. Machine prerequisites

| Tool | Why | Mac (Homebrew) | Windows (winget) |
|---|---|---|---|
| Node.js 20+ and npm | Claude Code, Remotion | `brew install node` | `winget install OpenJS.NodeJS.LTS` |
| Python 3.11+ | helper scripts | `brew install python@3.12` | `winget install Python.Python.3.12` |
| FFmpeg + FFprobe (with libx264, libx265, AAC, libass, libfreetype) | cutting, scaling, captions, export | `brew install ffmpeg` | `winget install Gyan.FFmpeg` (full build) |
| Git | versioning briefs, cut lists and logs | `brew install git` | `winget install Git.Git` |
| ImageMagick | thumbnails, overlays | `brew install imagemagick` | `winget install ImageMagick.ImageMagick` |

**Fonts:** the starter set is already in `fonts/`: Inter, Montserrat, Poppins, Bebas Neue, Noto Sans Tamil and Mukta Malar, all under the OFL licence. The tools hand these to FFmpeg directly, so you don't need to install them system-wide. Brand fonts go in `brands/<brand>/assets/fonts/`.

### 2. Claude Code

```bash
npm install -g @anthropic-ai/claude-code
claude          # once, to log in
```

Auto-approve only the safe tools: file reads, file writes inside `brands/`, and the editing commands (`ffmpeg`, `ffprobe`, `python tools/…`). Leave destructive commands on manual approval.

`templates/claude-settings.json` is a ready-made rule set. If you want it, review it and copy it to `.claude/settings.json`.

### 3–4. Python environment and Remotion

```bash
bash scripts/setup.sh        # creates ~/reels-env, installs requirements.txt and the Remotion template, runs the doctor
source ~/reels-env/bin/activate
python tools/doctor.py       # re-check any time
```

- **Python packages:** faster-whisper (word-level subtitles in English and Tamil), scenedetect (finds cut points), librosa (beats), moviepy, OpenCV and Pillow (overlays and effects), and yt-dlp (downloading reference Reels for study only, never for reuse).
- **Remotion:** the guide's `npx create-video` step is already done. The project is in `templates/remotion/` with the captions, media-utils, transitions and google-fonts packages installed. It renders animated captions (word pop, karaoke highlight) as a transparent overlay at 1080×1920. Open the studio with `npm run studio` inside that folder.

## Folder structure

```
Weequb-Reels/  (this repo)
  CLAUDE.md              global editing rules
  .claude/commands/      slash commands
  tools/                 Python/FFmpeg helpers (probe, transcribe, cutlist, captions, render, cover, doctor)
  templates/             BRAND.md, brief.md, Remotion captions project, optional Claude settings
  fonts/                 shared fonts (OFL)
  music/                 licensed tracks, one folder per mood   (audio git-ignored)
  sfx/                   whooshes, pops, risers                 (audio git-ignored)
  brands/<brand>/
    BRAND.md             brand bible + the settings the tools read
    assets/logo, assets/fonts, assets/music
    projects/YYYY-MM-DD_<topic>/
      raw/               original footage, voiceover, images     (git-ignored)
      brief.md           the Creative Director prompt
      work/              cutlist.json/md, words.json, previews
      export/            final.mp4, cover.jpg, captions.srt, edit-log.md
  web-editor/            optional browser timeline editor for hands-on tweaks
```

## Slash commands

| Command | What it does |
|---|---|
| `/brand-onboard <brand>` | Asks the brand questions and writes `BRAND.md`, including the front-matter settings the tools use |
| `/new-reel <brand> <topic>` | Creates the dated project folder, copies the brief template, and probes `raw/` |
| `/transcribe` | Runs faster-whisper on the voiceover and writes word-level `words.json` plus `captions.srt` |
| `/cutlist` | Detects scenes and music beats, then drafts `cutlist.md` and `cutlist.json` with a hook in the first 1.5 s |
| `/captions` | Builds brand-styled captions: pop, karaoke or minimal, via libass, or `--remotion` for animated captions |
| `/preview` | Renders a 540×960 preview from the cut list, for approval |
| `/final` | Full-quality export: H.264 at CRF 18, AAC at 192k, two-pass loudness normalisation to −14 LUFS, plus cover frame, SRT and edit log |

### What the renderer does

- **Framing:** vertical sources are cover-cropped to 9:16. Anything else gets a blurred background fill (or a centre crop if `fill: crop` is set). Footage is never stretched.
- **Edits:** punch-ins on emphasis words, a slow Ken Burns push on stills, and the brand LUT if one is set.
- **Overlays:** captions inside the Instagram safe zones (250 px top, 320 px bottom, 60 px sides), and an optional logo.
- **Audio:** music is ducked by 14 dB under speech, with short ramps. Speech timing comes from the transcript, or from silence detection on the voiceover. There's a 0.3 s audio fade in and out, and the loudness is measured and normalised in two passes.

## 9. Verification checklist

Test with any 30-second phone clip:

1. `/new-reel test-brand smoke-test` creates the folder. Drop the clip into `raw/`.
2. `/transcribe` produces an SRT with sensible Tamil or English text.
3. `/cutlist` lists cuts and a hook.
4. `/preview` plays correctly on your phone in 9:16.
5. `/final` gives a 1080×1920 MP4 that Instagram accepts without re-encoding warnings.

`bash scripts/smoke_test.sh` runs steps 1 and 3–5 on generated test media. It's useful after an update and is also run in CI. Step 2 needs a real voiceover, and the Whisper model downloads on its first run.

If all five pass, the workstation is ready and brand onboarding can begin.

## 10. What comes next

The Creative Director (Claude, in the Project) will provide three things:

- a reference library of Reels broken down by hook, pacing and visual style,
- a skills roadmap for the editor, and
- a prompt for every edit, which you paste into that project's `brief.md`.

## Development

```bash
python -m unittest discover tests      # tool unit tests
bash scripts/smoke_test.sh             # end-to-end render check
(cd templates/remotion && npx tsc -p .)
(cd web-editor && npm test && npm run build)
```
