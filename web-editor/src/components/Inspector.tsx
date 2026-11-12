import { useEditor, selectedClip } from '../store/editor';
import { FONT_FAMILIES, FPS_PRESETS, RESOLUTION_PRESETS } from '../lib/defaults';
import { neighbourBounds, MIN_CLIP_DURATION, formatTime } from '../lib/timeline';
import type { Clip, ColorAdjust, MediaAsset, Project, TextStyle, Transform } from '../types';
import { Icon } from './Icon';

export function Inspector() {
  const clip = useEditor(selectedClip);
  const selectionCount = useEditor((s) => s.selection.length);
  const project = useEditor((s) => s.project);

  return (
    <aside className="panel inspector" aria-label="Inspector">
      <div className="panel-header">
        <h2>{clip ? (clip.text ? 'Text' : (project.assets[clip.assetId!]?.kind ?? 'Clip').replace(/^./, (c) => c.toUpperCase())) : selectionCount > 1 ? 'Selection' : 'Project'}</h2>
      </div>
      <div className="panel-body">
        {clip ? (
          <ClipInspector clip={clip} project={project} />
        ) : selectionCount > 1 ? (
          <MultiInspector count={selectionCount} />
        ) : (
          <ProjectInspector project={project} />
        )}
      </div>
    </aside>
  );
}

function MultiInspector({ count }: { count: number }) {
  const s = useEditor.getState();
  return (
    <div className="stack">
      <p className="muted">{count} clips selected.</p>
      <div className="row gap-xs">
        <button className="btn" onClick={() => s.duplicateSelected()}>
          <Icon name="copy" /> Duplicate
        </button>
        <button className="btn danger" onClick={() => s.deleteSelected()}>
          <Icon name="trash" /> Delete
        </button>
      </div>
    </div>
  );
}

