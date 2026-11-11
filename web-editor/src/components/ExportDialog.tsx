import { useMemo, useRef, useState } from 'react';
import { useEditor } from '../store/editor';
import { engine, exportFormats } from '../engine/engine';
import { downloadBlob } from '../lib/autosave';
import { formatTime, projectDuration } from '../lib/timeline';
import { Icon } from './Icon';

const QUALITY = [
  { label: 'Draft', bppf: 0.04 },
  { label: 'Standard', bppf: 0.08 },
  { label: 'High', bppf: 0.15 },
];

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const formats = useMemo(exportFormats, []);
  const [format, setFormat] = useState(0);
  const [quality, setQuality] = useState(1);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; name: string; size: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const duration = projectDuration(project);
  const { width, height, fps, name } = project.settings;
  const bitrate = Math.round(width * height * fps * QUALITY[quality].bppf);
  const estimateMB = (bitrate * duration) / 8 / 1024 / 1024;

  const start = async () => {
    const f = formats[format];
    if (!f) return;
    setError(null);
    setResult(null);
    setProgress(0);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const blob = await engine.export({
        mimeType: f.mimeType,
        videoBitsPerSecond: bitrate,
        onProgress: setProgress,
        signal: ac.signal,
      });
      const fileName = `${(name || 'video').replace(/[^\w\- ]+/g, '').trim() || 'video'}.${f.ext}`;
      setResult({ url: URL.createObjectURL(blob), name: fileName, size: blob.size });
      downloadBlob(blob, fileName);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message || String(e));
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  };

  const busy = progress !== null;

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="export-title" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="export-title">Export video</h2>
          <button className="btn ghost icon" onClick={onClose} disabled={busy} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        {duration <= 0 ? (
          <p className="muted">The timeline is empty — add some media first.</p>
        ) : formats.length === 0 ? (
          <p className="error">This browser can't record video (MediaRecorder unavailable). Try a recent Chrome, Edge or Firefox.</p>
        ) : (
          <div className="stack">
            <dl className="summary">
              <dt>Resolution</dt>
              <dd>
                {width}×{height} @ {fps} fps
              </dd>
              <dt>Duration</dt>
              <dd>{formatTime(duration, fps)}</dd>
              <dt>Estimated size</dt>
              <dd>~{estimateMB < 1 ? estimateMB.toFixed(1) : Math.round(estimateMB)} MB</dd>
            </dl>
            <label className="field">
              <span>Format</span>
              <select value={format} onChange={(e) => setFormat(+e.target.value)} disabled={busy}>
                {formats.map((f, i) => (
                  <option key={f.mimeType} value={i}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Quality</span>
              <div className="segmented">
                {QUALITY.map((q, i) => (
                  <button key={q.label} type="button" className={quality === i ? 'active' : ''} onClick={() => setQuality(i)} disabled={busy}>
                    {q.label}
                  </button>
                ))}
              </div>
            </label>
            <p className="muted small">
              Export renders in real time ({formatTime(duration, fps)}). Keep this tab open and visible until it finishes. Change
              resolution and frame rate in the Project panel.
            </p>
            {busy && (
              <div className="progress" role="progressbar" aria-valuenow={Math.round(progress! * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div style={{ width: `${progress! * 100}%` }} />
                <span>{Math.round(progress! * 100)}%</span>
              </div>
            )}
            {error && <p className="error">Export failed: {error}</p>}
            {result && (
              <p className="success">
                Done — {(result.size / 1024 / 1024).toFixed(1)} MB.{' '}
                <a href={result.url} download={result.name}>
                  Download again
                </a>
              </p>
            )}
            <div className="row gap-xs end">
              {busy ? (
                <button className="btn danger" onClick={() => abortRef.current?.abort()}>
                  Cancel
                </button>
              ) : (
                <>
                  <button className="btn" onClick={onClose}>
                    Close
                  </button>
                  <button className="btn primary" onClick={start}>
                    <Icon name="download" /> Export
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
