import { nanoid } from 'nanoid';
import type { AssetKind, MediaAsset } from '../types';
import { DEFAULT_IMAGE_DURATION } from './timeline';

export function detectKind(file: File): AssetKind | null {
  const t = file.type;
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (t.startsWith('image/')) return 'image';
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'webm', 'mov', 'mkv', 'm4v', 'ogv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus'].includes(ext)) return 'audio';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext)) return 'image';
  return null;
}

function once<T extends Event>(el: EventTarget, ok: string, fail = 'error', timeoutMs = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => cleanup(new Error(`Timed out waiting for ${ok}`)), timeoutMs);
    const onOk = (e: Event) => cleanup(null, e as T);
    const onFail = () => cleanup(new Error(`Failed to load media (${ok})`));
    function cleanup(err: Error | null, e?: T) {
      clearTimeout(timer);
      el.removeEventListener(ok, onOk);
      el.removeEventListener(fail, onFail);
      if (err) reject(err);
      else resolve(e as T);
    }
    el.addEventListener(ok, onOk);
    el.addEventListener(fail, onFail);
  });
}

function thumbFrom(source: CanvasImageSource, w: number, h: number, maxW = 240): string {
  const scale = Math.min(1, maxW / w);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const ctx = c.getContext('2d')!;
  ctx.drawImage(source, 0, 0, c.width, c.height);
  try {
    return c.toDataURL('image/jpeg', 0.7);
  } catch {
    return '';
  }
}

/** Compute normalised peaks from an audio/video file for waveform display. */
export async function computePeaks(blob: Blob, buckets = 1000): Promise<number[] | undefined> {
  try {
    const buf = await blob.arrayBuffer();
    const Ctx = window.OfflineAudioContext;
    const ctx = new Ctx(1, 1, 44100);
    const audio = await ctx.decodeAudioData(buf);
    const ch = audio.getChannelData(0);
    const size = Math.max(1, Math.floor(ch.length / buckets));
    const peaks: number[] = [];
    let max = 0;
    for (let i = 0; i < buckets; i++) {
      let m = 0;
      const end = Math.min(ch.length, (i + 1) * size);
      for (let j = i * size; j < end; j += 16) m = Math.max(m, Math.abs(ch[j]));
      peaks.push(m);
      max = Math.max(max, m);
    }
    return max > 0 ? peaks.map((p) => +(p / max).toFixed(3)) : peaks;
  } catch {
    return undefined; // No audio track, or unsupported codec.
  }
}

/** Read metadata, thumbnail and waveform for an imported file. */
export async function probeFile(file: File, url: string): Promise<MediaAsset> {
  const kind = detectKind(file);
  if (!kind) throw new Error(`Unsupported file type: ${file.name}`);
  const base = { id: nanoid(10), name: file.name, kind, mimeType: file.type };

  if (kind === 'image') {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      ...base,
      duration: DEFAULT_IMAGE_DURATION,
      width: img.naturalWidth,
      height: img.naturalHeight,
      thumbnail: thumbFrom(img, img.naturalWidth, img.naturalHeight),
    };
  }

  const el = document.createElement(kind === 'video' ? 'video' : 'audio');
  el.preload = 'auto';
  el.muted = true;
  el.src = url;
  await once(el, 'loadedmetadata');
  let duration = el.duration;
  if (!Number.isFinite(duration)) {
    // Some WebM files report Infinity until seeked to the end.
    el.currentTime = 1e9;
    await once(el, 'seeked').catch(() => undefined);
    duration = el.duration;
    el.currentTime = 0;
  }
  if (!Number.isFinite(duration) || duration <= 0) duration = 1;

  let thumbnail: string | undefined;
  let width = 0;
  let height = 0;
  if (el instanceof HTMLVideoElement) {
    width = el.videoWidth;
    height = el.videoHeight;
    try {
      el.currentTime = Math.min(duration * 0.1, 1);
      await once(el, 'seeked');
      if (width && height) thumbnail = thumbFrom(el, width, height);
    } catch {
      /* thumbnail is optional */
    }
  }
  el.removeAttribute('src');
  el.load();

  const peaks = file.size < 300 * 1024 * 1024 ? await computePeaks(file) : undefined;
  return { ...base, duration, width, height, thumbnail, peaks };
}
