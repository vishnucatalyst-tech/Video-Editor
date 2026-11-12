/**
 * Reading and writing Reel project folders. Chrome/Edge: File System Access API (read + write in
 * place, folder remembered across reloads). Other browsers: read-only folder upload, and saving
 * downloads cutlist.json / words.json to copy into work/ by hand.
 */
import { useEditor } from '../store/editor';
import { mediaRegistry } from './mediaRegistry';
import { detectKind, probeFile } from './media';
import { persist } from './persist';
import { cutlistToProject, projectToCutlist, type CutList, type ReelExport, type Word } from './reel';
import type { MediaAsset, Project } from '../types';

type DirHandle = FileSystemDirectoryHandle & {
  values(): AsyncIterable<FileSystemHandle>;
  queryPermission?(o: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
};
declare global {
  interface Window {
    showDirectoryPicker?: (o?: { mode?: 'read' | 'readwrite'; id?: string }) => Promise<DirHandle>;
  }
}

let linked: DirHandle | null = null;
const HANDLE_KEY = 'reel-dir';

export const canWriteFolders = () => typeof window !== 'undefined' && !!window.showDirectoryPicker;

/** path → File for every file under a folder handle. */
async function walk(dir: DirHandle, prefix = ''): Promise<Map<string, File>> {
  const out = new Map<string, File>();
  for await (const entry of dir.values()) {
    const path = prefix + entry.name;
    if (entry.kind === 'file') out.set(path, await (entry as FileSystemFileHandle).getFile());
    else if (!entry.name.startsWith('.') && entry.name !== 'export' && entry.name !== 'node_modules') {
      for (const [p, f] of await walk(entry as DirHandle, path + '/')) out.set(p, f);
    }
  }
  return out;
}

function pickFolderFallback(): Promise<{ name: string; files: Map<string, File> } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
    input.onchange = () => {
      const list = [...(input.files ?? [])];
      if (!list.length) return resolve(null);
      const root = list[0].webkitRelativePath.split('/')[0];
      const files = new Map<string, File>();
      for (const f of list) files.set(f.webkitRelativePath.slice(root.length + 1), f);
      resolve({ name: root, files });
    };
    input.click();
  });
}

export interface OpenResult {
  name: string;
  shots: number;
  captions: number;
  missing: string[];
  writable: boolean;
}

/** Let the user pick a Reel project folder and load it as the current editor project. */
export async function openReelFolder(): Promise<OpenResult | null> {
  let name: string;
  let files: Map<string, File>;
  let handle: DirHandle | null = null;
  if (window.showDirectoryPicker) {
    try {
      handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'reel-project' });
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return null;
      throw e;
    }
    name = handle.name;
    files = await walk(handle);
  } else {
    const picked = await pickFolderFallback();
    if (!picked) return null;
    ({ name, files } = picked);
  }

  const cutFile = files.get('work/cutlist.json');
  if (!cutFile) throw new Error(`"${name}" has no work/cutlist.json. Pick a Reel project folder (brands/<brand>/projects/<date_topic>) after running /cutlist.`);
  const cut = JSON.parse(await cutFile.text()) as CutList;
  if (!Array.isArray(cut.segments)) throw new Error('work/cutlist.json has no segments.');
  const wordsFile = files.get('work/words.json');
  const words: Word[] = wordsFile ? JSON.parse(await wordsFile.text()) : [];

  // Import every file the cut list refers to (plus nothing else, to keep it fast).
  const wanted = new Set([...cut.segments.map((s) => s.src), cut.voiceover?.src, cut.music?.src].filter(Boolean) as string[]);
  useEditor.getState().newProject();
  const assets: Record<string, MediaAsset> = {};
  const bySrc = new Map<string, MediaAsset>();
  for (const src of wanted) {
    const file = files.get(src);
    if (!file || !detectKind(file)) continue;
    const tmp = URL.createObjectURL(file);
    try {
      const asset = { ...(await probeFile(file, tmp)), source: src };
      mediaRegistry.set(asset.id, file);
      void persist.saveMedia(asset.id, file).catch(() => undefined);
      assets[asset.id] = asset;
      bySrc.set(src, asset);
    } finally {
      URL.revokeObjectURL(tmp);
    }
  }

  const { project, missing } = cutlistToProject(cut, words, (src) => bySrc.get(src), name);
  useEditor.getState().loadProject({ ...project, assets });
  linked = handle;
  if (handle) void persist.saveHandle(HANDLE_KEY, handle).catch(() => undefined);
  const clips = Object.values(project.clips);
  return {
    name,
    shots: cut.segments.length,
    captions: clips.filter((c) => c.text).length,
    missing,
    writable: !!handle,
  };
}

