import { describe, expect, it } from 'vitest';
import { cutlistToProject, groupPhrases, projectToCutlist, wordsForCaption, type CutList, type Word } from './reel';
import type { MediaAsset, Project } from '../types';

const asset = (id: string, source: string, kind: MediaAsset['kind'], duration = 10): MediaAsset => ({
  id, name: source.split('/').pop()!, kind, mimeType: '', duration, width: 1080, height: 1920, source,
});

const assets: Record<string, MediaAsset> = {
  a: asset('a', 'raw/zoom.mp4', 'video', 5),
  b: asset('b', 'raw/wide.mp4', 'video', 6),
  c: asset('c', 'raw/card.png', 'image', 5),
  m: asset('m', 'raw/music.wav', 'audio', 20),
};
const bySrc = (src: string) => Object.values(assets).find((x) => x.source === src);

const cut: CutList = {
  length: 6,
  fps: 30,
  keep_source_audio: false,
  voiceover: null,
  music: { src: 'raw/music.wav', in: 0, gain_db: 0, duck_db: 0 },
  captions: 'work/captions.mov',
  logo: { from: 0, to: 4 },
  beats: [0, 0.5, 1],
  segments: [
    { src: 'raw/zoom.mp4', in: 1, out: 2.5, note: 'hook' },
    { src: 'raw/wide.mp4', in: 0, out: 2.5, note: '', punch_in: 1.1 },
    { src: 'raw/card.png', in: 0, out: 2, note: 'end', still: true },
  ],
};
const words: Word[] = [
  { word: 'Stop', start: 0.05, end: 0.6 },
  { word: 'scrolling!', start: 0.6, end: 1.45 },
  { word: 'Raw', start: 1.6, end: 2.0 },
  { word: 'clips', start: 2.0, end: 2.4 },
  { word: 'in.', start: 2.4, end: 3.9 },
];

function open(): Project {
  const { project, missing } = cutlistToProject(cut, words, bySrc, 'demo');
  expect(missing).toEqual([]);
  return { ...project, assets };
}

describe('Reel bridge', () => {
  it('lays segments end to end on a Shots track with notes and punch-ins', () => {
    const p = open();
    const shots = Object.values(p.clips).filter((c) => c.assetId && assets[c.assetId].kind !== 'audio').sort((x, y) => x.start - y.start);
    expect(shots.map((s) => [s.start, s.duration, s.inPoint])).toEqual([[0, 1.5, 1], [1.5, 2.5, 0], [4, 2, 0]]);
    expect(shots[0].note).toBe('hook');
    expect(shots[1].transform.scale).toBe(1.1);
    expect(shots.every((s) => s.volume === 0)).toBe(true); // keep_source_audio: false
    expect(p.settings).toMatchObject({ width: 1080, height: 1920, fps: 30 });
  });

  it('turns words into caption phrases', () => {
    expect(groupPhrases(words).map((g) => g.map((w) => w.word).join(' '))).toEqual(['Stop scrolling!', 'Raw clips in.']);
    const caps = Object.values(open().clips).filter((c) => c.text);
    expect(caps.map((c) => c.text!.text)).toEqual(['Stop scrolling!', 'Raw clips in.']);
  });

  it('round-trips without changes', () => {
    const { cutlist, words: w, warnings, newFiles } = projectToCutlist(open());
    expect(cutlist.segments).toEqual([
      { src: 'raw/zoom.mp4', in: 1, out: 2.5, note: 'hook', punch_in: 1 },
      { src: 'raw/wide.mp4', in: 0, out: 2.5, note: '', punch_in: 1.1 },
      { src: 'raw/card.png', in: 0, out: 2, note: 'end', punch_in: 1, still: true },
    ]);
    expect(cutlist.length).toBe(6);
    expect(cutlist.keep_source_audio).toBe(false);
    expect(cutlist.music).toMatchObject({ src: 'raw/music.wav', in: 0, gain_db: 0, duck_db: 0 });
    // Fields the editor doesn't model survive untouched.
    expect(cutlist.logo).toEqual({ from: 0, to: 4 });
    expect(cutlist.beats).toEqual([0, 0.5, 1]);
    expect(cutlist.captions).toBe('work/captions.mov');
    expect(w.map((x) => x.word)).toEqual(['Stop', 'scrolling!', 'Raw', 'clips', 'in.']);
    expect(warnings).toEqual([]);
    expect(newFiles).toEqual([]);
  });

  it('writes back edits: trims, reordering, caption text and new media', () => {
    const p = open();
    const clips = Object.values(p.clips);
    const zoom = clips.find((c) => c.note === 'hook')!;
    const wide = clips.find((c) => c.assetId === 'b')!;
    const cap = clips.find((c) => c.text?.text === 'Raw clips in.')!;
    // Swap the first two shots and trim the zoom shot by 0.5 s at its end.
    wide.start = 0;
    zoom.start = 2.5;
    zoom.duration = 1;
    cap.text = { ...cap.text!, text: 'Raw footage in.' };
    // A clip from media that isn't in raw/ yet.
    const extra: MediaAsset = { ...asset('x', '', 'video'), name: 'new.mp4', source: undefined };
    p.assets = { ...p.assets, x: extra };
    p.clips['new'] = { ...wide, id: 'new', assetId: 'x', start: 5.5, duration: 1, inPoint: 0, transform: { ...wide.transform, scale: 1 } };

    const { cutlist, words: w, warnings, newFiles } = projectToCutlist(p);
    expect(cutlist.segments.map((s) => [s.src, s.in, s.out])).toEqual([
      ['raw/wide.mp4', 0, 2.5],
      ['raw/zoom.mp4', 1, 2],
      ['raw/card.png', 0, 2],
      ['raw/new.mp4', 0, 1],
    ]);
    expect(cutlist.length).toBe(6.5);
    expect(w.filter((x) => x.start > 1.5).map((x) => x.word)).toEqual(['Raw', 'footage', 'in.']);
    expect(newFiles.map((f) => f.name)).toEqual(['new.mp4']);
    expect(warnings.some((x) => x.includes('Gap'))).toBe(true); // zoom now ends at 3.5, card still starts at 4
  });

  it('warns about things the pipeline cannot render', () => {
    const p = open();
    const zoom = Object.values(p.clips).find((c) => c.note === 'hook')!;
    zoom.speed = 2;
    zoom.transform = { ...zoom.transform, scale: 1.4, rotation: 10 };
    const { warnings, cutlist } = projectToCutlist(p);
    expect(cutlist.segments[0].punch_in).toBe(1.4);
    expect(warnings.join(' ')).toMatch(/Speed 2/);
    expect(warnings.join(' ')).toMatch(/above the 1.15/);
    expect(warnings.join(' ')).toMatch(/preview-only/);
  });

  it('spreads caption words across the clip', () => {
    const w = wordsForCaption('DM us now', 10, 2);
    expect(w[0].start).toBe(10);
    expect(w[2].end).toBe(12);
    expect(w.every((x, i) => i === 0 || x.start >= w[i - 1].start)).toBe(true);
  });
});