function ProjectInspector({ project }: { project: Project }) {
  const update = useEditor((s) => s.updateSettings);
  const { width, height, fps, background } = project.settings;
  const presetIdx = RESOLUTION_PRESETS.findIndex((p) => p.width === width && p.height === height);
  return (
    <div className="stack">
      <Section title="Canvas">
        <Field label="Format">
          <select
            value={presetIdx === -1 ? 'custom' : presetIdx}
            onChange={(e) => {
              if (e.target.value === 'custom') return;
              const p = RESOLUTION_PRESETS[+e.target.value];
              update({ width: p.width, height: p.height });
            }}
          >
            {RESOLUTION_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </Field>
        <div className="row gap-xs">
          <Field label="Width">
            <input type="number" min={16} max={7680} step={2} value={width} onChange={(e) => update({ width: even(+e.target.value) })} />
          </Field>
          <Field label="Height">
            <input type="number" min={16} max={7680} step={2} value={height} onChange={(e) => update({ height: even(+e.target.value) })} />
          </Field>
        </div>
        <Field label="Frame rate">
          <select value={fps} onChange={(e) => update({ fps: +e.target.value })}>
            {FPS_PRESETS.map((f) => (
              <option key={f} value={f}>
                {f} fps
              </option>
            ))}
          </select>
        </Field>
        <Field label="Background">
          <input type="color" value={background} onChange={(e) => update({ background: e.target.value })} />
        </Field>
      </Section>
      <Section title="Getting started">
        <ol className="tips">
          <li>Import media with the Import button or by dropping files onto the window.</li>
          <li>Drag media onto a track, or double-click it to append to the timeline.</li>
          <li>Drag clips to move them; drag their edges to trim. Press S to split at the playhead.</li>
          <li>Select a clip to adjust position, color, speed, volume, fades and text here.</li>
          <li>Click Export to render an MP4/WebM video.</li>
        </ol>
      </Section>
    </div>
  );
}

const even = (n: number) => Math.max(16, Math.round((n || 16) / 2) * 2);

function ClipInspector({ clip, project }: { clip: Clip; project: Project }) {
  const updateClip = useEditor((s) => s.updateClip);
  const asset = clip.assetId ? project.assets[clip.assetId] : undefined;
  const isVisual = !!clip.text || asset?.kind === 'video' || asset?.kind === 'image';
  const hasAudio = asset?.kind === 'video' || asset?.kind === 'audio';
  const isTimeBased = asset?.kind === 'video' || asset?.kind === 'audio';
  const track = project.tracks.find((t) => t.id === clip.trackId);
  const locked = !!track?.locked;
  const set = (patch: Partial<Clip>, key?: string) => updateClip(clip.id, patch, key);
  const setT = (patch: Partial<Transform>) => set({ transform: { ...clip.transform, ...patch } }, `t:${clip.id}:${Object.keys(patch)}`);
  const setC = (patch: Partial<ColorAdjust>) => set({ color: { ...clip.color, ...patch } }, `c:${clip.id}:${Object.keys(patch)}`);
  const setText = (patch: Partial<TextStyle>) => set({ text: { ...clip.text!, ...patch } }, `x:${clip.id}:${Object.keys(patch)}`);

  const setSpeed = (speed: number) => {
    const [, nextStart] = neighbourBounds(project, clip);
    const span = clip.duration * clip.speed;
    const maxDur = Math.min(nextStart - clip.start, asset ? (asset.duration - clip.inPoint) / speed : Infinity);
    const duration = Math.max(MIN_CLIP_DURATION, Math.min(span / speed, maxDur));
    set({ speed, duration }, `speed:${clip.id}`);
  };

  return (
    <fieldset className="stack" disabled={locked}>
      {locked && <p className="muted">This clip is on a locked track.</p>}
      {asset && <p className="asset-title" title={asset.name}>{asset.name}</p>}
      {project.reel && asset && asset.kind !== 'audio' && (
        <Section title="Reel shot">
          <Field label="Note (saved to the cut list)">
            <input value={clip.note ?? ''} onChange={(e) => set({ note: e.target.value }, `note:${clip.id}`)} placeholder="e.g. hook, product close-up" />
          </Field>
          <p className="muted small">Scale above 100% becomes a punch-in (style guide: 105–115%). Framing, colour and fades are decided by the pipeline at render time.</p>
        </Section>
      )}
      {project.reel && clip.text && (
        <p className="muted small">Caption text and timing are saved to words.json. The brand caption style is applied by /captions, so the look here is only a preview.</p>
      )}

      {clip.text && (
        <Section title="Text">
          <textarea rows={3} value={clip.text.text} onChange={(e) => setText({ text: e.target.value })} aria-label="Text content" />
          <Field label="Font">
            <select value={clip.text.fontFamily} onChange={(e) => setText({ fontFamily: e.target.value })}>
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f.split(',')[0].replace(/"/g, '')}
                </option>
              ))}
            </select>
          </Field>
          <Slider label="Size" min={8} max={400} step={1} value={clip.text.fontSize} onChange={(v) => setText({ fontSize: v })} />
          <div className="row gap-xs">
            <Field label="Weight">
              <select value={clip.text.fontWeight} onChange={(e) => setText({ fontWeight: +e.target.value })}>
                {[300, 400, 500, 600, 700, 800, 900].map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Align">
              <select value={clip.text.align} onChange={(e) => setText({ align: e.target.value as CanvasTextAlign })}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </Field>
          </div>
          <div className="row gap-xs">
            <Field label="Color">
              <input type="color" value={clip.text.color} onChange={(e) => setText({ color: e.target.value })} />
            </Field>
            <Field label="Box">
              <div className="row gap-xs">
                <input
                  type="checkbox"
                  checked={!!clip.text.background}
                  onChange={(e) => setText({ background: e.target.checked ? '#000000aa' : '' })}
                  aria-label="Background box"
                />
                {clip.text.background && (
                  <input
                    type="color"
                    value={clip.text.background.slice(0, 7)}
                    onChange={(e) => setText({ background: e.target.value + 'aa' })}
                    aria-label="Box color"
                  />
                )}
              </div>
            </Field>
          </div>
        </Section>
      )}

      <Section title="Timing">
        <div className="row gap-xs">
          <Field label="Start">
            <NumberInput value={clip.start} step={0.1} min={0} onChange={(v) => {
              const [prevEnd, nextStart] = neighbourBounds(project, clip);
              set({ start: Math.max(prevEnd, Math.min(v, nextStart - clip.duration)) });
            }} />
          </Field>
          <Field label="Duration">
            <NumberInput value={clip.duration} step={0.1} min={MIN_CLIP_DURATION} onChange={(v) => {
              const [, nextStart] = neighbourBounds(project, clip);
              const srcMax = isTimeBased && asset ? (asset.duration - clip.inPoint) / clip.speed : Infinity;
              const duration = Math.max(MIN_CLIP_DURATION, Math.min(v, nextStart - clip.start, srcMax));
              set({ duration, fadeIn: Math.min(clip.fadeIn, duration), fadeOut: Math.min(clip.fadeOut, duration) });
            }} />
          </Field>
        </div>
        <p className="muted small">
          {formatTime(clip.start, project.settings.fps)} → {formatTime(clip.start + clip.duration, project.settings.fps)}
          {isTimeBased && ` · source in ${clip.inPoint.toFixed(2)}s`}
        </p>
        {isTimeBased && (
          <Slider label="Speed" min={0.25} max={4} step={0.05} value={clip.speed} onChange={setSpeed} format={(v) => `${v.toFixed(2)}×`} />
        )}
        <Slider label="Fade in" min={0} max={Math.min(5, clip.duration)} step={0.05} value={clip.fadeIn} onChange={(v) => set({ fadeIn: v })} format={(v) => `${v.toFixed(2)}s`} />
        <Slider label="Fade out" min={0} max={Math.min(5, clip.duration)} step={0.05} value={clip.fadeOut} onChange={(v) => set({ fadeOut: v })} format={(v) => `${v.toFixed(2)}s`} />
      </Section>

      {hasAudio && (
        <Section title="Audio">
          <Slider label="Volume" min={0} max={2} step={0.01} value={clip.volume} onChange={(v) => set({ volume: v })} format={(v) => `${Math.round(v * 100)}%`} />
        </Section>
      )}

      {isVisual && (
        <Section
          title="Transform"
          action={
            <button className="btn tiny" onClick={() => set({ transform: { x: 0, y: 0, scale: 1, rotation: 0 }, opacity: 1 })}>
              Reset
            </button>
          }
        >
          <Slider label="Position X" min={-1} max={1} step={0.001} value={clip.transform.x} onChange={(v) => setT({ x: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Position Y" min={-1} max={1} step={0.001} value={clip.transform.y} onChange={(v) => setT({ y: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Scale" min={0.05} max={5} step={0.01} value={clip.transform.scale} onChange={(v) => setT({ scale: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Rotation" min={-180} max={180} step={1} value={clip.transform.rotation} onChange={(v) => setT({ rotation: v })} format={(v) => `${Math.round(v)}°`} />
          <Slider label="Opacity" min={0} max={1} step={0.01} value={clip.opacity} onChange={(v) => set({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
          {asset && asset.kind !== 'audio' && (
            <div className="row gap-xs">
              <button className="btn small" onClick={() => setT({ scale: 1, x: 0, y: 0 })}>
                <Icon name="fit" /> Fit
              </button>
              <button className="btn small" onClick={() => setT({ scale: fillScale(asset, project), x: 0, y: 0 })}>
                <Icon name="fit" /> Fill
              </button>
            </div>
          )}
        </Section>
      )}

      {isVisual && (
        <Section
          title="Color"
          action={
            <button className="btn tiny" onClick={() => set({ color: { brightness: 1, contrast: 1, saturation: 1, blur: 0 } })}>
              Reset
            </button>
          }
        >
          <Slider label="Brightness" min={0} max={2} step={0.01} value={clip.color.brightness} onChange={(v) => setC({ brightness: v })} format={pct} />
          <Slider label="Contrast" min={0} max={2} step={0.01} value={clip.color.contrast} onChange={(v) => setC({ contrast: v })} format={pct} />
          <Slider label="Saturation" min={0} max={3} step={0.01} value={clip.color.saturation} onChange={(v) => setC({ saturation: v })} format={pct} />
          <Slider label="Blur" min={0} max={40} step={0.5} value={clip.color.blur} onChange={(v) => setC({ blur: v })} format={(v) => `${v}px`} />
        </Section>
      )}

      <div className="row gap-xs">
        <button className="btn" onClick={() => useEditor.getState().duplicateSelected()}>
          <Icon name="copy" /> Duplicate
        </button>
        <button className="btn danger" onClick={() => useEditor.getState().deleteSelected()}>
          <Icon name="trash" /> Delete
        </button>
      </div>
    </fieldset>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function fillScale(asset: MediaAsset, project: Project) {
  const { width: W, height: H } = project.settings;
  if (!asset.width || !asset.height) return 1;
  const fit = Math.min(W / asset.width, H / asset.height);
  const fill = Math.max(W / asset.width, H / asset.height);
  return fill / fit;
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="inspector-section">
      <header>
        <h3>{title}</h3>
        {action}
      </header>
      <div className="stack-sm">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NumberInput({ value, onChange, step, min }: { value: number; onChange: (v: number) => void; step: number; min?: number }) {
  return (
    <input
      type="number"
      step={step}
      min={min}
      value={+value.toFixed(3)}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }}
    />
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => String(+v.toFixed(2)),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="slider">
      <span className="slider-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
      <span className="slider-value">{format(value)}</span>
    </label>
  );
}