export interface SaveResult extends ReelExport {
  mode: 'folder' | 'download';
  folder: string;
}

/** Write the edited timeline back to work/cutlist.json and work/words.json. */
export async function saveReel(project: Project): Promise<SaveResult> {
  if (!project.reel) throw new Error('This project was not opened from a Reel folder.');
  const exp = projectToCutlist(project);
  const cutJson = JSON.stringify(exp.cutlist, null, 2) + '\n';
  const wordsJson = JSON.stringify(exp.words, null, 1) + '\n';
  const md = cutlistMarkdown(project.reel.name, exp);

  let dir = linked;
  if (!dir && canWriteFolders()) {
    const stored = (await persist.loadHandle(HANDLE_KEY).catch(() => undefined)) as DirHandle | undefined;
    if (stored && stored.name === project.reel.name) dir = stored;
  }
  if (dir && dir.name === project.reel.name) {
    let perm = (await dir.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
    if (perm !== 'granted') perm = (await dir.requestPermission?.({ mode: 'readwrite' })) ?? 'denied';
    if (perm === 'granted') {
      linked = dir;
      const work = await dir.getDirectoryHandle('work', { create: true });
      // Copy media added in the editor into raw/ so the pipeline can find it.
      if (exp.newFiles.length) {
        const raw = await dir.getDirectoryHandle('raw', { create: true });
        for (const a of exp.newFiles) {
          const blob = mediaRegistry.get(a.id);
          if (!blob) continue;
          await writeFile(raw, a.name, blob);
          useEditor.setState((s) => ({ project: { ...s.project, assets: { ...s.project.assets, [a.id]: { ...a, source: `raw/${a.name}` } } } }));
        }
      }
      await writeFile(work, 'cutlist.json', new Blob([cutJson], { type: 'application/json' }));
      await writeFile(work, 'words.json', new Blob([wordsJson], { type: 'application/json' }));
      await writeFile(work, 'cutlist.md', new Blob([md], { type: 'text/markdown' }));
      return { ...exp, mode: 'folder', folder: project.reel.name };
    }
  }

  download(new Blob([cutJson], { type: 'application/json' }), 'cutlist.json');
  download(new Blob([wordsJson], { type: 'application/json' }), 'words.json');
  return { ...exp, mode: 'download', folder: project.reel.name };
}

async function writeFile(dir: FileSystemDirectoryHandle, name: string, blob: Blob) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await (fh as FileSystemFileHandle & { createWritable(): Promise<FileSystemWritableFileStream> }).createWritable();
  await w.write(blob);
  await w.close();
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function cutlistMarkdown(name: string, exp: ReelExport): string {
  const c = exp.cutlist;
  const lines = [
    `# Cut list — ${name}`,
    '',
    `Length **${(c.length ?? 0).toFixed(2)}s** · ${c.fps} fps · ${c.segments.length} cuts · edited in the web editor on ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    '',
    '| # | Timeline | Source | In → Out | Punch-in | Notes |',
    '|---|---|---|---|---|---|',
  ];
  let t = 0;
  c.segments.forEach((s, i) => {
    const d = s.out - s.in;
    lines.push(`| ${i + 1} | ${t.toFixed(2)} → ${(t + d).toFixed(2)} | ${s.src.split('/').pop()} | ${s.in.toFixed(2)} → ${s.out.toFixed(2)} | ${(s.punch_in ?? 1).toFixed(2)}× | ${s.note ?? ''} |`);
    t += d;
  });
  lines.push('', `Captions: ${exp.words.length} words — re-run \`/captions\` so the styled captions match.`);
  if (exp.warnings.length) lines.push('', '## Warnings', '', ...exp.warnings.map((w) => `- ${w}`));
  return lines.join('\n') + '\n';
}
