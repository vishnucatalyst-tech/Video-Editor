import fixWebmDuration from 'fix-webm-duration';
import type { Clip, MediaAsset, Project } from '../types';
import { useEditor } from '../store/editor';
import { mediaRegistry } from '../lib/mediaRegistry';
import { fadeFactor, isActiveAt, projectDuration, sourceTime } from '../lib/timeline';

type MediaEl = HTMLVideoElement | HTMLAudioElement;

interface ClipResource {
  assetId: string;
  url: string;
  el: MediaEl | HTMLImageElement;
  source?: MediaElementAudioSourceNode;
  gain?: GainNode;
  /** True while a seek we issued is still pending. */
  seeking: boolean;
}

export interface ExportOptions {
  mimeType: string;
  videoBitsPerSecond: number;
  onProgress: (fraction: number) => void;
  signal: AbortSignal;
}

const DRIFT_PLAYING = 0.3; // seconds of tolerated drift during playback
const PRELOAD_AHEAD = 1.5; // seconds: start seeking upcoming clips this early

/**
 * The playback/render engine. Owns one media element per timeline clip, keeps them in
 * sync with the playhead, mixes audio through WebAudio and composites every visible
 * clip onto a canvas each animation frame.
 */
class Engine {
  private previewCanvas: HTMLCanvasElement | null = null;
  private exportCanvas: HTMLCanvasElement | null = null;
  private resources = new Map<string, ClipResource>();
  private audioCtx: AudioContext | null = null;
  private master: GainNode | null = null;
  private exportDest: MediaStreamAudioDestinationNode | null = null;
  private raf = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private clockBase = 0;
  private clockStart = 0;
  private lastPlayhead = 0;
  private wasPlaying = false;
  private exporting = false;
  private exportEnd = 0;
  private started = false;
  /** Draw a selection outline in the preview (never in exports). */
  showSelection = true;

  start() {
    if (this.started) return;
    this.started = true;
    mediaRegistry.subscribe(() => this.syncResources(useEditor.getState().project));
    this.restartLoop();
  }

  private loopGen = 0;

  /** (Re)start the frame loop; any previously running loop stops at its next frame. */
  private restartLoop() {
    cancelAnimationFrame(this.raf);
    if (this.timer) clearTimeout(this.timer);
    const gen = ++this.loopGen;
    const loop = () => {
      if (gen !== this.loopGen) return;
      this.tick();
      this.schedule(loop);
    };
    this.schedule(loop);
  }

  private schedule(fn: () => void) {
    // rAF stalls in background tabs; during export use a timer so recording continues.
    if (this.exporting) this.timer = setTimeout(fn, 1000 / 60);
    else this.raf = requestAnimationFrame(fn);
  }

  attachPreview(canvas: HTMLCanvasElement | null) {
    this.previewCanvas = canvas;
  }

  /** Must be called from a user gesture (e.g. Play) so audio can start. */
  ensureAudio() {
    if (!this.audioCtx) {
      const ctx = new AudioContext();
      this.audioCtx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      for (const r of this.resources.values()) this.connectAudio(r);
    }
    if (this.audioCtx.state === 'suspended') void this.audioCtx.resume();
  }

  private connectAudio(r: ClipResource) {
    if (!this.audioCtx || !this.master || r.source || r.el instanceof HTMLImageElement) return;
    try {
      r.source = this.audioCtx.createMediaElementSource(r.el);
      r.gain = this.audioCtx.createGain();
      r.source.connect(r.gain);
      r.gain.connect(this.master);
      if (this.exportDest) r.gain.connect(this.exportDest);
      r.el.volume = 1;
    } catch {
      /* element may already be connected */
    }
  }

