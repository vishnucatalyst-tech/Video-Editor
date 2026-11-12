/**
 * Two-way bridge between the editor and a Weequb Reel project folder
 * (brands/<brand>/projects/<date_topic>/ with raw/, work/cutlist.json, work/words.json).
 *
 * cutlist.json  → "Shots" video track (one clip per segment, in order) + Voiceover/Music audio tracks
 * words.json    → "Captions" text track (one text clip per spoken/on-screen phrase)
 * …and back again, so the pipeline (`/captions`, `/final`) renders what was edited here.
 */
import { nanoid } from 'nanoid';
import type { Clip, MediaAsset, Project, Track } from '../types';
import { defaultSettings, defaultTextStyle, makeClip } from './defaults';

export interface CutSegment {
  src: string;
  in: number;
  out: number;
  note?: string;
  punch_in?: number;
  still?: boolean;
}

export interface CutList {
  length?: number;
  fps?: number;
  keep_source_audio?: boolean;
  source_audio_gain_db?: number;
  voiceover?: { src: string; offset?: number; gain_db?: number } | null;
  music?: { src: string; in?: number; gain_db?: number; duck_db?: number } | null;
  captions?: string | null;
  segments: CutSegment[];
  [key: string]: unknown;
}

export interface Word {
  word: string;
  start: number;
  end: number;
  prob?: number;
}

/** Caption text clips sit in the lower third, inside Instagram's bottom safe zone (as the pipeline places them). */
export const CAPTION_Y = 0.22;
const round = (n: number) => Math.round(n * 1000) / 1000;
const dbToGain = (db: number | undefined) => Math.min(2, Math.max(0, Math.pow(10, (db ?? 0) / 20)));
const gainToDb = (g: number) => (g <= 0 ? -60 : round(20 * Math.log10(g)));

