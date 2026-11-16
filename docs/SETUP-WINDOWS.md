# Set up the Weequb Reels editor on Windows 10/11

This takes about 30–45 minutes, once. At the end you'll be making your first Reel by talking to Claude.

How it fits together: **Claude Code** runs in a terminal on your PC and uses the **reels-editor** agent in this repo. The agent runs the **pipeline** (Python + FFmpeg) to edit, and drives **Google Flow** through **flow-mcp** (its own Chrome window) to generate AI B-roll.

> Keep everything **out of OneDrive folders** (Desktop and Documents are often synced): use `C:\Users\<you>\...` directly.
> The PC must stay **awake with the screen on** while Flow generates. flow-mcp really clicks in that Chrome window.

---

## 1. Install the tools (PowerShell)

Open **PowerShell** (Start → type "PowerShell") and paste:

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Python.Python.3.12 -e
winget install --id Gyan.FFmpeg -e
winget install --id Google.Chrome -e
winget install --id ImageMagick.ImageMagick -e   # optional
```

**Close PowerShell and open it again**, so the new commands are found, then check:

```powershell
git --version; node --version; python --version; ffmpeg -version
```
Node must be **22 or newer** and Python **3.11 or newer**. If `python` opens the Microsoft Store, go to *Settings → Apps → Advanced app settings → App execution aliases*, turn off the two "python" aliases, and reopen PowerShell.

## 2. Install Claude Code and sign in

```powershell
irm https://claude.ai/install.ps1 | iex
```
(or `npm install -g @anthropic-ai/claude-code`). Then run `claude` once and sign in with your Claude account. Type `/exit` to leave.

## 3. Get the repo and run the setup (Git Bash)

From now on, use **Git Bash** (Start → "Git Bash"). Claude Code uses it too.

```bash
cd ~
git clone https://github.com/vishnucatalyst-tech/Video-Editor.git
cd Video-Editor
bash scripts/setup.sh
```
The repo is private, so the first `git clone` opens a GitHub sign-in window. Use the GitHub account that has access.
`setup.sh` creates the Python environment (`~/reels-env`), installs the Python packages and the Remotion template, then runs a health check. Everything should show ✓. A few ! warnings (for example fonts) are fine.

From then on, in any new Git Bash window: `cd ~/Video-Editor && source scripts/activate.sh`. The agent does this by itself.

## 4. Connect Google Flow (flow-mcp)

```bash
cd ~
git clone https://github.com/GTAI-1/flow-mcp.git
cd flow-mcp
npm install
npm run build
npm run login
```
`npm run login` opens a **separate Chrome window**:
1. Sign in to Google **yourself** with **weequbtechnologies@gmail.com**. The tool never sees your password.
2. Open Flow (it should already be on flow.google.com) and create a project.
3. Leave that Chrome window open.

Register it with Claude Code (one line, still in Git Bash):
```bash
claude mcp add --scope user flow -- node "$(cygpath -m ~/flow-mcp/dist/index.js)"
```
Check: `cd ~/Video-Editor && claude`, then type `/mcp`. **flow** should be listed and connected.

Note: flow-mcp is an unofficial tool that automates Flow's website. Google may not allow that, so it's your decision for this account. Flow gives 50 credits a day, and more on paid plans. The agent shows the credit use and asks before generating.

## 5. Add a music track

Put one **licensed** music track (one you have the rights to: your own, a purchased track, or a library such as YouTube Audio Library or Pixabay Music, checking each track's licence) somewhere handy, e.g. `~/Music/promo-track.mp3`. You'll hand it to the agent in the next step.

## 6. Make your first Reel

```bash
cd ~/Video-Editor
claude
```
Then paste this (edit the parts in brackets as you like):

> Make my first Weequb Reel. Goal: get DMs for our Reels-editing service. 15 seconds, Instagram Reel 9:16. **All visuals are AI B-roll generated in Google Flow with the flow tools**: 5–6 shots, modern and premium, our yellow and black brand colours. No voiceover: on-screen captions carry the script. Hook: "Stop scrolling!". CTA on a clean end card: "DM us to start". Music: [~/Music/promo-track.mp3]. Use the demo brand values for now. Ask me your questions first.

What happens next (you approve at each ⏸):
1. **Brief:** the agent fills the 12-point brief and asks up to 5 questions.
2. **Shot list + prompts ⏸:** B-roll shots with Flow prompts in `work/broll-prompts.md`, plus 5 hook options and the credit estimate.
3. **Generation:** flow-mcp creates the clips in your Chrome window. Watch it work; keep the PC awake. The clips are copied into `raw/`.
4. **Edit plan ⏸:** a shot-by-shot table, with cuts on the music beat.
5. **Preview ⏸:** captions plus a small 540×960 preview to watch on your phone. The agent also checks frames for AI glitches, safe zones and the hook.
6. **Final:** `brands/weequb/projects/<date>_<topic>/export/` gets `final.mp4` (1080×1920, Instagram-ready), `cover.jpg`, `captions.srt` and `edit-log.md`.

Ask for changes in plain words ("make shot 3 shorter", "bigger captions", "new hook"). The agent saves lasting preferences, so you only say them once.
Before real client work, run `/brand-onboard weequb` with the real logo, colours and fonts.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `python` / `python3` not found, or the Store opens | Turn off the App execution aliases (step 1), reopen Git Bash, run `bash scripts/setup.sh` again |
| Health check: `ffmpeg --enable-libass ✗` | You have a minimal FFmpeg build. `winget install --id Gyan.FFmpeg -e` installs the full build; reopen the terminal |
| `/mcp` doesn't show flow, or flow fails to start | Run `node ~/flow-mcp/dist/index.js` in Git Bash to see the error. Rebuild with `cd ~/flow-mcp && npm run build`. Check that the path in `claude mcp add` is correct |
| Flow tools say "not signed in" | `cd ~/flow-mcp && npm run login`, sign in by hand in that Chrome window, and keep it open |
| `EPERM` / files missing under Desktop or Documents | The folder is synced by OneDrive. Move the repo and flow-mcp to `C:\Users\<you>\` |
| Captions show empty boxes for Tamil | Set `caption_font: Noto Sans Tamil` in `brands/<brand>/BRAND.md` |
| First transcription is slow | The Whisper model downloads once (a few hundred MB). Later runs are faster |
| Anything else | Run `python tools/doctor.py` (after `source scripts/activate.sh`) and paste the output to Claude |
