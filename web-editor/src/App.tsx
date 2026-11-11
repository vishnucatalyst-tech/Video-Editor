import { useEffect, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { MediaBin } from './components/MediaBin';
import { Preview } from './components/Preview';
import { Inspector } from './components/Inspector';
import { Timeline } from './components/Timeline';
import { ExportDialog } from './components/ExportDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { restoreAndAutosave } from './lib/autosave';
import { importFiles } from './lib/importFiles';
import { engine } from './engine/engine';
import { toast, Toasts } from './components/Toasts';

export default function App() {
  const [ready, setReady] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    engine.start();
    restoreAndAutosave().finally(() => setReady(true));
  }, []);

  useKeyboardShortcuts({ onHelp: () => setHelpOpen((o) => !o), onExport: () => setExportOpen(true) });

  const onDrop = async (e: React.DragEvent) => {
    setDragOver(false);
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    const { imported, errors } = await importFiles(e.dataTransfer.files);
    if (imported.length) toast(`Imported ${imported.length} file${imported.length > 1 ? 's' : ''}`);
    errors.forEach((err) => toast(err, 'error'));
  };

  return (
    <div
      className="app"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      <Toolbar onExport={() => setExportOpen(true)} onHelp={() => setHelpOpen(true)} />
      <main className="workspace">
        <MediaBin />
        <Preview />
        <Inspector />
      </main>
      <Timeline />
      {!ready && <div className="loading">Restoring your project…</div>}
      {dragOver && <div className="drop-overlay">Drop media files to import</div>}
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
      {helpOpen && <ShortcutsDialog onClose={() => setHelpOpen(false)} />}
      <Toasts />
    </div>
  );
}