  /** Create/destroy per-clip media elements to match the project. */
  private syncResources(project: Project) {
    const wanted = new Set<string>();
    for (const clip of Object.values(project.clips)) {
      if (!clip.assetId) continue;
      const asset = project.assets[clip.assetId];
      const url = mediaRegistry.url(clip.assetId);
      if (!asset || !url) continue;
      wanted.add(clip.id);
      const existing = this.resources.get(clip.id);
      if (existing && existing.url === url) continue;
      if (existing) this.dispose(clip.id);
      this.resources.set(clip.id, this.createResource(asset, url));
    }
    for (const id of [...this.resources.keys()]) if (!wanted.has(id)) this.dispose(id);
  }

  private createResource(asset: MediaAsset, url: string): ClipResource {
    if (asset.kind === 'image') {
      const img = new Image();
      img.src = url;
      return { assetId: asset.id, url, el: img, seeking: false };
    }
    const el = document.createElement(asset.kind === 'video' ? 'video' : 'audio');
    el.preload = 'auto';
    el.src = url;
    if (el instanceof HTMLVideoElement) el.playsInline = true;
    const r: ClipResource = { assetId: asset.id, url, el, seeking: false };
    el.addEventListener('seeked', () => (r.seeking = false));
    this.connectAudio(r);
    return r;
  }

  private dispose(id: string) {
    const r = this.resources.get(id);
    if (!r) return;
    if (!(r.el instanceof HTMLImageElement)) {
      r.el.pause();
      r.el.removeAttribute('src');
      r.el.load();
    }
    r.gain?.disconnect();
    r.source?.disconnect();
    this.resources.delete(id);
  }

  private seek(r: ClipResource, el: MediaEl, t: number) {
    r.seeking = true;
    el.currentTime = t;
  }

  private tick() {
    const state = useEditor.getState();
    const { project } = state;
    this.syncResources(project);
    const now = performance.now();
    const duration = projectDuration(project);
    let t = state.playhead;

    if (state.playing) {
      if (!this.wasPlaying || Math.abs(state.playhead - this.lastPlayhead) > 1e-6) {
        // Playback just started, or the user seeked during playback: rebase the clock.
        if (!this.exporting && t >= duration - 1e-3) t = 0;
        this.clockBase = t;
        this.clockStart = now;
      }
      t = this.clockBase + (now - this.clockStart) / 1000;
      const end = this.exporting ? this.exportEnd : duration;
      if (t >= end) {
        t = end;
        useEditor.setState({ playing: false, playhead: t });
      } else {
        useEditor.setState({ playhead: t });
      }
      this.lastPlayhead = t;
    }
    this.wasPlaying = useEditor.getState().playing;
    const playing = this.wasPlaying;

    this.syncMedia(project, t, playing);
    if (this.previewCanvas) this.render(this.previewCanvas, project, t, this.showSelection ? state.selection : []);
    if (this.exporting && this.exportCanvas) {
      this.render(this.exportCanvas, project, t, []);
      this.exportProgress?.(Math.min(1, t / this.exportEnd));
    }
  }

  private exportProgress: ((f: number) => void) | null = null;

  /** Play/pause/seek each media element so it shows the right frame for time t. */
  private syncMedia(project: Project, t: number, playing: boolean) {
    const fps = project.settings.fps;
    for (const [clipId, r] of this.resources) {
      const clip = project.clips[clipId];
      if (!clip || r.el instanceof HTMLImageElement) continue;
      const el = r.el;
      const track = project.tracks.find((tr) => tr.id === clip.trackId);
      const active = isActiveAt(clip, t);
      const target = sourceTime(clip, t);

      // Volume (with fades and track mute).
      const audible = active && track && !track.muted ? clip.volume * fadeFactor(clip, t) : 0;
      if (r.gain) r.gain.gain.value = audible;
      else el.volume = Math.min(1, audible);

      if (el.playbackRate !== clip.speed) el.playbackRate = clip.speed;

      if (active) {
        if (playing) {
          if (!r.seeking && Math.abs(el.currentTime - target) > DRIFT_PLAYING) this.seek(r, el, target);
          if (el.paused) void el.play().catch(() => undefined);
        } else {
          if (!el.paused) el.pause();
          if (!r.seeking && Math.abs(el.currentTime - target) > 0.5 / fps) this.seek(r, el, target);
        }
      } else {
        if (!el.paused) el.pause();
        // Pre-roll upcoming clips so they're ready to go when the playhead arrives.
        const until = clip.start - t;
        if (until > 0 && until < PRELOAD_AHEAD && !r.seeking && Math.abs(el.currentTime - clip.inPoint) > 0.05) {
          this.seek(r, el, clip.inPoint);
        }
      }
    }
  }

