/**
 * Holds the actual media blobs (which can be large and aren't serialisable into the
 * project state) and their object URLs, keyed by asset id.
 */
const blobs = new Map<string, Blob>();
const urls = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;
const notify = () => {
  version++;
  listeners.forEach((l) => l());
};

export const mediaRegistry = {
  set(id: string, blob: Blob) {
    this.delete(id);
    blobs.set(id, blob);
    urls.set(id, URL.createObjectURL(blob));
    notify();
  },
  get(id: string): Blob | undefined {
    return blobs.get(id);
  },
  url(id: string): string | undefined {
    return urls.get(id);
  },
  has(id: string) {
    return blobs.has(id);
  },
  delete(id: string) {
    const u = urls.get(id);
    if (u) URL.revokeObjectURL(u);
    urls.delete(id);
    blobs.delete(id);
  },
  clear() {
    for (const id of [...blobs.keys()]) this.delete(id);
    notify();
  },
  /** Increments whenever media is added or cleared (for useSyncExternalStore). */
  version: () => version,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
