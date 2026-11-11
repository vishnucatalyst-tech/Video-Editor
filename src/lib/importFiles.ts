import { useEditor } from '../store/editor';
import { mediaRegistry } from './mediaRegistry';
import { detectKind, probeFile } from './media';
import { persist } from './persist';

export interface ImportResult {
  imported: string[];
  errors: string[];
}

/** Probe, register, persist and add files to the project's media bin. */
export async function importFiles(files: Iterable<File>): Promise<ImportResult> {
  const result: ImportResult = { imported: [], errors: [] };
  for (const file of files) {
    if (!detectKind(file)) {
      result.errors.push(`${file.name}: unsupported file type`);
      continue;
    }
    const tmpUrl = URL.createObjectURL(file);
    try {
      const asset = await probeFile(file, tmpUrl);
      mediaRegistry.set(asset.id, file);
      useEditor.getState().addAsset(asset);
      result.imported.push(asset.id);
      persist.saveMedia(asset.id, file).catch((e) => console.warn('Could not persist media', e));
    } catch (e) {
      result.errors.push(`${file.name}: ${(e as Error).message}`);
    } finally {
      URL.revokeObjectURL(tmpUrl);
    }
  }
  return result;
}

export function pickFiles(accept = 'video/*,audio/*,image/*'): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = accept;
    input.onchange = () => resolve(input.files ? [...input.files] : []);
    input.click();
  });
}
