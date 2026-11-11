import type { Project } from '../types';

/**
 * Minimal IndexedDB persistence: the project JSON and every media blob are stored locally
 * so the editor restores the last session on reload.
 */
const DB_NAME = 'video-editor';
const DB_VERSION = 1;
const STORE_PROJECT = 'project';
const STORE_MEDIA = 'media';
const PROJECT_KEY = 'current';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECT)) db.createObjectStore(STORE_PROJECT);
      if (!db.objectStoreNames.contains(STORE_MEDIA)) db.createObjectStore(STORE_MEDIA);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const persist = {
  saveProject: (p: Project) => tx(STORE_PROJECT, 'readwrite', (s) => s.put(p, PROJECT_KEY)),
  loadProject: () => tx<Project | undefined>(STORE_PROJECT, 'readonly', (s) => s.get(PROJECT_KEY)),
  saveMedia: (id: string, blob: Blob) => tx(STORE_MEDIA, 'readwrite', (s) => s.put(blob, id)),
  loadMedia: (id: string) => tx<Blob | undefined>(STORE_MEDIA, 'readonly', (s) => s.get(id)),
  deleteMedia: (id: string) => tx(STORE_MEDIA, 'readwrite', (s) => s.delete(id)),
  mediaKeys: () => tx<IDBValidKey[]>(STORE_MEDIA, 'readonly', (s) => s.getAllKeys()),
  clear: async () => {
    await tx(STORE_PROJECT, 'readwrite', (s) => s.clear());
    await tx(STORE_MEDIA, 'readwrite', (s) => s.clear());
  },
};
