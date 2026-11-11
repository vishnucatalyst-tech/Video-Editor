import { describe, expect, it } from 'vitest';
import { makeClip, makeTrack } from './defaults';
import {
  closeGaps,
  fadeFactor,
  findFreeStart,
  formatTime,
  neighbourBounds,
  overlaps,
  projectDuration,
  snapTime,
  sourceTime,
  splitClip,
  trimEnd,
  trimStart,
} from './timeline';
import type { Clip, Project } from '../types';

function projectWith(clips: Clip[]): Project {
  const track = makeTrack('video', 1);
  track.id = 'v1';
  return {
    settings: { name: 't', width: 1920, height: 1080, fps: 30, background: '#000' },
    assets: {},
    tracks: [track],
    clips: Object.fromEntries(clips.map((c) => [c.id, c])),
  };
}

const clip = (id: string, start: number, duration: number, extra: Partial<Clip> = {}) =>
  makeClip({ id, trackId: 'v1', start, duration, ...extra });

describe('splitClip', () => {
  it('splits into two halves with the right in-points', () => {
    const c = clip('a', 2, 10, { inPoint: 1 });
    const [l, r] = splitClip(c, 5, 'b')!;
    expect(l).toMatchObject({ id: 'a', start: 2, duration: 3, inPoint: 1 });
    expect(r).toMatchObject({ id: 'b', start: 5, duration: 7, inPoint: 4 });
  });

  it('accounts for clip speed', () => {
    const c = clip('a', 0, 10, { speed: 2 });
    const [, r] = splitClip(c, 4, 'b')!;
    expect(r.inPoint).toBe(8);
  });

  it('keeps fade-in on the left and fade-out on the right', () => {
    const c = clip('a', 0, 10, { fadeIn: 1, fadeOut: 2 });
    const [l, r] = splitClip(c, 5, 'b')!;
    expect([l.fadeIn, l.fadeOut, r.fadeIn, r.fadeOut]).toEqual([1, 0, 0, 2]);
  });

  it('refuses to split at or outside the edges', () => {
    const c = clip('a', 2, 10);
    expect(splitClip(c, 2, 'b')).toBeNull();
    expect(splitClip(c, 12, 'b')).toBeNull();
    expect(splitClip(c, 20, 'b')).toBeNull();
  });
});

describe('trimming', () => {
  it('trims the start and moves the in-point', () => {
    const c = clip('a', 5, 10, { inPoint: 3 });
    const t = trimStart(c, 7, 0, false);
    expect(t).toMatchObject({ start: 7, duration: 8, inPoint: 5 });
  });

  it('cannot trim the start before the source beginning', () => {
    const c = clip('a', 5, 10, { inPoint: 2 });
    const t = trimStart(c, 0, 0, false);
    expect(t.start).toBe(3);
    expect(t.inPoint).toBe(0);
  });

  it('cannot trim the start past a neighbour', () => {
    const c = clip('a', 5, 10, { inPoint: 5 });
    expect(trimStart(c, 1, 4, false).start).toBe(4);
  });

  it('extends stills freely but limits media to source length', () => {
    const c = clip('a', 0, 5, { inPoint: 2 });
    expect(trimEnd(c, 100, Infinity, 10, false).duration).toBe(8);
    expect(trimEnd(c, 100, Infinity, undefined, true).duration).toBe(100);
    expect(trimEnd(c, 100, 20, undefined, true).duration).toBe(20);
  });
});

describe('placement', () => {
  const p = projectWith([clip('a', 0, 5), clip('b', 10, 5)]);

  it('detects overlaps', () => {
    expect(overlaps(p, 'v1', 4, 2, new Set())).toBe(true);
    expect(overlaps(p, 'v1', 5, 5, new Set())).toBe(false);
    expect(overlaps(p, 'v1', 4, 2, new Set(['a']))).toBe(false);
  });

  it('finds the nearest free slot', () => {
    expect(findFreeStart(p, 'v1', 6, 3)).toBe(6);
    expect(findFreeStart(p, 'v1', 3, 3)).toBe(5);
    expect(findFreeStart(p, 'v1', 9, 6)).toBe(15);
  });

  it('reports neighbour bounds', () => {
    expect(neighbourBounds(p, p.clips.a)).toEqual([0, 10]);
    expect(neighbourBounds(p, p.clips.b)).toEqual([5, Infinity]);
  });

  it('closes gaps', () => {
    const q = projectWith([clip('a', 2, 5), clip('b', 10, 5)]);
    const u = closeGaps(q, 'v1');
    expect(u.a.start).toBe(0);
    expect(u.b.start).toBe(5);
  });

  it('computes project duration', () => {
    expect(projectDuration(p)).toBe(15);
  });
});

describe('helpers', () => {
  it('snaps within the threshold only', () => {
    expect(snapTime(4.95, [0, 5, 10], 0.1)).toEqual({ time: 5, target: 5 });
    expect(snapTime(4.5, [0, 5, 10], 0.1)).toEqual({ time: 4.5, target: null });
  });

  it('computes fade envelopes', () => {
    const c = clip('a', 10, 10, { fadeIn: 2, fadeOut: 4 });
    expect(fadeFactor(c, 10)).toBe(0);
    expect(fadeFactor(c, 11)).toBe(0.5);
    expect(fadeFactor(c, 15)).toBe(1);
    expect(fadeFactor(c, 18)).toBe(0.5);
  });

  it('maps timeline time to source time', () => {
    expect(sourceTime(clip('a', 10, 5, { inPoint: 2, speed: 2 }), 12)).toBe(6);
  });

  it('formats timecodes', () => {
    expect(formatTime(0, 30)).toBe('00:00:00');
    expect(formatTime(61.5, 30)).toBe('01:01:15');
    expect(formatTime(3661, 25)).toBe('1:01:01:00');
  });
});