  /** Composite all visible clips at time t onto a canvas. */
  render(canvas: HTMLCanvasElement, project: Project, t: number, selection: string[]) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width: W, background } = project.settings;
    const k = canvas.width / W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    const selected: Clip[] = [];
    // The top track in the UI is drawn last (on top).
    for (let i = project.tracks.length - 1; i >= 0; i--) {
      const track = project.tracks[i];
      if (track.kind === 'audio' || track.hidden) continue;
      for (const clip of Object.values(project.clips)) {
        if (clip.trackId !== track.id || !isActiveAt(clip, t)) continue;
        this.drawClip(ctx, project, clip, t);
        if (selection.includes(clip.id)) selected.push(clip);
      }
    }

    for (const clip of selected) {
      const b = this.clipBounds(project, clip, ctx);
      if (!b) continue;
      ctx.save();
      ctx.translate(b.cx, b.cy);
      ctx.rotate((clip.transform.rotation * Math.PI) / 180);
      ctx.strokeStyle = '#5b8cff';
      ctx.lineWidth = 3 / k;
      ctx.setLineDash([10 / k, 6 / k]);
      ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
  }

  /** Unrotated bounding box of a visual clip, centred at (cx, cy), in project pixels. */
  clipBounds(project: Project, clip: Clip, ctx?: CanvasRenderingContext2D): { cx: number; cy: number; w: number; h: number } | null {
    const { width: W, height: H } = project.settings;
    const { x, y, scale } = clip.transform;
    const cx = W / 2 + x * W;
    const cy = H / 2 + y * H;
    if (clip.text) {
      const c = ctx ?? document.createElement('canvas').getContext('2d')!;
      c.save();
      c.font = fontFor(clip);
      const lines = clip.text.text.split('\n');
      const w = Math.max(...lines.map((l) => c.measureText(l).width), 10);
      c.restore();
      const lh = clip.text.fontSize * 1.2;
      const pad = clip.text.fontSize * 0.3;
      return { cx, cy, w: (w + pad * 2) * scale, h: (lh * lines.length + pad * 2) * scale };
    }
    const asset = clip.assetId ? project.assets[clip.assetId] : undefined;
    if (!asset || asset.kind === 'audio' || !asset.width || !asset.height) return null;
    const fit = Math.min(W / asset.width, H / asset.height);
    return { cx, cy, w: asset.width * fit * scale, h: asset.height * fit * scale };
  }

  private drawClip(ctx: CanvasRenderingContext2D, project: Project, clip: Clip, t: number) {
    const alpha = clip.opacity * fadeFactor(clip, t);
    if (alpha <= 0) return;
    const k = ctx.getTransform().a;
    const { brightness, contrast, saturation, blur } = clip.color;
    const filters: string[] = [];
    if (brightness !== 1) filters.push(`brightness(${brightness})`);
    if (contrast !== 1) filters.push(`contrast(${contrast})`);
    if (saturation !== 1) filters.push(`saturate(${saturation})`);
    if (blur > 0) filters.push(`blur(${blur * k}px)`);

    const b = this.clipBounds(project, clip, ctx);
    if (!b) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = filters.length ? filters.join(' ') : 'none';
    ctx.translate(b.cx, b.cy);
    ctx.rotate((clip.transform.rotation * Math.PI) / 180);

    if (clip.text) {
      drawText(ctx, clip, b.w, b.h);
    } else {
      const r = this.resources.get(clip.id);
      if (r) {
        const el = r.el;
        const ready =
          el instanceof HTMLImageElement ? el.complete && el.naturalWidth > 0 : el instanceof HTMLVideoElement && el.readyState >= 2;
        if (ready) ctx.drawImage(el as CanvasImageSource, -b.w / 2, -b.h / 2, b.w, b.h);
      }
    }
    ctx.restore();
  }

  /** Topmost visible visual clip under a point (project pixel coordinates) at time t. */
  hitTest(project: Project, t: number, px: number, py: number): Clip | null {
    for (const track of project.tracks) {
      if (track.kind === 'audio' || track.hidden) continue;
      for (const clip of Object.values(project.clips)) {
        if (clip.trackId !== track.id || !isActiveAt(clip, t)) continue;
        const b = this.clipBounds(project, clip);
        if (!b) continue;
        const a = (-clip.transform.rotation * Math.PI) / 180;
        const dx = px - b.cx;
        const dy = py - b.cy;
        const lx = dx * Math.cos(a) - dy * Math.sin(a);
        const ly = dx * Math.sin(a) + dy * Math.cos(a);
        if (Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2) return clip;
      }
    }
    return null;
  }

  /** Render a single frame of the project at time t to a PNG blob. */
  async snapshot(t: number): Promise<Blob | null> {
    const { project } = useEditor.getState();
    const c = document.createElement('canvas');
    c.width = project.settings.width;
    c.height = project.settings.height;
    this.render(c, project, t, []);
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }

  get isExporting() {
    return this.exporting;
  }

  /**
   * Export the timeline by playing it back in real time while recording the composited
   * canvas and the mixed audio with MediaRecorder.
   */
  async export(opts: ExportOptions): Promise<Blob> {
    const { project } = useEditor.getState();
    const duration = projectDuration(project);
    if (duration <= 0) throw new Error('The timeline is empty.');
    this.ensureAudio();
    const ctx = this.audioCtx!;

    const canvas = document.createElement('canvas');
    canvas.width = project.settings.width;
    canvas.height = project.settings.height;
    this.exportCanvas = canvas;

    this.exportDest = ctx.createMediaStreamDestination();
    for (const r of this.resources.values()) r.gain?.connect(this.exportDest);

    const stream = new MediaStream([
      ...canvas.captureStream(project.settings.fps).getVideoTracks(),
      ...this.exportDest.stream.getAudioTracks(),
    ]);
    const recorder = new MediaRecorder(stream, {
      mimeType: opts.mimeType,
      videoBitsPerSecond: opts.videoBitsPerSecond,
      audioBitsPerSecond: 192_000,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    // Prime the first frame before starting the recorder.
    useEditor.setState({ playing: false, playhead: 0 });
    await this.primeFrame(project, 0);

    const done = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: opts.mimeType.split(';')[0] }));
      recorder.onerror = (e) => reject((e as unknown as { error?: Error }).error ?? new Error('Recording failed'));
    });

    this.exporting = true;
    this.exportEnd = duration;
    this.exportProgress = opts.onProgress;
    this.restartLoop();
    recorder.start(250);
    useEditor.setState({ playhead: 0, playing: true });
    this.wasPlaying = false;

    try {
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          useEditor.setState({ playing: false });
          reject(new DOMException('Export cancelled', 'AbortError'));
        };
        opts.signal.addEventListener('abort', onAbort, { once: true });
        const unsub = useEditor.subscribe((s) => {
          if (!s.playing) {
            unsub();
            opts.signal.removeEventListener('abort', onAbort);
            resolve();
          }
        });
      });
      // Let the final frame make it into the stream.
      await new Promise((r) => setTimeout(r, 200));
    } finally {
      if (recorder.state !== 'inactive') recorder.stop();
      this.exporting = false;
      this.exportProgress = null;
      this.exportCanvas = null;
      for (const r of this.resources.values()) r.gain?.disconnect(this.exportDest!);
      this.exportDest = null;
      this.restartLoop();
    }
    if (opts.signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
    const blob = await done;
    // MediaRecorder WebM output has no duration header, which breaks seeking in players.
    if (blob.type.includes('webm')) return fixWebmDuration(blob, duration * 1000, { logger: false });
    return blob;
  }

  /** Seek all clips active at t and wait until their frames are decoded. */
  private async primeFrame(project: Project, t: number) {
    const waits: Promise<unknown>[] = [];
    for (const [id, r] of this.resources) {
      const clip = project.clips[id];
      if (!clip || r.el instanceof HTMLImageElement) continue;
      const el = r.el;
      const target = isActiveAt(clip, t) ? sourceTime(clip, t) : clip.inPoint;
      if (Math.abs(el.currentTime - target) > 0.01) {
        waits.push(new Promise((res) => el.addEventListener('seeked', res, { once: true })));
        this.seek(r, el, target);
      }
    }
    await Promise.race([Promise.all(waits), new Promise((r) => setTimeout(r, 3000))]);
  }
}

