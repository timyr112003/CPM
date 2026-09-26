'use client';

import { useState } from 'react';

/**
 * Экран задания нового пароля по токену из письма «Забыли пароль?».
 * Открывается на главном маршруте, когда в адресе есть ?reset=<токен>
 * (см. EpApp). После успешной смены возвращаем человека на форму входа.
 */
export function EpResetPassword({ token, onDone }: { token: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError('');
    if (password.length < 4) {
      setError('Пароль должен быть не менее 4 символов');
      return;
    }
    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setDone(true);
      } else {
        setError(json?.error || 'Не удалось задать новый пароль');
      }
    } catch {
      setError('Сеть недоступна — попробуйте ещё раз');
    }
    setPending(false);
  };

  return (
    <div className="auth-bg">
      <div className="ep-card p-8 w-full max-w-md mx-4 ep-scale-in relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4 ep-accent-dim-bg">
            <i className={`fa-solid ${done ? 'fa-circle-check' : 'fa-lock'} text-2xl ep-accent-color`} />
          </div>
          <h1 className="text-2xl font-bold mb-1">Новый пароль</h1>
          <p className="text-sm ep-muted">
            {done ? 'Пароль изменён — можно входить' : 'Придумайте новый пароль для вашего аккаунта'}
          </p>
        </div>

        {done ? (
          <>
            <div
              className="mb-5 p-3 rounded-lg text-xs font-semibold"
              style={{
                background: 'rgba(0,229,160,0.1)',
                border: '1px solid rgba(0,229,160,0.25)',
                color: 'var(--ep-accent)',
              }}
            >
              <i className="fa-solid fa-check mr-1.5" />
              Готово! Все прежние сессии завершены — войдите с новым паролем.
            </div>
            <button onClick={onDone} className="ep-btn-accent w-full py-3 text-base">
              <i className="fa-solid fa-arrow-right-to-bracket mr-2" />
              Перейти ко входу
            </button>
          </>
        ) : (
          <>
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
                <label className="block text-xs font-semibold mb-2 ep-muted">Новый пароль</label>
                <input
                  type="password"
                  className="ep-input"
                  placeholder="Не менее 4 символов"
                  required
                  minLength={4}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2 ep-muted">Повторите пароль</label>
                <input
                  type="password"
                  className="ep-input"
                  placeholder="Ещё раз"
                  required
                  minLength={4}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className="ep-btn-accent w-full py-3 text-base mt-2" disabled={pending}>
                {pending ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin mr-2" />Сохраняем…
                  </>
                ) : (
                  'Сохранить пароль'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
