import type { Clip, Project, Track, TrackKind, AssetKind } from '../types';

export const MIN_CLIP_DURATION = 1 / 30;
export const DEFAULT_IMAGE_DURATION = 5;
export const DEFAULT_TEXT_DURATION = 4;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Total project length: the end of the last clip. */
export function projectDuration(project: Project): number {
  let end = 0;
  for (const c of Object.values(project.clips)) end = Math.max(end, c.start + c.duration);
  return end;
}

export function clipsOnTrack(project: Project, trackId: string): Clip[] {
  return Object.values(project.clips)
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.start - b.start);
}

export function clipEnd(c: Clip) {
  return c.start + c.duration;
}

export function isActiveAt(c: Clip, t: number) {
  return t >= c.start && t < c.start + c.duration;
}

/** Which track kind may hold a clip of a given asset kind. */
export function trackKindFor(asset: AssetKind | 'text'): TrackKind {
  if (asset === 'audio') return 'audio';
  if (asset === 'text') return 'text';
  return 'video';
}

/** Can a clip be moved onto this track? Text and image/video share visual tracks in the
 *  compositor, but we keep text on text tracks so the timeline stays readable. */
export function canPlaceOn(track: Track, kind: TrackKind) {
  return track.kind === kind;
}

/** The maximum duration a clip may have given its source media (Infinity for stills/text). */
export function maxSourceDuration(clip: Clip, sourceDuration: number | undefined, isStill: boolean) {
  if (isStill || sourceDuration === undefined) return Infinity;
  return (sourceDuration - clip.inPoint) / clip.speed;
}

/**
 * Snap a time to the nearest candidate within `threshold` seconds.
 * Returns the snapped value and the snap target (or null when no snap occurred).
 */