export function fontFor(clip: Clip) {
  const s = clip.text!;
  return `${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`;
}

function drawText(ctx: CanvasRenderingContext2D, clip: Clip, w: number, h: number) {
  const s = clip.text!;
  const scale = clip.transform.scale;
  ctx.scale(scale, scale);
  const bw = w / scale;
  const bh = h / scale;
  if (s.background) {
    ctx.fillStyle = s.background;
    const r = s.fontSize * 0.2;
    ctx.beginPath();
    ctx.roundRect(-bw / 2, -bh / 2, bw, bh, r);
    ctx.fill();
  }
  ctx.font = fontFor(clip);
  ctx.fillStyle = s.color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = s.align;
  const pad = s.fontSize * 0.3;
  const lines = s.text.split('\n');
  const lh = s.fontSize * 1.2;
  const x = s.align === 'left' || s.align === 'start' ? -bw / 2 + pad : s.align === 'right' || s.align === 'end' ? bw / 2 - pad : 0;
  if (!s.background) {
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = s.fontSize * 0.12;
    ctx.shadowOffsetY = s.fontSize * 0.03;
  }
  lines.forEach((line, i) => {
    ctx.fillText(line, x, -((lines.length - 1) * lh) / 2 + i * lh);
  });
}

export const engine = new Engine();

/** Recording formats the browser supports, best first. */
export function exportFormats(): { label: string; mimeType: string; ext: string }[] {
  // Within a group, only the first supported variant is offered.
  const all = [
    { group: 'mp4-aac', label: 'MP4 (H.264 + AAC)', mimeType: 'video/mp4;codecs=avc1.640028,mp4a.40.2', ext: 'mp4' },
    { group: 'mp4-aac', label: 'MP4 (H.264 + AAC)', mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
    { group: 'mp4-opus', label: 'MP4 (H.264 + Opus)', mimeType: 'video/mp4;codecs=avc1,opus', ext: 'mp4' },
    { group: 'mp4', label: 'MP4', mimeType: 'video/mp4', ext: 'mp4' },
    { group: 'vp9', label: 'WebM (VP9 + Opus)', mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { group: 'vp8', label: 'WebM (VP8 + Opus)', mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { group: 'webm', label: 'WebM', mimeType: 'video/webm', ext: 'webm' },
  ];
  if (typeof MediaRecorder === 'undefined') return [];
  const seen = new Set<string>();
  return all.filter((f) => {
    if (seen.has(f.group) || !MediaRecorder.isTypeSupported(f.mimeType)) return false;
    seen.add(f.group);
    return true;
  });
}
