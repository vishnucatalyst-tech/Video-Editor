import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../store/editor';
import { engine } from '../engine/engine';
import { formatTime, projectDuration } from '../lib/timeline';
import { stepFrames, togglePlay } from '../hooks/useKeyboardShortcuts';
import { downloadBlob } from '../lib/autosave';
import { Icon } from './Icon';

export function Preview() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = useEditor((s) => s.project.settings);
  const [box, setBox] = useState({ w: 0, h: 0 });

  // Fit the canvas to the available space, preserving the project aspect ratio.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      const s = Math.min(r.width / width, r.height / height);
      setBox({ w: Math.floor(width * s), h: Math.floor(height * s) });
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [width, height]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !box.w) return;
    // Render at device resolution, but never above the project resolution.
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.min(width, Math.round(box.w * dpr));
    c.height = Math.round((c.width * height) / width);
    engine.attachPreview(c);
    return () => engine.attachPreview(null);
  }, [box, width, height]);

  // Drag a visual clip in the preview to reposition it.
  const drag = useRef<{ id: string; startX: number; startY: number; ox: number; oy: number } | null>(null);
  const toProject = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * width, y: ((e.clientY - r.top) / r.height) * height };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const s = useEditor.getState();
    const p = toProject(e);
    const hit = engine.hitTest(s.project, s.playhead, p.x, p.y);
    if (!hit) {
      s.select([]);
      return;
    }
    const track = s.project.tracks.find((t) => t.id === hit.trackId);
    s.select([hit.id]);
    if (track?.locked) return;
    s.beginGesture();
    drag.current = { id: hit.id, startX: p.x, startY: p.y, ox: hit.transform.x, oy: hit.transform.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toProject(e);
    let x = d.ox + (p.x - d.startX) / width;
    let y = d.oy + (p.y - d.startY) / height;
    // Snap to centre lines.
    if (!e.altKey) {
      if (Math.abs(x) < 0.01) x = 0;
      if (Math.abs(y) < 0.01) y = 0;
    }
    useEditor.getState().updateLive((proj) => {
      const c = proj.clips[d.id];
      return c ? { ...proj, clips: { ...proj.clips, [d.id]: { ...c, transform: { ...c.transform, x, y } } } } : proj;
    });
  };

  const onPointerUp = () => {
    if (drag.current) useEditor.getState().endGesture();
    drag.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    // Alt + wheel scales the selected visual clip.
    if (!e.altKey) return;
    const s = useEditor.getState();
    const id = s.selection[0];
    const c = id ? s.project.clips[id] : undefined;
    if (!c || c.assetId && s.project.assets[c.assetId]?.kind === 'audio') return;
    const scale = Math.max(0.05, Math.min(10, c.transform.scale * (e.deltaY < 0 ? 1.05 : 1 / 1.05)));
    s.updateClip(c.id, { transform: { ...c.transform, scale } }, `wheel-scale:${c.id}`);
  };

  return (
    <section className="panel preview" aria-label="Preview">
      <div className="preview-stage" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          style={{ width: box.w, height: box.h }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          aria-label="Video preview. Drag a clip to move it; Alt + scroll to resize."
        />
      </div>
      <Transport />
    </section>
  );
}

function Transport() {
  const playing = useEditor((s) => s.playing);
  const playhead = useEditor((s) => s.playhead);
  const fps = useEditor((s) => s.project.settings.fps);
  const duration = useEditor((s) => projectDuration(s.project));
  const setPlayhead = useEditor((s) => s.setPlayhead);

  const snapshot = async () => {
    const blob = await engine.snapshot(playhead);
    if (blob) downloadBlob(blob, `frame-${formatTime(playhead, fps).replace(/:/g, '-')}.png`);
  };

  return (
    <div className="transport">
      <span className="timecode" title="Current time">
        {formatTime(playhead, fps)}
      </span>
      <div className="transport-buttons">
        <button className="btn ghost icon" onClick={() => setPlayhead(0)} title="Go to start (Home)" aria-label="Go to start">
          <Icon name="toStart" />
        </button>
        <button className="btn ghost icon" onClick={() => stepFrames(-1)} title="Previous frame (←)" aria-label="Previous frame">
          <Icon name="stepBack" />
        </button>
        <button className="btn play" onClick={togglePlay} title="Play / pause (Space)" aria-label={playing ? 'Pause' : 'Play'}>
          <Icon name={playing ? 'pause' : 'play'} size={20} />
        </button>
        <button className="btn ghost icon" onClick={() => stepFrames(1)} title="Next frame (→)" aria-label="Next frame">
          <Icon name="stepFwd" />
        </button>
        <button className="btn ghost icon" onClick={() => setPlayhead(duration)} title="Go to end (End)" aria-label="Go to end">
          <Icon name="toEnd" />
        </button>
      </div>
      <div className="row gap-xs">
        <button className="btn ghost icon" onClick={snapshot} title="Save current frame as PNG" aria-label="Save frame as PNG" disabled={!duration}>
          <Icon name="camera" />
        </button>
        <span className="timecode dim" title="Total duration">
          {formatTime(duration, fps)}
        </span>
      </div>
    </div>
  );
}