/** Group words into caption phrases: break at pauses, at sentence ends followed by a pause, or every 8 words. */
export function groupPhrases(words: Word[]): Word[][] {
  const out: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    if (!w.word.trim()) continue;
    if (cur.length) {
      const prev = cur[cur.length - 1];
      const gap = w.start - prev.end;
      if (gap > 0.35 || (/[.!?]$/.test(prev.word.trim()) && gap > 0.1) || cur.length >= 8) {
        out.push(cur);
        cur = [];
      }
    }
    cur.push(w);
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Spread a caption's words across its clip: words pop in over the first part, the last one holds to the end. */
export function wordsForCaption(text: string, start: number, duration: number): Word[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const reveal = Math.min(1.2, duration * 0.6);
  const step = reveal / tokens.length;
  return tokens.map((word, i) => ({
    word,
    start: round(start + i * step),
    end: round(i === tokens.length - 1 ? start + duration : start + (i + 1) * step - 0.02),
    prob: 1,
  }));
}

/** Build an editor project from a cut list. `assetFor` resolves a cut-list src path to an imported asset. */
export function cutlistToProject(
  cut: CutList,
  words: Word[],
  assetFor: (src: string) => MediaAsset | undefined,
  name: string,
): { project: Omit<Project, 'assets'>; missing: string[] } {
  const missing = new Set<string>();
  const mk = (kind: Track['kind'], trackName: string): Track => ({ id: nanoid(8), kind, name: trackName, muted: false, hidden: false, locked: false });
  const captions = mk('text', 'Captions');
  const shots = mk('video', 'Shots');
  const tracks: Track[] = [captions, shots];
  const clips: Record<string, Clip> = {};
  const add = (c: Clip) => (clips[c.id] = c);

  const sourceGain = cut.keep_source_audio === false ? 0 : dbToGain(cut.source_audio_gain_db);
  let t = 0;
  for (const seg of cut.segments) {
    const dur = round(seg.out - seg.in);
    const asset = assetFor(seg.src);
    if (!asset) missing.add(seg.src);
    add(
      makeClip({
        trackId: shots.id,
        assetId: asset?.id,
        start: round(t),
        duration: dur,
        inPoint: asset?.kind === 'image' ? 0 : seg.in,
        volume: sourceGain,
        transform: { x: 0, y: 0, scale: seg.punch_in && seg.punch_in > 1 ? seg.punch_in : 1, rotation: 0 },
        note: seg.note || undefined,
      }),
    );
    t += dur;
  }
  const length = round(t);

  for (const phrase of groupPhrases(words)) {
    const start = phrase[0].start;
    const end = Math.max(phrase[phrase.length - 1].end, start + 0.2);
    add(
      makeClip({
        trackId: captions.id,
        start: round(start),
        duration: round(end - start),
        text: { ...defaultTextStyle(), text: phrase.map((w) => w.word.trim()).join(' '), fontSize: 78, fontWeight: 800 },
        transform: { x: 0, y: CAPTION_Y, scale: 1, rotation: 0 },
      }),
    );
  }

  if (cut.voiceover?.src) {
    const vo = mk('audio', 'Voiceover');
    tracks.push(vo);
    const asset = assetFor(cut.voiceover.src);
    if (!asset) missing.add(cut.voiceover.src);
    add(makeClip({ trackId: vo.id, assetId: asset?.id, start: round(cut.voiceover.offset ?? 0), duration: round(asset?.duration ?? length), volume: dbToGain(cut.voiceover.gain_db) }));
  }
  if (cut.music?.src) {
    const mu = mk('audio', 'Music');
    tracks.push(mu);
    const asset = assetFor(cut.music.src);
    if (!asset) missing.add(cut.music.src);
    const inPoint = cut.music.in ?? 0;
    const available = asset ? asset.duration - inPoint : length;
    add(makeClip({ trackId: mu.id, assetId: asset?.id, start: 0, duration: round(Math.max(0.1, Math.min(length, available))), inPoint, volume: dbToGain(cut.music.gain_db) }));
  }

  return {
    project: {
      settings: { ...defaultSettings(), name, width: 1080, height: 1920, fps: cut.fps ?? 30 },
      tracks,
      clips,
      reel: { name, cutlist: cut as Record<string, unknown> },
    },
    missing: [...missing],
  };
}

export interface ReelExport {
  cutlist: CutList;
  words: Word[];
  warnings: string[];
  /** Assets used on the timeline that aren't in the project's raw/ folder yet (must be copied there). */
  newFiles: MediaAsset[];
}

/** Turn the edited timeline back into cutlist.json + words.json for the pipeline. */
export function projectToCutlist(project: Project): ReelExport {
  const original = (project.reel?.cutlist ?? { segments: [] }) as CutList;
  const warnings: string[] = [];
  const newFiles = new Map<string, MediaAsset>();
  const trackOf = (c: Clip) => project.tracks.find((t) => t.id === c.trackId);
  const srcOf = (a: MediaAsset) => {
    if (a.source) return a.source;
    newFiles.set(a.id, a);
    return `raw/${a.name}`;
  };
  const all = Object.values(project.clips);

  // Shots: every clip on visible video tracks, in timeline order, concatenated.
  const shots = all.filter((c) => trackOf(c)?.kind === 'video' && !trackOf(c)?.hidden && c.assetId && project.assets[c.assetId]).sort((a, b) => a.start - b.start);
  let ignoredLook = false;
  let maxSourceVol = 0;
  let end = 0;
  const segments: CutSegment[] = [];
  for (const c of shots) {
    const a = project.assets[c.assetId!];
    if (c.start > end + 0.04 && segments.length) warnings.push(`Gap before ${a.name} at ${c.start.toFixed(2)}s was removed — the Reel plays shots back to back. Use the Shots track's “Close gaps” button to see the real timing.`);
    if (c.start < end - 0.04) warnings.push(`${a.name} overlaps the previous shot at ${c.start.toFixed(2)}s — shots are joined one after another, not layered.`);
    end = Math.max(end, c.start + c.duration);
    if (c.speed !== 1) warnings.push(`Speed ${c.speed}× on ${a.name} isn't supported by the pipeline — it renders at 1×.`);
    const { x, y, rotation } = c.transform;
    const col = c.color;
    if (x || y || rotation || c.opacity !== 1 || c.fadeIn || c.fadeOut || col.brightness !== 1 || col.contrast !== 1 || col.saturation !== 1 || col.blur) ignoredLook = true;
    const still = a.kind === 'image';
    const seg: CutSegment = {
      src: srcOf(a),
      in: still ? 0 : round(c.inPoint),
      out: round((still ? 0 : c.inPoint) + c.duration),
      note: c.note ?? '',
      punch_in: c.transform.scale > 1.001 ? round(c.transform.scale) : 1,
    };
    if (still) seg.still = true;
    if (seg.punch_in! > 1.15) warnings.push(`Punch-in ${seg.punch_in}× on ${a.name} is above the 1.15× the style guide allows.`);
    segments.push(seg);
    if (!trackOf(c)?.muted) maxSourceVol = Math.max(maxSourceVol, a.kind === 'video' ? c.volume : 0);
  }
  if (ignoredLook) warnings.push('Position, rotation, opacity, fades and colour changes on shots are preview-only — the pipeline frames shots itself (crop or blurred fill, brand LUT).');
  const length = round(segments.reduce((s, x) => s + (x.out - x.in), 0));

  // Audio: the original voiceover file stays the voiceover; the first other audio clip is the music.
  const audio = all.filter((c) => trackOf(c)?.kind === 'audio' && !trackOf(c)?.muted && c.assetId && project.assets[c.assetId]).sort((a, b) => a.start - b.start);
  const voClip = audio.find((c) => original.voiceover && project.assets[c.assetId!].source === original.voiceover.src);
  const musicClip = audio.find((c) => c !== voClip);
  if (audio.length > (voClip ? 1 : 0) + (musicClip ? 1 : 0)) warnings.push('Only one music track is used — extra audio clips were left out.');

  let voiceover: CutList['voiceover'] = null;
  if (voClip) {
    const offset = round(voClip.start - voClip.inPoint);
    if (voClip.inPoint > 0.01) warnings.push('The voiceover was trimmed at the start — the pipeline plays the whole file, shifted to match.');
    voiceover = { ...(original.voiceover ?? {}), src: srcOf(project.assets[voClip.assetId!]), offset, gain_db: gainToDb(voClip.volume) };
  }
  let music: CutList['music'] = null;
  if (musicClip) {
    if (musicClip.start > 0.05) warnings.push('Music always starts at 0 s in the Reel — move its in-point instead of the clip.');
    music = { duck_db: -14, ...(original.music ?? {}), src: srcOf(project.assets[musicClip.assetId!]), in: round(musicClip.inPoint), gain_db: gainToDb(musicClip.volume) };
  }

  // Captions → words.json
  const captionClips = all.filter((c) => c.text && trackOf(c)?.kind === 'text' && !trackOf(c)?.hidden).sort((a, b) => a.start - b.start);
  const words = captionClips.flatMap((c) => wordsForCaption(c.text!.text.replace(/\n/g, ' '), c.start, c.duration));
  if (captionClips.some((c) => c.start + c.duration > length + 0.05)) warnings.push('A caption runs past the end of the last shot and will be cut off.');

  const cutlist: CutList = {
    ...original,
    length,
    fps: project.settings.fps,
    keep_source_audio: maxSourceVol > 0,
    source_audio_gain_db: maxSourceVol > 0 ? gainToDb(maxSourceVol) : 0,
    voiceover,
    music,
    captions: words.length ? original.captions ?? 'work/captions.ass' : null,
    segments,
  };
  if (!segments.length) warnings.push('There are no shots on the timeline.');
  return { cutlist, words, warnings, newFiles: [...newFiles.values()] };
}
