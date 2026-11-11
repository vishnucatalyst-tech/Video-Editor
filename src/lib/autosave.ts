import { useEditor } from '../store/editor';
import { mediaRegistry } from './mediaRegistry';
import { persist } from './persist';
import type { Project } from '../types';

let timer: ReturnType<typeof setTimeout> | undefined;
let status: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
const listeners = new Set<() => void>();

export const autosaveStatus = {
  get: () => status,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

function setStatus(s: typeof status) {
  status = s;
  listeners.forEach((l) => l());
}

let started: Promise<void> | null = null;

/** Restore the last session from IndexedDB, then start autosaving project changes. */
export function restoreAndAutosave(): Promise<void> {
  started ??= restore();
  return started;
}

async function restore(): Promise<void> {
  try {
    const saved = await persist.loadProject();
    if (saved && isProject(saved)) {
      const keys = new Set((await persist.mediaKeys()).map(String));
      for (const id of Object.keys(saved.assets)) {
        if (!keys.has(id)) continue;
        const blob = await persist.loadMedia(id);
        if (blob) mediaRegistry.set(id, blob);
      }
      // Remove media blobs no longer referenced by the project.
      for (const k of keys) if (!saved.assets[k]) void persist.deleteMedia(k);
      useEditor.getState().loadProject(saved);
    }
  } catch (e) {
    console.warn('Could not restore previous session', e);
  }

  let last = useEditor.getState().project;
  useEditor.subscribe((s) => {
    if (s.project === last) return;
    last = s.project;
    clearTimeout(timer);
    timer = setTimeout(() => {
      setStatus('saving');
      persist
        .saveProject(last)
        .then(() => setStatus('saved'))
        .catch((e) => {
          console.warn('Autosave failed', e);
          setStatus('error');
        });
    }, 700);
  });
}

function isProject(p: unknown): p is Project {
  const o = p as Project;
  return !!o && typeof o === 'object' && !!o.settings && Array.isArray(o.tracks) && !!o.clips && !!o.assets;
}

/** Download the project timeline as JSON (media is referenced by asset id, not embedded). */
export function exportProjectJson(project: Project) {
  const blob = new Blob([JSON.stringify({ format: 'video-editor-project', version: 1, project }, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, `${project.settings.name || 'project'}.json`);
}

export async function readProjectJson(file: File): Promise<Project> {
  const data = JSON.parse(await file.text());
  const project = data?.project ?? data;
  if (!isProject(project)) throw new Error('Not a valid project file');
  return project;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
