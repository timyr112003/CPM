'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/ep-store';

export function EpConfirmDialog() {
  const confirmDialog = useAppStore(s => s.confirmDialog);
  const closeConfirm = useAppStore(s => s.closeConfirm);

  // Esc для закрытия
  useEffect(() => {
    if (!confirmDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmDialog, closeConfirm]);

  if (!confirmDialog) return null;

  const handleConfirm = () => {
    const onConfirm = confirmDialog.onConfirm;
    closeConfirm();
    onConfirm();
  };

  const isDanger = confirmDialog.danger !== false; // по умолчанию true
  const label = confirmDialog.confirmLabel || (isDanger ? 'Удалить' : 'ОК');
  const icon = confirmDialog.confirmIcon || (isDanger ? 'fa-trash' : 'fa-check');
  const accentColor = isDanger ? 'var(--ep-danger)' : 'var(--ep-accent)';
  const accentBg = isDanger ? 'rgba(255,92,92,0.12)' : 'rgba(0,229,160,0.12)';
  const btnClass = isDanger ? 'ep-btn-danger' : 'ep-btn-accent';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-5"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-message"
      onClick={() => closeConfirm()}
    >
      <div
        className="ep-modal-card p-6 max-w-sm w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: accentBg }}
          >
            <i
              className={`fa-solid ${isDanger ? 'fa-triangle-exclamation' : 'fa-circle-info'}`}
              style={{ color: accentColor }}
            />
          </div>
          <p id="confirm-dialog-message" className="text-sm pt-2">{confirmDialog.message}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={closeConfirm} className="ep-btn-ghost text-sm py-2 px-4">Отмена</button>
          <button onClick={handleConfirm} className={`${btnClass} text-sm py-2 px-4`}>
            <i className={`fa-solid ${icon} mr-1.5`} />{label}
          </button>
        </div>
      </div>
    </div>
  );
}
