import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Clip, MediaAsset, Project, ProjectSettings, Track, TrackKind } from '../types';
import { defaultTextStyle, emptyProject, makeClip, makeTrack } from '../lib/defaults';
import {
  DEFAULT_IMAGE_DURATION,
  DEFAULT_TEXT_DURATION,
  clipsOnTrack,
  closeGaps,
  findFreeStart,
  isActiveAt,
  projectDuration,
  splitClip,
  trackKindFor,
} from '../lib/timeline';
import { mediaRegistry } from '../lib/mediaRegistry';

const HISTORY_LIMIT = 200;
const COALESCE_MS = 600;

interface EditorState {
  project: Project;
  selection: string[];
  playhead: number;
  playing: boolean;
  /** Timeline zoom in pixels per second. */
  zoom: number;
  snapping: boolean;
  past: Project[];
  future: Project[];
  /** Snapshot taken at the start of a drag gesture so the whole drag is one undo step. */
  gestureBase: Project | null;
  lastCommit: { key: string; at: number } | null;

  // history
  commit: (fn: (p: Project) => Project, coalesceKey?: string) => void;
  beginGesture: () => void;
  updateLive: (fn: (p: Project) => Project) => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;

  // project
  newProject: () => void;
  loadProject: (p: Project) => void;
  updateSettings: (patch: Partial<ProjectSettings>) => void;

  // assets
  addAsset: (asset: MediaAsset) => void;
  removeAsset: (id: string) => void;

  // tracks
  addTrack: (kind: TrackKind) => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  moveTrack: (id: string, dir: -1 | 1) => void;

  // clips
  addAssetToTimeline: (assetId: string, trackId?: string, start?: number) => string | null;
  addTextClip: (start?: number) => string | null;
  updateClip: (id: string, patch: Partial<Clip>, coalesceKey?: string) => void;
  splitAtPlayhead: () => void;
  deleteSelected: (ripple?: boolean) => void;
  duplicateSelected: () => void;
  closeTrackGaps: (trackId: string) => void;

  // view
  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  setPlayhead: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setZoom: (z: number) => void;
  setSnapping: (s: boolean) => void;
}

const changed = (a: Project, b: Project) => a !== b;