export function snapTime(t: number, candidates: number[], threshold: number): { time: number; target: number | null } {
  let best: number | null = null;
  let bestDist = threshold;
  for (const c of candidates) {
    const d = Math.abs(c - t);
    if (d <= bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best === null ? { time: t, target: null } : { time: best, target: best };
}

/** Snap points: 0, the playhead, and every clip edge (optionally excluding some clips). */
export function snapCandidates(project: Project, playhead: number, exclude: Set<string>): number[] {
  const pts = [0, playhead];
  for (const c of Object.values(project.clips)) {
    if (exclude.has(c.id)) continue;
    pts.push(c.start, c.start + c.duration);
  }
  return pts;
}

/**
 * Find a start time on `trackId` near `desired` where a clip of `duration` fits without
 * overlapping others. Prefers the desired position, otherwise the nearest free gap.
 */
export function findFreeStart(
  project: Project,
  trackId: string,
  desired: number,
  duration: number,
  ignore: Set<string> = new Set(),
): number {
  const others = clipsOnTrack(project, trackId).filter((c) => !ignore.has(c.id));
  desired = Math.max(0, desired);
  const fits = (s: number) =>
    s >= -1e-9 && others.every((o) => s + duration <= o.start + 1e-9 || s >= clipEnd(o) - 1e-9);
  if (fits(desired)) return desired;
  // Candidate positions: directly after each clip, or directly before each clip.
  const candidates: number[] = [];
  for (const o of others) {
    candidates.push(clipEnd(o));
    candidates.push(o.start - duration);
  }
  candidates.push(0);
  let best = Infinity;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (!fits(c)) continue;
    const d = Math.abs(c - desired);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  if (best === Infinity) {
    const last = others.length ? clipEnd(others[others.length - 1]) : 0;
    return last;
  }
  return best;
}

/** Whether a clip with the given placement would overlap another clip on that track. */
export function overlaps(project: Project, trackId: string, start: number, duration: number, ignore: Set<string>) {
  return clipsOnTrack(project, trackId).some(
    (o) => !ignore.has(o.id) && start < clipEnd(o) - 1e-9 && start + duration > o.start + 1e-9,
  );
}

/**
 * Split a clip at timeline time `t`. Returns the [left, right] halves or null if `t`
 * isn't strictly inside the clip.
 */
export function splitClip(clip: Clip, t: number, newId: string): [Clip, Clip] | null {
  const offset = t - clip.start;
  if (offset < MIN_CLIP_DURATION || clip.duration - offset < MIN_CLIP_DURATION) return null;
  const left: Clip = { ...clip, duration: offset, fadeIn: Math.min(clip.fadeIn, offset), fadeOut: 0 };
  const right: Clip = {
    ...clip,
    id: newId,
    start: t,
    duration: clip.duration - offset,
    inPoint: clip.inPoint + offset * clip.speed,
    fadeIn: 0,
    fadeOut: Math.min(clip.fadeOut, clip.duration - offset),
    transform: { ...clip.transform },
    color: { ...clip.color },
    text: clip.text ? { ...clip.text } : undefined,
  };
  return [left, right];
}

/**
 * Trim the left edge of a clip to a new timeline start. Keeps the right edge fixed and
 * moves the source in-point accordingly. Respects source bounds and neighbour limits.
 */
export function trimStart(clip: Clip, newStart: number, minStart: number, isStill: boolean): Clip {
  const end = clipEnd(clip);
  // Can't reveal media before the source start.
  const sourceLimit = isStill ? -Infinity : clip.start - clip.inPoint / clip.speed;
  const lo = Math.max(minStart, sourceLimit, 0);
  const s = clamp(newStart, lo, end - MIN_CLIP_DURATION);
  const delta = s - clip.start;
  return {
    ...clip,
    start: s,
    duration: end - s,
    inPoint: isStill ? 0 : clip.inPoint + delta * clip.speed,
  };
}

/** Trim the right edge of a clip to a new timeline end. */
export function trimEnd(clip: Clip, newEnd: number, maxEnd: number, sourceDuration: number | undefined, isStill: boolean): Clip {
  const sourceMax = clip.start + maxSourceDuration(clip, sourceDuration, isStill);
  const e = clamp(newEnd, clip.start + MIN_CLIP_DURATION, Math.min(maxEnd, sourceMax));
  const duration = e - clip.start;
  return { ...clip, duration, fadeIn: Math.min(clip.fadeIn, duration), fadeOut: Math.min(clip.fadeOut, duration) };
}

/** The neighbouring clip boundaries for a clip on its track: [prevEnd, nextStart]. */
export function neighbourBounds(project: Project, clip: Clip): [number, number] {
  let prevEnd = 0;
  let nextStart = Infinity;
  for (const o of clipsOnTrack(project, clip.trackId)) {
    if (o.id === clip.id) continue;
    if (clipEnd(o) <= clip.start + 1e-9) prevEnd = Math.max(prevEnd, clipEnd(o));
    else if (o.start >= clipEnd(clip) - 1e-9) nextStart = Math.min(nextStart, o.start);
  }
  return [prevEnd, nextStart];
}

/** Fade envelope (0..1) for a clip at timeline time t. */
export function fadeFactor(clip: Clip, t: number): number {
  const local = t - clip.start;
  let f = 1;
  if (clip.fadeIn > 0 && local < clip.fadeIn) f = Math.min(f, local / clip.fadeIn);
  const remaining = clip.duration - local;
  if (clip.fadeOut > 0 && remaining < clip.fadeOut) f = Math.min(f, remaining / clip.fadeOut);
  return clamp(f, 0, 1);
}

/** Map a timeline time to a source-media time for a clip. */
export function sourceTime(clip: Clip, t: number): number {
  return clip.inPoint + (t - clip.start) * clip.speed;
}

/** Remove the gap at `t` on a track by pulling later clips left ("ripple delete" of empty space). */
export function closeGaps(project: Project, trackId: string): Record<string, Clip> {
  const updated: Record<string, Clip> = {};
  let cursor = 0;
  for (const c of clipsOnTrack(project, trackId)) {
    if (c.start > cursor + 1e-9) updated[c.id] = { ...c, start: cursor };
    cursor = (updated[c.id]?.start ?? c.start) + c.duration;
  }
  return updated;
}

export function formatTime(t: number, fps = 30): string {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const totalFrames = Math.round(t * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h > 0 ? h + ':' : ''}${pad(m)}:${pad(s)}:${pad(frames)}`;
}

export function formatShort(t: number): string {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return m > 0 ? `${m}:${s.toFixed(0).padStart(2, '0')}` : `${s.toFixed(s < 10 && s % 1 ? 1 : 0)}s`;
}
