import { useEffect } from 'react';
import { SHORTCUTS } from '../hooks/useKeyboardShortcuts';
import { Icon } from './Icon';

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="keys-title" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="keys-title">Keyboard shortcuts</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <table className="shortcuts">
          <tbody>
            {SHORTCUTS.map(([k, d]) => (
              <tr key={k}>
                <td>
                  <kbd>{k}</kbd>
                </td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
