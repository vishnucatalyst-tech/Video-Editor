import { useRef, useSyncExternalStore } from 'react';
import { useEditor } from '../store/editor';
import { autosaveStatus, exportProjectJson, readProjectJson } from '../lib/autosave';
import { persist } from '../lib/persist';
import { mediaRegistry } from '../lib/mediaRegistry';
import { toast } from './Toasts';
import { Icon } from './Icon';

export function Toolbar({ onExport, onHelp }: { onExport: () => void; onHelp: () => void }) {
  const name = useEditor((s) => s.project.settings.name);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const updateSettings = useEditor((s) => s.updateSettings);
  const saveState = useSyncExternalStore(autosaveStatus.subscribe, autosaveStatus.get);
  const fileRef = useRef<HTMLInputElement>(null);

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
    </header>
  );
}
