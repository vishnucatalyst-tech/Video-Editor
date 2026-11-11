import { useEffect } from 'react';
import { useEditor } from '../store/editor';
import { engine } from '../engine/engine';
import { projectDuration } from '../lib/timeline';

export function togglePlay() {
  const s = useEditor.getState();
  if (engine.isExporting) return;
  if (!s.playing) engine.ensureAudio();
  s.setPlaying(!s.playing);
}

export function stepFrames(n: number) {
  const s = useEditor.getState();
  const fps = s.project.settings.fps;
  s.setPlaying(false);
  const frame = Math.round(s.playhead * fps) + n;
  s.setPlayhead(frame / fps);
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    el.isContentEditable ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (tag === 'INPUT' && !['range', 'checkbox', 'button', 'color'].includes((el as HTMLInputElement).type))
  );
}

export function useKeyboardShortcuts({ onHelp, onExport }: { onHelp: () => void; onExport: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || engine.isExporting) return;
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      let handled = true;

      if (mod && key === 'z' && !e.shiftKey) s.undo();
      else if (mod && ((key === 'z' && e.shiftKey) || key === 'y')) s.redo();
      else if (mod && key === 'd') s.duplicateSelected();
      else if (mod && key === 'a') s.select(Object.keys(s.project.clips));
      else if (mod && key === 'e') onExport();
      else if (mod) handled = false;
      else if (e.key === ' ' || key === 'k') togglePlay();
      else if (key === 's' || key === 'b') s.splitAtPlayhead();
      else if (e.key === 'Delete' || e.key === 'Backspace') s.deleteSelected(e.shiftKey);
      else if (e.key === 'ArrowLeft') stepFrames(e.shiftKey ? -s.project.settings.fps : -1);
      else if (e.key === 'ArrowRight') stepFrames(e.shiftKey ? s.project.settings.fps : 1);
      else if (key === 'j') stepFrames(-s.project.settings.fps);
      else if (key === 'l') stepFrames(s.project.settings.fps);
      else if (e.key === 'Home') s.setPlayhead(0);
      else if (e.key === 'End') s.setPlayhead(projectDuration(s.project));
      else if (e.key === '=' || e.key === '+') s.setZoom(s.zoom * 1.25);
      else if (e.key === '-' || e.key === '_') s.setZoom(s.zoom / 1.25);
      else if (key === 't') s.addTextClip();
      else if (key === 'n') s.setSnapping(!s.snapping);
      else if (e.key === 'Escape') s.select([]);
      else if (e.key === '?') onHelp();
      else handled = false;

      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onHelp, onExport]);
}

export const SHORTCUTS: [string, string][] = [
  ['Space / K', 'Play / pause'],
  ['← / →', 'Step one frame'],
  ['Shift + ← / →  ·  J / L', 'Step one second'],
  ['Home / End', 'Go to start / end'],
  ['S / B', 'Split at playhead'],
  ['Delete', 'Delete selected clips'],
  ['Shift + Delete', 'Ripple delete (close the gap)'],
  ['Ctrl/⌘ + D', 'Duplicate selected clips'],
  ['Ctrl/⌘ + A', 'Select all clips'],
  ['Ctrl/⌘ + Z', 'Undo'],
  ['Ctrl/⌘ + Shift + Z  ·  Ctrl + Y', 'Redo'],
  ['T', 'Add text at playhead'],
  ['N', 'Toggle snapping'],
  ['+ / −  ·  Ctrl + wheel', 'Zoom timeline'],
  ['Ctrl/⌘ + E', 'Export video'],
  ['Esc', 'Clear selection'],
  ['?', 'Show this help'],
];
