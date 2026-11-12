import { useEffect } from 'react';
import { Icon } from './Icon';
import type { SaveResult } from '../lib/reelIO';

export function ReelDialog({ result, onClose }: { result: SaveResult; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const c = result.cutlist;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="reel-title" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="reel-title">{result.mode === 'folder' ? 'Saved to Reel project' : 'Cut list downloaded'}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="stack">
          <dl className="summary">
            <dt>Project</dt>
            <dd>{result.folder}</dd>
            <dt>Length</dt>
            <dd>{(c.length ?? 0).toFixed(2)} s</dd>
            <dt>Shots</dt>
            <dd>{c.segments.length}</dd>
            <dt>Caption words</dt>
            <dd>{result.words.length}</dd>
          </dl>
          {result.mode === 'folder' ? (
            <p className="muted small">
              Wrote <code>work/cutlist.json</code>, <code>work/words.json</code> and <code>work/cutlist.md</code>
              {result.newFiles.length ? `, and copied ${result.newFiles.length} new media file(s) into raw/` : ''}.
            </p>
          ) : (
            <p className="muted small">
              This browser can't write to folders. Move the downloaded <code>cutlist.json</code> and <code>words.json</code> into the
              project's <code>work/</code> folder
              {result.newFiles.length ? ` and copy ${result.newFiles.map((f) => f.name).join(', ')} into raw/` : ''}. In Chrome or Edge this
              happens automatically.
            </p>
          )}
          {result.warnings.length > 0 && (
            <div className="inspector-section">
              <header>
                <h3>Check before rendering</h3>
              </header>
              <ul className="tips">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="inspector-section">
            <header>
              <h3>Next: render with the pipeline</h3>
            </header>
            <p className="muted small">Ask Claude in the project, or run:</p>
            <pre className="code">
              {`python tools/captions.py <project>${'\n'}python tools/render.py <project> --preview${'\n'}python tools/render.py <project> --final`}
            </pre>
            <p className="muted small">
              or the slash commands <code>/captions</code>, <code>/preview</code>, <code>/final</code>.
            </p>
          </div>
          <div className="row gap-xs end">
            <button className="btn primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
