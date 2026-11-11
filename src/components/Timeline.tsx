import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../store/editor';
import type { Clip, MediaAsset, Track } from '../types';
import {
  clipEnd,
  findFreeStart,
  formatShort,
  neighbourBounds,
  overlaps,
  projectDuration,
  snapCandidates,
  snapTime,
  trimEnd,
  trimStart,
} from '../lib/timeline';
import { ASSET_DRAG_TYPE } from './MediaBin';
import { Icon } from './Icon';

const HEADER_W = 176;
const RULER_H = 28;
const TRACK_H: Record<Track['kind'], number> = { video: 64, text: 40, audio: 56 };
const SNAP_PX = 8;

type DragMode = 'move' | 'trim-start' | 'trim-end';
interface DragState {
  mode: DragMode;
  clipId: string;
  startX: number;
  startY: number;
  orig: Record<string, Clip>;
  moved: boolean;
  additive: boolean;
}

export function Timeline() {
  const project = useEditor((s) => s.project);
  const zoom = useEditor((s) => s.zoom);
  const selection = useEditor((s) => s.selection);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const dragRef = useRef<DragState | null>(null);
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [viewW, setViewW] = useState(1000);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const duration = projectDuration(project);
  const contentSeconds = Math.max(duration + 30, (viewW - HEADER_W) / zoom);
  const contentW = contentSeconds * zoom;
  const selectedSet = useMemo(() => new Set(selection), [selection]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Convert a client X coordinate to timeline seconds. */
  const timeAt = useCallback(
    (clientX: number) => {
      const r = rulerRef.current!.getBoundingClientRect();
      return Math.max(0, (clientX - r.left) / zoom);
    },
    [zoom],
  );

  const trackAt = (clientY: number): Track | undefined => {
    for (const t of useEditor.getState().project.tracks) {
      const el = rowRefs.current.get(t.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientY >= r.top && clientY < r.bottom) return t;
    }
    return undefined;
  };

  // Ctrl/⌘ + wheel zooms around the cursor.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const s = useEditor.getState();
      const r = rulerRef.current!.getBoundingClientRect();
      const t = (e.clientX - r.left) / s.zoom;
      const next = Math.max(5, Math.min(600, s.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      s.setZoom(next);
      requestAnimationFrame(() => {
        el.scrollLeft = t * next - (e.clientX - el.getBoundingClientRect().left - HEADER_W);
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ----- Scrubbing on the ruler / empty lane space -----
  const startScrub = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const s = useEditor.getState();
    s.setPlaying(false);
    s.setPlayhead(timeAt(e.clientX));
    const move = (ev: PointerEvent) => s.setPlayhead(timeAt(ev.clientX));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onLanePointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return;
    if (!e.shiftKey) useEditor.getState().select([]);
    startScrub(e);
  };

  // ----- Clip dragging / trimming -----
  const onClipPointerDown = (e: React.PointerEvent, clip: Clip, mode: DragMode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const s = useEditor.getState();
    const track = s.project.tracks.find((t) => t.id === clip.trackId);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    let sel = s.selection;
    if (additive) {
      s.toggleSelect(clip.id);
      sel = useEditor.getState().selection;
    } else if (!sel.includes(clip.id)) {
      sel = [clip.id];
      s.select(sel);
    }
    if (track?.locked || !sel.includes(clip.id)) return;
    const ids = mode === 'move' ? sel : [clip.id];
    const orig: Record<string, Clip> = {};
    for (const id of ids) {
      const c = s.project.clips[id];
      const tr = s.project.tracks.find((t) => t.id === c?.trackId);
      if (c && !tr?.locked) orig[id] = c;
    }
    dragRef.current = { mode, clipId: clip.id, startX: e.clientX, startY: e.clientY, orig, moved: false, additive };
    s.beginGesture();

    const move = (ev: PointerEvent) => onDragMove(ev);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const d = dragRef.current;
      dragRef.current = null;
      setSnapLine(null);
      document.body.classList.remove('dragging');
      useEditor.getState().endGesture();
      // A plain click on one clip of a multi-selection selects just that clip.
      if (d && !d.moved && !d.additive && useEditor.getState().selection.length > 1) {
        useEditor.getState().select([d.clipId]);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onDragMove = (ev: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const s = useEditor.getState();
    const { project: p, zoom: z, playhead } = s;
    const dx = ev.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 3 && Math.abs(ev.clientY - d.startY) < 3) return;
    if (!d.moved) {
      d.moved = true;
      document.body.classList.add('dragging');
    }
    const dt = dx / z;
    const primary = d.orig[d.clipId];
    if (!primary) return;
    const exclude = new Set(Object.keys(d.orig));
    const candidates = s.snapping ? snapCandidates(p, playhead, exclude) : [];
    const threshold = SNAP_PX / z;
    const asset = primary.assetId ? p.assets[primary.assetId] : undefined;
    const isStill = !asset || asset.kind === 'image';

    if (d.mode === 'move') {
      let newStart = primary.start + dt;
      let snapped: number | null = null;
      if (s.snapping) {
        const a = snapTime(newStart, candidates, threshold);
        const b = snapTime(newStart + primary.duration, candidates, threshold);
        const da = a.target === null ? Infinity : Math.abs(a.time - newStart);
        const db = b.target === null ? Infinity : Math.abs(b.time - (newStart + primary.duration));
        if (da <= db && a.target !== null) {
          newStart = a.time;
          snapped = a.target;
        } else if (b.target !== null) {
          newStart = b.time - primary.duration;
          snapped = b.target;
        }
      }
      let delta = newStart - primary.start;
      const minStart = Math.min(...Object.values(d.orig).map((c) => c.start));
      delta = Math.max(delta, -minStart);

      // Single-clip drags can move between compatible tracks.
      let targetTrack = primary.trackId;
      if (Object.keys(d.orig).length === 1) {
        const over = trackAt(ev.clientY);
        const kind = p.tracks.find((t) => t.id === primary.trackId)?.kind;
        if (over && over.kind === kind && !over.locked) targetTrack = over.id;
      }

      const moved: Record<string, Clip> = {};
      for (const c of Object.values(d.orig)) {
        moved[c.id] = { ...c, start: c.start + delta, trackId: Object.keys(d.orig).length === 1 ? targetTrack : c.trackId };
      }
      // A single clip dragged into a neighbour slides into the nearest free gap instead.
      const single = moved[d.clipId];
      if (Object.keys(moved).length === 1 && overlaps(p, single.trackId, single.start, single.duration, exclude)) {
        moved[d.clipId] = { ...single, start: findFreeStart(p, single.trackId, single.start, single.duration, exclude) };
        snapped = null;
      }
      const valid = Object.values(moved).every((c) => !overlaps(p, c.trackId, c.start, c.duration, exclude));
      if (valid) {
        s.updateLive((proj) => ({ ...proj, clips: { ...proj.clips, ...moved } }));
        setSnapLine(snapped);
      }
      return;
    }

    const current = p.clips[d.clipId];
    if (!current) return;
    const [prevEnd, nextStart] = neighbourBounds(p, primary);
    let next: Clip;
    let snapped: number | null = null;
    if (d.mode === 'trim-start') {
      let t = primary.start + dt;
      if (s.snapping) {
        const r = snapTime(t, candidates, threshold);
        t = r.time;
        snapped = r.target;
      }
      next = trimStart(primary, t, prevEnd, isStill);
    } else {
      let t = clipEnd(primary) + dt;
      if (s.snapping) {
        const r = snapTime(t, candidates, threshold);
        t = r.time;
        snapped = r.target;
      }
      next = trimEnd(primary, t, nextStart, asset?.duration, isStill);
    }
    s.updateLive((proj) => ({ ...proj, clips: { ...proj.clips, [next.id]: next } }));
    setSnapLine(snapped);
  };

  // ----- Dropping media from the bin -----
  const onLaneDragOver = (e: React.DragEvent, track: Track) => {
    if (!e.dataTransfer.types.includes(ASSET_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropTarget(track.id);
  };

  const onLaneDrop = (e: React.DragEvent, track: Track) => {
    const assetId = e.dataTransfer.getData(ASSET_DRAG_TYPE);
    setDropTarget(null);
    if (!assetId) return;
    e.preventDefault();
    e.stopPropagation();
    const s = useEditor.getState();
    const asset = s.project.assets[assetId];
    if (!asset) return;
    const wantKind = asset.kind === 'audio' ? 'audio' : 'video';
    s.addAssetToTimeline(assetId, track.kind === wantKind && !track.locked ? track.id : undefined, timeAt(e.clientX));
  };

  return (
    <section className="panel timeline" aria-label="Timeline">
      <TimelineToolbar />
      <div className="timeline-scroll" ref={scrollRef}>
        <div className="timeline-content" style={{ width: HEADER_W + contentW }}>
          <div className="tl-row tl-ruler-row" style={{ height: RULER_H }}>
            <div className="tl-corner" style={{ width: HEADER_W }}>
              <AddTrackMenu />
            </div>
            <div className="tl-ruler" ref={rulerRef} style={{ width: contentW }} onPointerDown={startScrub}>
              <Ruler zoom={zoom} seconds={contentSeconds} />
            </div>
          </div>

          {project.tracks.map((track) => (
            <div
              key={track.id}
              className={`tl-row ${dropTarget === track.id ? 'drop-target' : ''}`}
              style={{ height: TRACK_H[track.kind] }}
              ref={(el) => {
                if (el) rowRefs.current.set(track.id, el);
                else rowRefs.current.delete(track.id);
              }}
            >
              <TrackHeader track={track} index={project.tracks.indexOf(track)} count={project.tracks.length} />
              <div
                className={`tl-lane lane-${track.kind} ${track.locked ? 'locked' : ''} ${track.hidden || track.muted ? 'dimmed' : ''}`}
                style={{ width: contentW }}
                onPointerDown={onLanePointerDown}
                onDragOver={(e) => onLaneDragOver(e, track)}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => onLaneDrop(e, track)}
              >
                {Object.values(project.clips)
                  .filter((c) => c.trackId === track.id)
                  .map((c) => (
                    <TimelineClip
                      key={c.id}
                      clip={c}
                      asset={c.assetId ? project.assets[c.assetId] : undefined}
                      zoom={zoom}
                      selected={selectedSet.has(c.id)}
                      onPointerDown={onClipPointerDown}
                    />
                  ))}
              </div>
            </div>
          ))}

          {snapLine !== null && <div className="snap-line" style={{ left: HEADER_W + snapLine * zoom }} />}
          <Playhead zoom={zoom} scrollRef={scrollRef} />
          {project.tracks.length === 0 && <div className="tl-empty">No tracks. Use “+ Track” to add one.</div>}
        </div>
      </div>
    </section>
  );
}

function TimelineToolbar() {
  const zoom = useEditor((s) => s.zoom);
  const snapping = useEditor((s) => s.snapping);
  const hasSel = useEditor((s) => s.selection.length > 0);
  const s = useEditor.getState();
  const fit = () => {
    const st = useEditor.getState();
    const d = projectDuration(st.project);
    const el = document.querySelector('.timeline-scroll') as HTMLElement | null;
    if (!el || d <= 0) return;
    st.setZoom((el.clientWidth - HEADER_W - 40) / d);
    el.scrollLeft = 0;
  };
  return (
    <div className="timeline-toolbar">
      <div className="row gap-xs">
        <button className="btn small" onClick={() => s.splitAtPlayhead()} title="Split at playhead (S)">
          <Icon name="scissors" /> Split
        </button>
        <button className="btn small" onClick={() => s.duplicateSelected()} disabled={!hasSel} title="Duplicate (Ctrl+D)">
          <Icon name="copy" /> Duplicate
        </button>
        <button className="btn small" onClick={() => s.deleteSelected()} disabled={!hasSel} title="Delete (Del)">
          <Icon name="trash" /> Delete
        </button>
        <button className="btn small" onClick={() => s.deleteSelected(true)} disabled={!hasSel} title="Ripple delete: remove and close the gap (Shift+Del)">
          <Icon name="gap" /> Ripple delete
        </button>
        <button className="btn small" onClick={() => s.addTextClip()} title="Add text at playhead (T)">
          <Icon name="text" /> Text
        </button>
      </div>
      <div className="row gap-xs">
        <button
          className={`btn small toggle ${snapping ? 'on' : ''}`}
          aria-pressed={snapping}
          onClick={() => s.setSnapping(!snapping)}
          title="Snap to clip edges and playhead (N)"
        >
          <Icon name="magnet" /> Snap
        </button>
        <button className="btn ghost icon" onClick={() => s.setZoom(zoom / 1.25)} title="Zoom out (−)" aria-label="Zoom out">
          <Icon name="minus" />
        </button>
        <input
          type="range"
          className="zoom-slider"
          min={Math.log(5)}
          max={Math.log(600)}
          step={0.01}
          value={Math.log(zoom)}
          onChange={(e) => s.setZoom(Math.exp(+e.target.value))}
          aria-label="Timeline zoom"
        />
        <button className="btn ghost icon" onClick={() => s.setZoom(zoom * 1.25)} title="Zoom in (+)" aria-label="Zoom in">
          <Icon name="plus" />
        </button>
        <button className="btn small" onClick={fit} title="Fit the whole project in view">
          <Icon name="fit" /> Fit
        </button>
      </div>
    </div>
  );
}

function AddTrackMenu() {
  const addTrack = useEditor((s) => s.addTrack);
  const [open, setOpen] = useState(false);
  return (
    <div className="add-track">
      <button className="btn tiny" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon name="plus" size={14} /> Track
      </button>
      {open && (
        <div className="menu" onMouseLeave={() => setOpen(false)}>
          {(['video', 'audio', 'text'] as const).map((k) => (
            <button
              key={k}
              onClick={() => {
                addTrack(k);
                setOpen(false);
              }}
            >
              <Icon name={k === 'video' ? 'film' : k === 'audio' ? 'music' : 'text'} /> {k[0].toUpperCase() + k.slice(1)} track
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const TICK_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

const Ruler = memo(function Ruler({ zoom, seconds }: { zoom: number; seconds: number }) {
  const major = TICK_STEPS.find((s) => s * zoom >= 80) ?? 600;
  const minor = major / (major * zoom >= 160 ? 10 : 5);
  const ticks: React.ReactNode[] = [];
  const n = Math.ceil(seconds / minor);
  for (let i = 0; i <= n; i++) {
    const t = i * minor;
    const isMajor = Math.abs(t / major - Math.round(t / major)) < 1e-6;
    ticks.push(
      <div key={i} className={`tick ${isMajor ? 'major' : ''}`} style={{ left: t * zoom }}>
        {isMajor && <span>{formatShort(+t.toFixed(2))}</span>}
      </div>,
    );
  }
  return <>{ticks}</>;
});

function Playhead({ zoom, scrollRef }: { zoom: number; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const playhead = useEditor((s) => s.playhead);
  const playing = useEditor((s) => s.playing);
  const x = HEADER_W + playhead * zoom;

  // Keep the playhead visible during playback.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !playing) return;
    const left = el.scrollLeft + HEADER_W;
    const right = el.scrollLeft + el.clientWidth;
    if (x > right - 40 || x < left) el.scrollLeft = x - HEADER_W - 80;
  }, [x, playing, scrollRef]);

  return (
    <div className="playhead" style={{ left: x }}>
      <div className="playhead-handle" />
    </div>
  );
}

function TrackHeader({ track, index, count }: { track: Track; index: number; count: number }) {
  const update = useEditor((s) => s.updateTrack);
  const remove = useEditor((s) => s.removeTrack);
  const moveTrack = useEditor((s) => s.moveTrack);
  const closeGaps = useEditor((s) => s.closeTrackGaps);
  const clipCount = useEditor((s) => Object.values(s.project.clips).filter((c) => c.trackId === track.id).length);
  return (
    <div className={`tl-header header-${track.kind}`} style={{ width: HEADER_W }}>
      <div className="tl-header-top">
        <Icon name={track.kind === 'video' ? 'film' : track.kind === 'audio' ? 'music' : 'text'} size={14} />
        <input className="track-name" value={track.name} onChange={(e) => update(track.id, { name: e.target.value })} aria-label="Track name" />
      </div>
      <div className="tl-header-actions">
        {track.kind !== 'audio' && (
          <button className={`icon-btn ${track.hidden ? 'active' : ''}`} onClick={() => update(track.id, { hidden: !track.hidden })} title={track.hidden ? 'Show track' : 'Hide track'} aria-label={track.hidden ? 'Show track' : 'Hide track'}>
            <Icon name={track.hidden ? 'eyeOff' : 'eye'} size={14} />
          </button>
        )}
        {track.kind !== 'text' && (
          <button className={`icon-btn ${track.muted ? 'active' : ''}`} onClick={() => update(track.id, { muted: !track.muted })} title={track.muted ? 'Unmute track' : 'Mute track'} aria-label={track.muted ? 'Unmute track' : 'Mute track'}>
            <Icon name={track.muted ? 'mute' : 'volume'} size={14} />
          </button>
        )}
        <button className={`icon-btn ${track.locked ? 'active' : ''}`} onClick={() => update(track.id, { locked: !track.locked })} title={track.locked ? 'Unlock track' : 'Lock track'} aria-label={track.locked ? 'Unlock track' : 'Lock track'}>
          <Icon name={track.locked ? 'lock' : 'unlock'} size={14} />
        </button>
        <button className="icon-btn" onClick={() => closeGaps(track.id)} title="Close gaps on this track" aria-label="Close gaps on this track" disabled={track.locked}>
          <Icon name="gap" size={14} />
        </button>
        <button className="icon-btn" onClick={() => moveTrack(track.id, -1)} disabled={index === 0} title="Move track up" aria-label="Move track up">
          <Icon name="up" size={14} />
        </button>
        <button className="icon-btn" onClick={() => moveTrack(track.id, 1)} disabled={index === count - 1} title="Move track down" aria-label="Move track down">
          <Icon name="down" size={14} />
        </button>
        <button
          className="icon-btn danger"
          onClick={() => {
            if (!clipCount || confirm(`Delete "${track.name}" and its ${clipCount} clip(s)?`)) remove(track.id);
          }}
          title="Delete track"
          aria-label="Delete track"
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  );
}

interface ClipProps {
  clip: Clip;
  asset?: MediaAsset;
  zoom: number;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent, clip: Clip, mode: DragMode) => void;
}

const TimelineClip = memo(function TimelineClip({ clip, asset, zoom, selected, onPointerDown }: ClipProps) {
  const left = clip.start * zoom;
  const width = Math.max(2, clip.duration * zoom);
  const kind = clip.text ? 'text' : asset?.kind ?? 'missing';
  const label = clip.text ? clip.text.text.split('\n')[0] || 'Text' : asset?.name ?? 'Missing media';
  const fadeInW = clip.fadeIn * zoom;
  const fadeOutW = clip.fadeOut * zoom;

  return (
    <div
      className={`clip clip-${kind} ${selected ? 'selected' : ''}`}
      style={{
        left,
        width,
        backgroundImage: asset?.thumbnail && kind !== 'audio' ? `url(${asset.thumbnail})` : undefined,
      }}
      onPointerDown={(e) => onPointerDown(e, clip, 'move')}
      title={`${label}\n${clip.duration.toFixed(2)}s${clip.speed !== 1 ? ` · ${clip.speed}×` : ''}`}
      data-clip-id={clip.id}
    >
      {asset?.peaks && (kind === 'audio' || kind === 'video') && <Waveform clip={clip} asset={asset} width={width} />}
      {fadeInW > 0 && <div className="fade fade-in" style={{ width: fadeInW }} />}
      {fadeOutW > 0 && <div className="fade fade-out" style={{ width: fadeOutW }} />}
      <span className="clip-label">
        {clip.speed !== 1 && <b>{clip.speed}× </b>}
        {label}
      </span>
      <div className="trim trim-start" onPointerDown={(e) => onPointerDown(e, clip, 'trim-start')} />
      <div className="trim trim-end" onPointerDown={(e) => onPointerDown(e, clip, 'trim-end')} />
    </div>
  );
});

function Waveform({ clip, asset, width }: { clip: Clip; asset: MediaAsset; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = Math.min(4000, Math.ceil(width));
  useEffect(() => {
    const c = ref.current;
    const peaks = asset.peaks;
    if (!c || !peaks) return;
    const h = c.height;
    c.width = w;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const srcStart = clip.inPoint / asset.duration;
    const srcEnd = (clip.inPoint + clip.duration * clip.speed) / asset.duration;
    for (let x = 0; x < w; x++) {
      const f = srcStart + ((x + 0.5) / w) * (srcEnd - srcStart);
      const p = (peaks[Math.min(peaks.length - 1, Math.floor(f * peaks.length))] ?? 0) * Math.min(1, clip.volume);
      const bh = Math.max(1, p * (h - 2));
      ctx.fillRect(x, (h - bh) / 2, 1, bh);
    }
  }, [w, clip.inPoint, clip.duration, clip.speed, clip.volume, asset]);
  return <canvas ref={ref} className="waveform" height={40} style={{ width: '100%' }} />;
}