export const useEditor = create<EditorState>((set, get) => ({
  project: emptyProject(),
  selection: [],
  playhead: 0,
  playing: false,
  zoom: 80,
  snapping: true,
  past: [],
  future: [],
  gestureBase: null,
  lastCommit: null,

  commit: (fn, coalesceKey) => {
    const { project, past, lastCommit } = get();
    const next = fn(project);
    if (!changed(project, next)) return;
    const now = Date.now();
    const coalesce = coalesceKey && lastCommit && lastCommit.key === coalesceKey && now - lastCommit.at < COALESCE_MS;
    set({
      project: next,
      past: coalesce ? past : [...past, project].slice(-HISTORY_LIMIT),
      future: [],
      lastCommit: coalesceKey ? { key: coalesceKey, at: now } : null,
    });
  },

  beginGesture: () => set({ gestureBase: get().project }),

  updateLive: (fn) => {
    const next = fn(get().project);
    if (next !== get().project) set({ project: next });
  },

  endGesture: () => {
    const { gestureBase, project, past } = get();
    if (gestureBase && gestureBase !== project) {
      set({ past: [...past, gestureBase].slice(-HISTORY_LIMIT), future: [], lastCommit: null });
    }
    set({ gestureBase: null });
  },

  undo: () => {
    const { past, future, project } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], lastCommit: null });
    pruneSelection();
  },

  redo: () => {
    const { past, future, project } = get();
    if (!future.length) return;
    const next = future[0];
    set({ project: next, past: [...past, project], future: future.slice(1), lastCommit: null });
    pruneSelection();
  },

  newProject: () => {
    mediaRegistry.clear();
    set({ project: emptyProject(), selection: [], playhead: 0, playing: false, past: [], future: [] });
  },

  loadProject: (p) => set({ project: p, selection: [], playhead: 0, playing: false, past: [], future: [] }),

  updateSettings: (patch) =>
    get().commit((p) => ({ ...p, settings: { ...p.settings, ...patch } }), 'settings:' + Object.keys(patch).join()),

  addAsset: (asset) => get().commit((p) => ({ ...p, assets: { ...p.assets, [asset.id]: asset } })),

  removeAsset: (id) => {
    get().commit((p) => {
      const assets = { ...p.assets };
      delete assets[id];
      const clips = Object.fromEntries(Object.entries(p.clips).filter(([, c]) => c.assetId !== id));
      return { ...p, assets, clips };
    });
    pruneSelection();
  },

  addTrack: (kind) =>
    get().commit((p) => {
      const count = p.tracks.filter((t) => t.kind === kind).length + 1;
      const track = makeTrack(kind, count);
      return { ...p, tracks: insertTrack(p.tracks, track) };
    }),

  removeTrack: (id) => {
    get().commit((p) => ({
      ...p,
      tracks: p.tracks.filter((t) => t.id !== id),
      clips: Object.fromEntries(Object.entries(p.clips).filter(([, c]) => c.trackId !== id)),
    }));
    pruneSelection();
  },

  updateTrack: (id, patch) =>
    get().commit((p) => ({ ...p, tracks: p.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

  moveTrack: (id, dir) =>
    get().commit((p) => {
      const i = p.tracks.findIndex((t) => t.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.tracks.length) return p;
      const tracks = [...p.tracks];
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
      return { ...p, tracks };
    }),

  addAssetToTimeline: (assetId, trackId, start) => {
    const { project } = get();
    const asset = project.assets[assetId];
    if (!asset) return null;
    const kind = trackKindFor(asset.kind);
    let track = trackId ? project.tracks.find((t) => t.id === trackId && t.kind === kind) : undefined;
    let p = project;
    if (!track) {
      // Prefer the bottom-most visual track (main track) or the first audio track.
      const candidates = p.tracks.filter((t) => t.kind === kind && !t.locked);
      track = kind === 'video' ? candidates[candidates.length - 1] : candidates[0];
    }
    if (!track) {
      track = makeTrack(kind, 1);
      p = { ...p, tracks: insertTrack(p.tracks, track) };
    }
    const duration = asset.kind === 'image' ? DEFAULT_IMAGE_DURATION : asset.duration;
    // Without an explicit position, append to the end of the chosen track.
    const desired = start ?? clipsOnTrack(p, track.id).reduce((e, c) => Math.max(e, c.start + c.duration), 0);
    const s = findFreeStart(p, track.id, desired, duration);
    const clip = makeClip({ trackId: track.id, assetId, start: s, duration });
    get().commit(() => ({ ...p, clips: { ...p.clips, [clip.id]: clip } }));
    set({ selection: [clip.id] });
    return clip.id;
  },

  addTextClip: (start) => {
    let p = get().project;
    let track = p.tracks.find((t) => t.kind === 'text' && !t.locked);
    if (!track) {
      track = makeTrack('text', 1);
      p = { ...p, tracks: insertTrack(p.tracks, track) };
    }
    const s = findFreeStart(p, track.id, start ?? get().playhead, DEFAULT_TEXT_DURATION);
    const clip = makeClip({ trackId: track.id, start: s, duration: DEFAULT_TEXT_DURATION, text: defaultTextStyle() });
    get().commit(() => ({ ...p, clips: { ...p.clips, [clip.id]: clip } }));
    set({ selection: [clip.id] });
    return clip.id;
  },

  updateClip: (id, patch, coalesceKey) =>
    get().commit((p) => {
      const c = p.clips[id];
      if (!c) return p;
      return { ...p, clips: { ...p.clips, [id]: { ...c, ...patch } } };
    }, coalesceKey ?? `clip:${id}:${Object.keys(patch).join()}`),

  splitAtPlayhead: () => {
    const { project, playhead, selection } = get();
    const lockedTracks = new Set(project.tracks.filter((t) => t.locked).map((t) => t.id));
    // Split selected clips under the playhead, or all clips under it if none selected.
    let targets = Object.values(project.clips).filter((c) => isActiveAt(c, playhead) && !lockedTracks.has(c.trackId));
    const selectedTargets = targets.filter((c) => selection.includes(c.id));
    if (selectedTargets.length) targets = selectedTargets;
    if (!targets.length) return;
    const newSel: string[] = [];
    get().commit((p) => {
      const clips = { ...p.clips };
      for (const c of targets) {
        const halves = splitClip(c, playhead, nanoid(10));
        if (!halves) continue;
        clips[halves[0].id] = halves[0];
        clips[halves[1].id] = halves[1];
        newSel.push(halves[1].id);
      }
      return { ...p, clips };
    });
    set({ selection: newSel });
  },

  deleteSelected: (ripple = false) => {
    const { selection, project } = get();
    if (!selection.length) return;
    const locked = new Set(project.tracks.filter((t) => t.locked).map((t) => t.id));
    get().commit((p) => {
      const clips = { ...p.clips };
      const removed: Clip[] = [];
      for (const id of selection) {
        const c = clips[id];
        if (!c || locked.has(c.trackId)) continue;
        removed.push(c);
        delete clips[id];
      }
      if (ripple) {
        // Shift later clips on the same track left by the removed duration.
        for (const r of removed.sort((a, b) => b.start - a.start)) {
          for (const c of Object.values(clips)) {
            if (c.trackId === r.trackId && c.start >= r.start + r.duration - 1e-9) {
              clips[c.id] = { ...c, start: Math.max(0, c.start - r.duration) };
            }
          }
        }
      }
      return { ...p, clips };
    });
    set({ selection: [] });
  },

  duplicateSelected: () => {
    const { selection } = get();
    if (!selection.length) return;
    const newIds: string[] = [];
    get().commit((p) => {
      let next = p;
      for (const id of selection) {
        const c = next.clips[id];
        if (!c) continue;
        const start = findFreeStart(next, c.trackId, c.start + c.duration, c.duration);
        const copy: Clip = {
          ...c,
          id: nanoid(10),
          start,
          transform: { ...c.transform },
          color: { ...c.color },
          text: c.text ? { ...c.text } : undefined,
        };
        newIds.push(copy.id);
        next = { ...next, clips: { ...next.clips, [copy.id]: copy } };
      }
      return next;
    });
    set({ selection: newIds });
  },

  closeTrackGaps: (trackId) =>
    get().commit((p) => {
      const updated = closeGaps(p, trackId);
      if (!Object.keys(updated).length) return p;
      return { ...p, clips: { ...p.clips, ...updated } };
    }),

  select: (ids) => set({ selection: ids }),
  toggleSelect: (id) => {
    const sel = get().selection;
    set({ selection: sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id] });
  },
  setPlayhead: (t) => {
    const max = Math.max(projectDuration(get().project), 0);
    set({ playhead: Math.max(0, Math.min(t, max)) });
  },
  setPlaying: (playing) => set({ playing }),
  setZoom: (z) => set({ zoom: Math.max(5, Math.min(600, z)) }),
  setSnapping: (snapping) => set({ snapping }),
}));

/** Text tracks go on top, new video tracks above existing video tracks, audio at the bottom. */
function insertTrack(tracks: Track[], track: Track): Track[] {
  const next = [...tracks];
  if (track.kind === 'audio') next.push(track);
  else if (track.kind === 'text') next.unshift(track);
  else {
    const firstVideo = next.findIndex((t) => t.kind === 'video');
    const firstAudio = next.findIndex((t) => t.kind === 'audio');
    const at = firstVideo !== -1 ? firstVideo : firstAudio !== -1 ? firstAudio : next.length;
    next.splice(at, 0, track);
  }
  return next;
}

function pruneSelection() {
  const { selection, project } = useEditor.getState();
  const next = selection.filter((id) => project.clips[id]);
  if (next.length !== selection.length) useEditor.setState({ selection: next });
}

export const selectedClip = (s: { selection: string[]; project: Project }): Clip | undefined =>
  s.selection.length === 1 ? s.project.clips[s.selection[0]] : undefined;
