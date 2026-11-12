# Web Editor (companion)

An optional browser-based timeline editor for hands-on tweaks alongside the command-line Reels pipeline in the repo root. Run it from this folder.

A multi-track video editor that runs entirely in the browser. Media never leaves your machine: everything is decoded, previewed, composited and exported locally.

Built with React, TypeScript, Vite and Zustand. There is no backend.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script              | What it does                         |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the dev server with hot reload |
| `npm run build`     | Type-check and build to `dist/`      |
| `npm run preview`   | Serve the production build           |
| `npm test`          | Run unit tests (Vitest)              |
| `npm run typecheck` | Type-check only                      |

`dist/` is a static site, so you can deploy it to any static host (Netlify, Vercel, GitHub Pages, S3, …).

## Editing a Weequb Reel project

**Open Reel** loads a pipeline project folder (`raw/` + `work/cutlist.json` + `work/words.json`) as a timeline: a Shots track, a Captions track, and Music/Voiceover tracks. **Save to Reel** writes the edits back as `cutlist.json` and `words.json`, ready for `/captions` and `/final`. Chrome and Edge save straight into the folder through the File System Access API, and remember the folder across reloads. Other browsers download the two files instead. The conversion lives in `src/lib/reel.ts`, with tests in `src/lib/reel.test.ts`; the folder I/O is in `src/lib/reelIO.ts`. See the repo root README for the full workflow.

## Features

**Media**
- Import video, audio and images with the Import button or by dropping files anywhere on the window
- Thumbnails, durations and audio waveforms in the media bin
- Drag media onto a track, or double-click to append it to the timeline

**Timeline**
- Unlimited video, text and audio tracks. Upper tracks render on top.
- Move clips, including between tracks of the same kind. A clip dropped onto another slides into the nearest free gap.
- Trim clips from either edge (limited to the source media length)
- Split at the playhead, delete, ripple delete, duplicate, and close the gaps on a track
- Snaps to clip edges and the playhead (toggle with `N`)
- Zoom with Ctrl/⌘ + scroll, the zoom slider or Fit
- Per-track hide, mute, lock and reorder
- Undo and redo for every edit. A drag, or a run of slider changes, counts as one undo step.

**Clip properties** (Inspector panel)
- Position, scale, rotation and opacity. You can also drag clips directly in the preview, and Alt + scroll in the preview resizes the selected clip.
- Fit and Fill presets
- Brightness, contrast, saturation and blur
- Speed (0.25× to 4×), volume (0 to 200%), and fade in and fade out (applied to both video and audio)
- Text clips: content (multi-line), font, size, weight, alignment, colour and an optional background box

**Project**
- Canvas presets: 1080p, 720p, 4K, vertical 9:16, square and 4:5, plus custom sizes. Frame rates from 24 to 60 fps. Background colour.
- Autosave to IndexedDB, including the media files, so a reload restores your session
- Save and open the timeline as a `.json` project file. Media missing from the browser shows as offline and can be relinked.
- Export the current frame as a PNG

**Export**
- MP4 (H.264 with AAC or Opus) or WebM (VP9 or VP8 with Opus), depending on what the browser's `MediaRecorder` supports
- Rendered at the full project resolution and frame rate, with draft, standard and high quality presets
- Exported WebM files get proper duration metadata, so players can seek in them

## Keyboard shortcuts

| Key                         | Action                         |
| --------------------------- | ------------------------------ |
| Space / K                   | Play / pause                   |
| ← / →                       | Step one frame                 |
| Shift + ← / →, J / L        | Step one second                |
| Home / End                  | Go to start / end              |
| S / B                       | Split at playhead              |
| Delete                      | Delete selected clips          |
| Shift + Delete              | Ripple delete                  |
| Ctrl/⌘ + D                  | Duplicate                      |
| Ctrl/⌘ + A                  | Select all clips               |
| Ctrl/⌘ + Z, Ctrl/⌘ + Shift + Z | Undo, redo                  |
| T                           | Add text at playhead           |
| N                           | Toggle snapping                |
| + / −                       | Zoom timeline                  |
| Ctrl/⌘ + E                  | Export                         |
| ?                           | Show shortcuts                 |

## Architecture

```
src/
  types.ts                 Project data model (assets, tracks, clips, settings)
  store/editor.ts          Zustand store: all edit operations, selection, undo/redo history
  lib/timeline.ts          Pure timeline maths: split, trim, snap, overlap, fades, timecode
  lib/media.ts             File probing: metadata, thumbnails, waveform peaks
  lib/mediaRegistry.ts     Media blobs and object URLs, kept outside the serialisable state
  lib/persist.ts           IndexedDB storage for the project and media
  lib/autosave.ts          Session restore, debounced autosave, project JSON import/export
  engine/engine.ts         Playback and render engine (see below)
  components/              Toolbar, MediaBin, Preview, Inspector, Timeline, ExportDialog
  hooks/                   Keyboard shortcuts
```

**Engine.** The engine keeps one `<video>`, `<audio>` or `<img>` element per timeline clip. On every animation frame it:

1. advances the playhead clock,
2. seeks, plays or pauses each element to match the playhead (pre-rolling clips that are about to start),
3. sets each clip's gain through a WebAudio graph (volume × fade × track mute), and
4. composites every visible clip onto a `<canvas>`, from the bottom track up, applying transforms, opacity and CSS filters.

Export runs the same pipeline against a full-resolution canvas. It records `canvas.captureStream()` and the WebAudio mix with `MediaRecorder`.

## Limitations

- **Export runs in real time.** A 2-minute project takes about 2 minutes to export. Keep the tab open and visible while it runs.
- Which formats you can import and export depends on the browser's codecs. Chrome and Edge support the most, including MP4 export. Firefox exports WebM. Safari doesn't support colour filters on the canvas.
- Very large files are kept in memory and in IndexedDB, so storage quota limits apply.
