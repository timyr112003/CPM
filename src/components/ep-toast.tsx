'use client';

import { useAppStore } from '@/lib/ep-store';

export function EpToast() {
  const toasts = useAppStore(s => s.toasts);
  const removeToast = useAppStore(s => s.removeToast);

  return (
    <div className="fixed top-5 right-5 z-[200] flex flex-col gap-3" style={{ pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          style={{ pointerEvents: 'auto' }}
          onClick={() => removeToast(t.id)}
        >
          <i className={`fa-solid ${t.type === 'success' ? 'fa-check-circle' : t.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}`} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
