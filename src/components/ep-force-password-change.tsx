'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/ep-store';

/** Экран принудительной смены временного пароля (выдаётся администратором) */
export function EpForcePasswordChange() {
  const changePassword = useAppStore(s => s.changePassword);
  const addToast = useAppStore(s => s.addToast);
  const currentUser = useAppStore(s => s.currentUser);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError('');
    if (next.length < 4) {
      setError('Новый пароль должен быть не менее 4 символов');
      return;
    }
    if (next !== repeat) {
      setError('Пароли не совпадают');
      return;
    }
    setPending(true);
    const res = await changePassword(current, next);
    setPending(false);
    if (res.ok) {
      addToast('Пароль изменён. Добро пожаловать!', 'success');
    } else {
      setError(res.error || 'Не удалось изменить пароль');
    }
  };

  return (
    <div className="auth-bg">
      <div className="ep-card p-8 w-full max-w-md mx-4 ep-scale-in relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4 ep-accent-dim-bg">
            <i className="fa-solid fa-key text-2xl ep-accent-color" />
          </div>
          <h1 className="text-xl font-bold mb-1">Смените временный пароль</h1>
          <p className="text-sm ep-muted">
            {currentUser?.email ? `Аккаунт ${currentUser.email}` : 'Ваш аккаунт'} · administrator выдал вам
            временный пароль — придумайте свой
          </p>
        </div>

        {error && (
          <div
            className="mb-4 p-3 rounded-lg text-xs font-semibold"
            style={{
              background: 'rgba(255,92,92,0.1)',
              border: '1px solid rgba(255,92,92,0.2)',
              color: 'var(--ep-danger)',
            }}
            role="alert"
          >
            <i className="fa-solid fa-circle-exclamation mr-1" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Временный пароль</label>
            <input
              type="password"
              className="ep-input"
              placeholder="Пароль, выданный администратором"
              required
              value={current}
              onChange={e => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Новый пароль</label>
            <input
              type="password"
              className="ep-input"
              placeholder="Минимум 4 символа"
              required
              minLength={4}
              value={next}
              onChange={e => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Повторите новый пароль</label>
            <input
              type="password"
              className="ep-input"
              placeholder="Ещё раз новый пароль"
              required
              value={repeat}
              onChange={e => setRepeat(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="ep-btn-accent w-full py-3 text-base mt-2" disabled={pending}>
            {pending ? (
              <>
                <i className="fa-solid fa-spinner fa-spin mr-2" />Сохранение…
              </>
            ) : (
              'Сохранить пароль'
            )}
          </button>
        </form>

        <p className="text-xs ep-muted text-center mt-6 mb-0">
          <i className="fa-solid fa-shield-halved mr-1" />
          Пока пароль не сменён, работать с данными нельзя
        </p>
      </div>
    </div>
  );
}
