'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/ep-store';

/**
 * Экран входа. Один аккаунт — один логин/пароль (почта уникальна).
 * Если у аккаунта две роли (учитель + админ), после входа показывается
 * выбор кабинета (EpCabinetChoice), а не выбор аккаунта.
 *
 * «Забыли пароль?» — встроенная форма восстановления: вводим почту, сервер
 * шлёт письмо со ссылкой на сброс (?reset=токен обрабатывает EpApp →
 * EpResetPassword). Ответ сервера всегда успешный и не раскрывает,
 * зарегистрирована такая почта или нет.
 */
export function EpAuth() {
  const login = useAppStore(s => s.login);
  const addToast = useAppStore(s => s.addToast);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  // «Забыли пароль?»: форма запроса письма (mode='forgot') и её состояние
  const [mode, setMode] = useState<'login' | 'forgot' | 'forgot-sent'>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPending, setForgotPending] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    const res = await login(email, password);
    setPending(false);
    if (res.ok) {
      addToast('Добро пожаловать!', 'success');
    } else {
      setError(res.error || 'Не удалось войти');
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotPending) return;
    setForgotPending(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
    } catch {
      // игнорируем сетевые сбои: сообщение не должно зависеть от результата
    }
    setForgotPending(false);
    setMode('forgot-sent');
  };

  const backToLogin = () => {
    setMode('login');
    setError('');
    setPassword('');
  };

  return (
    <div className="auth-bg">
      <div className="ep-card p-8 w-full max-w-md mx-4 ep-scale-in relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4 ep-accent-dim-bg">
            <i className="fa-solid fa-language text-2xl ep-accent-color" />
          </div>
          <h1 className="text-2xl font-bold mb-1">EnglishPro</h1>
          <p className="text-sm ep-muted">Платформа для репетитора английского</p>
        </div>

        {mode === 'login' && (
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

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-2 ep-muted">Email</label>
                <input type="email" className="ep-input" placeholder="your@email.com" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2 ep-muted">Пароль</label>
                <input type="password" className="ep-input" placeholder="Введите пароль" required minLength={4} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <button type="submit" className="ep-btn-accent w-full py-3 text-base mt-2" disabled={pending}>
                {pending ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin mr-2" />Вход…
                  </>
                ) : (
                  'Войти'
                )}
              </button>
            </form>

            <button
              type="button"
              onClick={() => { setForgotEmail(email); setMode('forgot'); }}
              className="block mx-auto mt-4 text-xs ep-muted hover:opacity-80 underline underline-offset-2 cursor-pointer bg-transparent border-0"
            >
              <i className="fa-solid fa-key mr-1" />
              Забыли пароль?
            </button>

            <p className="text-xs ep-muted text-center mt-6 mb-0">
              <i className="fa-solid fa-user-shield mr-1" />
              Регистрация по приглашению: аккаунты создаёт администратор
            </p>
            <p className="text-xs ep-muted text-center mt-2 mb-0">
              <i className="fa-solid fa-cloud mr-1" />
              Данные хранятся на сервере и доступны с телефона и компьютера
            </p>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3" style={{ background: 'rgba(91,108,240,0.12)' }}>
                <i className="fa-solid fa-key text-xl ep-accent-color" />
              </div>
              <h2 className="text-lg font-bold mb-1">Восстановление пароля</h2>
              <p className="text-xs ep-muted">
                Введите почту аккаунта — пришлём письмо со ссылкой для задания нового пароля
              </p>
            </div>
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-2 ep-muted">Email</label>
                <input
                  type="email"
                  className="ep-input"
                  placeholder="your@email.com"
                  required
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <button type="submit" className="ep-btn-accent w-full py-3 text-base" disabled={forgotPending}>
                {forgotPending ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin mr-2" />Отправляем…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane mr-2" />Отправить письмо
                  </>
                )}
              </button>
            </form>
            <button
              type="button"
              onClick={backToLogin}
              className="block mx-auto mt-4 text-xs ep-muted hover:opacity-80 cursor-pointer bg-transparent border-0"
            >
              <i className="fa-solid fa-arrow-left mr-1" />
              Вернуться ко входу
            </button>
          </>
        )}

        {mode === 'forgot-sent' && (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3" style={{ background: 'rgba(0,229,160,0.12)' }}>
                <i className="fa-solid fa-envelope-circle-check text-xl ep-accent-color" />
              </div>
              <h2 className="text-lg font-bold mb-1">Письмо отправлено</h2>
              <p className="text-xs ep-muted" style={{ whiteSpace: 'pre-line' }}>
                {'Если почта '}<b>{forgotEmail}</b>{' зарегистрирована в EnglishPro, на неё уже уходит письмо со ссылкой для восстановления.\n\nСсылка действует 60 минут и срабатывает один раз.'}
              </p>
            </div>
            <div
              className="mb-5 p-3 rounded-lg text-xs"
              style={{ background: 'rgba(91,108,240,0.08)', border: '1px solid rgba(91,108,240,0.2)' }}
            >
              <i className="fa-solid fa-circle-info mr-1.5 ep-accent-color" />
              Не нашлось письмо? Проверьте папку «Спам» — и подождите пару минут.
            </div>
            <button onClick={backToLogin} className="ep-btn-ghost w-full py-2.5 text-sm">
              <i className="fa-solid fa-arrow-left mr-2" />
              Вернуться ко входу
            </button>
          </>
        )}
      </div>
    </div>
  );
}
