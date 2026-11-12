import { useRef, useState, useSyncExternalStore } from 'react';
import { useEditor } from '../store/editor';
import { autosaveStatus, exportProjectJson, readProjectJson } from '../lib/autosave';
import { persist } from '../lib/persist';
import { mediaRegistry } from '../lib/mediaRegistry';
import { toast } from './Toasts';
import { Icon } from './Icon';
import { ReelDialog } from './ReelDialog';
import { openReelFolder, saveReel, type SaveResult } from '../lib/reelIO';

export function Toolbar({ onExport, onHelp }: { onExport: () => void; onHelp: () => void }) {
  const name = useEditor((s) => s.project.settings.name);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const updateSettings = useEditor((s) => s.updateSettings);
  const saveState = useSyncExternalStore(autosaveStatus.subscribe, autosaveStatus.get);
  const fileRef = useRef<HTMLInputElement>(null);
  const reel = useEditor((s) => s.project.reel);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<SaveResult | null>(null);

  const openReel = async () => {
    const hasWork = Object.keys(useEditor.getState().project.clips).length > 0;
    if (hasWork && !confirm('Open a Reel project? It replaces the current timeline (save it first if you need it).')) return;
    setBusy(true);
    try {
      const r = await openReelFolder();
      if (r) {
        toast(`Opened ${r.name}: ${r.shots} shots, ${r.captions} captions${r.writable ? '' : ' (read-only in this browser)'}`);
        if (r.missing.length) toast(`Missing in the folder: ${r.missing.join(', ')}`, 'error');
      }
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveToReel = async () => {
    setBusy(true);
    try {
      setSaved(await saveReel(useEditor.getState().project));
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const newProject = async () => {
    if (!confirm('Start a new project? The current project and its imported media will be removed.')) return;
    useEditor.getState().newProject();
    await persist.clear().catch(() => undefined);
    toast('New project created');
  };

  const openProject = async (file: File) => {
    try {
      const project = await readProjectJson(file);
      useEditor.getState().loadProject(project);
      const missing = Object.keys(project.assets).filter((id) => !mediaRegistry.has(id));
      toast(
        missing.length
          ? `Project opened. ${missing.length} media file(s) are not in this browser and will appear offline.`
          : 'Project opened',
        missing.length ? 'error' : 'info',
      );
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="logo" aria-hidden>
          <Icon name="play" />
        </span>
        <input
          className="project-name"
          value={name}
          aria-label="Project name"
          onChange={(e) => updateSettings({ name: e.target.value })}
        />
        <span className={`save-state save-${saveState}`}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All changes saved' : saveState === 'error' ? 'Autosave failed' : ''}
        </span>
      </div>
      <div className="toolbar-group">
        <button className="btn ghost" onClick={newProject} title="New project">
          <Icon name="file" /> New
        </button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()} title="Open a project file (.json)">
          <Icon name="folder" /> Open
        </button>
        <button
          className="btn ghost"
          onClick={() => exportProjectJson(useEditor.getState().project)}
          title="Save the timeline as a project file (.json)"
        >
          <Icon name="save" /> Save
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void openProject(f);
            e.target.value = '';
          }}
        />
        <span className="divider" />
        <button className="btn ghost" onClick={openReel} disabled={busy} title="Open a Weequb Reel project folder (brands/<brand>/projects/<date_topic>) to edit its cut list on the timeline">
          <Icon name="film" /> Open Reel
        </button>
        {reel && (
          <button className="btn toggle on" onClick={saveToReel} disabled={busy} title={`Write the timeline back to ${reel.name}/work/cutlist.json and words.json`}>
            <Icon name="save" /> Save to Reel
          </button>
        )}
        <span className="divider" />
        <button className="btn ghost icon" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
          <Icon name="undo" />
        </button>
        <button className="btn ghost icon" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
          <Icon name="redo" />
        </button>
        <button className="btn ghost icon" onClick={onHelp} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
          <Icon name="keyboard" />
        </button>
        <button className="btn primary" onClick={onExport} title="Export video (Ctrl+E)">
          <Icon name="download" /> Export
        </button>
      </div>
      {saved && <ReelDialog result={saved} onClose={() => setSaved(null)} />}
    </header>
  );
}
