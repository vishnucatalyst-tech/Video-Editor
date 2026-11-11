import { useState, useSyncExternalStore } from 'react';
import { useEditor } from '../store/editor';
import { importFiles, pickFiles } from '../lib/importFiles';
import { mediaRegistry } from '../lib/mediaRegistry';
import { persist } from '../lib/persist';
import { formatShort } from '../lib/timeline';
import { toast } from './Toasts';
import { Icon } from './Icon';
import type { MediaAsset } from '../types';

export const ASSET_DRAG_TYPE = 'application/x-video-editor-asset';

export function MediaBin() {
  const assets = useEditor((s) => s.project.assets);
  const clips = useEditor((s) => s.project.clips);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'video' | 'audio' | 'image'>('all');
  // Re-render when media blobs are (re)linked.
  useSyncExternalStore(mediaRegistry.subscribe, mediaRegistry.version);

  const list = Object.values(assets).filter((a) => filter === 'all' || a.kind === filter);

  const doImport = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    const { imported, errors } = await importFiles(files);
    setBusy(false);
    if (imported.length) toast(`Imported ${imported.length} file${imported.length > 1 ? 's' : ''}`);
    errors.forEach((e) => toast(e, 'error'));
  };

  const usage = (id: string) => Object.values(clips).filter((c) => c.assetId === id).length;

  return (
    <section className="panel media-bin" aria-label="Media">
      <div className="panel-header">
        <h2>Media</h2>
        <div className="row gap-xs">
          <button className="btn small" onClick={() => useEditor.getState().addTextClip()} title="Add a text clip at the playhead (T)">
            <Icon name="text" /> Text
          </button>
          <button className="btn small primary" onClick={async () => doImport(await pickFiles())} disabled={busy}>
            <Icon name="upload" /> {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
      <div className="segmented" role="tablist">
        {(['all', 'video', 'audio', 'image'] as const).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <div className="panel-body">
        {list.length === 0 ? (
          <button className="empty-drop" onClick={async () => doImport(await pickFiles())}>
            <Icon name="upload" size={28} />
            <strong>Import media</strong>
            <span>Drop video, audio or image files anywhere, or click to browse.</span>
          </button>
        ) : (
          <ul className="asset-grid">
            {list.map((a) => (
              <AssetCard key={a.id} asset={a} used={usage(a.id)} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AssetCard({ asset, used }: { asset: MediaAsset; used: number }) {
  const online = mediaRegistry.has(asset.id);
  const addToTimeline = useEditor((s) => s.addAssetToTimeline);
  const removeAsset = useEditor((s) => s.removeAsset);

  const relink = async () => {
    const [file] = await pickFiles();
    if (!file) return;
    mediaRegistry.set(asset.id, file);
    void persist.saveMedia(asset.id, file).catch(() => undefined);
    toast(`Relinked ${asset.name}`);
  };

  return (
    <li
      className={`asset ${online ? '' : 'offline'}`}
      draggable={online}
      onDragStart={(e) => {
        e.dataTransfer.setData(ASSET_DRAG_TYPE, asset.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onDoubleClick={() => online && addToTimeline(asset.id)}
      title={`${asset.name}\nDouble-click or drag onto the timeline`}
    >
      <div className="asset-thumb">
        {asset.thumbnail ? (
          <img src={asset.thumbnail} alt="" draggable={false} />
        ) : asset.peaks ? (
          <MiniWave peaks={asset.peaks} />
        ) : (
          <Icon name={asset.kind === 'audio' ? 'music' : asset.kind === 'image' ? 'image' : 'film'} size={28} />
        )}
        <span className="asset-badge">
          <Icon name={asset.kind === 'audio' ? 'music' : asset.kind === 'image' ? 'image' : 'film'} size={12} />
          {asset.kind !== 'image' && formatShort(asset.duration)}
        </span>
        {used > 0 && <span className="asset-used">{used}×</span>}
        <div className="asset-actions">
          {online ? (
            <button className="btn tiny" onClick={() => addToTimeline(asset.id)} title="Add to timeline" aria-label="Add to timeline">
              <Icon name="plus" size={14} />
            </button>
          ) : (
            <button className="btn tiny" onClick={relink} title="Media missing — relink file">
              Relink
            </button>
          )}
          <button
            className="btn tiny danger"
            onClick={() => {
              if (!used || confirm(`Remove "${asset.name}" and its ${used} clip(s) from the timeline?`)) removeAsset(asset.id);
            }}
            title="Remove from project"
            aria-label="Remove from project"
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>
      <div className="asset-name">{asset.name}</div>
    </li>
  );
}

function MiniWave({ peaks }: { peaks: number[] }) {
  const n = 60;
  const step = peaks.length / n;
  const bars = Array.from({ length: n }, (_, i) => peaks[Math.floor(i * step)] ?? 0);
  return (
    <svg className="mini-wave" viewBox={`0 0 ${n} 40`} preserveAspectRatio="none" aria-hidden>
      {bars.map((p, i) => (
        <rect key={i} x={i + 0.15} width={0.7} y={20 - Math.max(1, p * 18)} height={Math.max(2, p * 36)} />
      ))}
    </svg>
  );
}
