'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { ROLE_LABELS, UserRole } from '@/lib/ep-types';

/**
 * Модалка создания аккаунта администратором.
 * Один аккаунт — один набор ролей (один пароль):
 *   «Учитель» — учительский кабинет;
 *   «Администратор» — кабинет администратора (создаёт только главный админ);
 *   обе галочки — гибрид с двумя кабинетами и переключателем.
 * Почта уникальна (она же логин).
 *
 * Два режима пароля:
 *  - «Выслать пароль на почту» (по умолчанию, если почта настроена):
 *    сервер сам генерирует временный пароль и отправляет приглашение;
 *    админ пароль не видит. Если письмо не ушло — сервер вернёт пароль
 *    один раз, чтобы передать его вручную (fallback-блок).
 *  - «Ввести пароль вручную» — прежнее поведение с полем и генератором.
 */

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  return Array.from(arr, v => chars[v % chars.length]).join('');
}

interface CreatedAccount {
  email: string;
  roles: UserRole[];
  /** Пароль известен: ручной режим ИЛИ fallback «письмо не ушло» */
  password?: string;
  /** Режим «на почту»: true — выслан, false — не удалось (см. password/emailError) */
  emailSent?: boolean;
  emailError?: string;
}

export function EpAdminCreateUserModal() {
  const currentUser = useAppStore(s => s.currentUser);
  const closeModal = useAppStore(s => s.closeModal);
  const addToast = useAppStore(s => s.addToast);
  const isMainAdmin = !!currentUser?.roles?.includes('MAIN_ADMIN');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [asTeacher, setAsTeacher] = useState(true);
  const [asAdmin, setAsAdmin] = useState(false);
  const [sendByEmail, setSendByEmail] = useState(true);
  const [mailConfigured, setMailConfigured] = useState<boolean | null>(null);
  const [password, setPassword] = useState(() => generatePassword());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedAccount | null>(null);

  // Статус почты — чтобы сразу предложить верный режим отправки пароля
  useEffect(() => {
    let alive = true;
    fetch('/api/admin/mail-test')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive || !d) return;
        const ok = !!d.configured;
        setMailConfigured(ok);
        if (!ok) setSendByEmail(false);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const rolesLabel = (roles: UserRole[]) =>
    roles.map(r => ROLE_LABELS[r]).join(' + ') || 'Учитель';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError('');
    if (!name.trim()) return setError('Укажите имя');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Введите корректный email');
    if (!sendByEmail && password.length < 4) return setError('Пароль должен быть не менее 4 символов');

    const roles: UserRole[] = [];
    if (asTeacher) roles.push('TEACHER');
    if (asAdmin) roles.push('ADMIN');
    if (roles.length === 0) return setError('Выберите хотя бы одну роль');
    if (asAdmin && !isMainAdmin) return setError('Администраторов создаёт только главный администратор');

    setPending(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          roles,
          ...(sendByEmail ? { sendByEmail: true } : { password }),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || `Не удалось создать аккаунт (код ${res.status})`);
        return;
      }
      if (sendByEmail) {
        setCreated({
          email: email.trim(),
          roles,
          emailSent: json?.emailSent === true,
          password: json?.oneTimePassword,
          emailError: json?.emailError,
        });
        addToast(json?.emailSent ? 'Аккаунт создан, пароль выслан на почту' : 'Аккаунт создан', 'success');
      } else {
        setCreated({ email: email.trim(), roles, password });
        addToast('Аккаунт создан', 'success');
      }
    } catch {
      setError('Нет соединения с сервером');
    } finally {
      setPending(false);
    }
  };

  const copyCredentials = () => {
    if (!created?.password) return;
    const text = `EnglishPro — доступ к платформе\nСайт: откройте ссылку приложения\nЛогин: ${created.email}\nПароль: ${created.password}\nРоли: ${rolesLabel(created.roles)}\nПри первом входе система попросит сменить пароль.`;
    void navigator.clipboard?.writeText(text).catch(() => {});
    addToast('Учётные данные скопированы', 'success');
  };

  return (
    <div className="p-6 md:p-8 w-full max-w-md">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold">
          <i className="fa-solid fa-user-plus mr-2 ep-accent-color" />
          Новый пользователь
        </h3>
        <button className="ep-btn-ghost" onClick={closeModal} aria-label="Закрыть">
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      {created ? (
        /* ─── Аккаунт создан ─── */
        <div>
          {created.emailSent === false ? (
            /* Fallback: письмо не ушло — пароль показываем один раз для ручной передачи */
            <>
              <div
                className="p-3 rounded-lg text-xs font-semibold mb-4"
                style={{
                  background: 'rgba(255,179,0,0.12)',
                  border: '1px solid rgba(255,179,0,0.3)',
                  color: '#d97706',
                }}
                role="status"
              >
                <i className="fa-solid fa-triangle-exclamation mr-1" />
                Аккаунт создан, но письмо отправить не удалось{created.emailError ? `: ${created.emailError}` : ''}.
                Передайте временный пароль пользователю вручную.
              </div>
              <div className="ep-bg-base rounded-lg p-4 mb-3 font-mono text-sm space-y-2">
                <div className="font-sans text-[10px] font-bold uppercase tracking-wide ep-muted mb-1">
                  {rolesLabel(created.roles)}
                </div>
                <div>
                  <span className="ep-muted text-xs font-sans">Логин: </span>
                  {created.email}
                </div>
                <div>
                  <span className="ep-muted text-xs font-sans">Временный пароль: </span>
                  <span className="font-bold select-all">{created.password}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="ep-btn-accent flex-1 py-2.5 text-sm" onClick={copyCredentials}>
                  <i className="fa-solid fa-copy mr-2" />
                  Скопировать данные
                </button>
                <button className="ep-btn-accent flex-1 py-2.5 text-sm" onClick={closeModal}>
                  Готово
                </button>
              </div>
            </>
          ) : created.emailSent === true ? (
            /* Пароль выслан на почту — админу его не показываем */
            <>
              <div
                className="p-3 rounded-lg text-xs font-semibold mb-4"
                style={{
                  background: 'rgba(0,229,160,0.1)',
                  border: '1px solid rgba(0,229,160,0.25)',
                  color: 'var(--ep-accent)',
                }}
              >
                <i className="fa-solid fa-envelope-circle-check mr-1" />
                Аккаунт создан. Временный пароль выслан на {created.email} — при первом входе пользователь сменит его.
              </div>
              <div className="ep-bg-base rounded-lg p-4 mb-3 font-mono text-sm space-y-2">
                <div className="font-sans text-[10px] font-bold uppercase tracking-wide ep-muted mb-1">
                  {rolesLabel(created.roles)}
                </div>
                <div>
                  <span className="ep-muted text-xs font-sans">Логин: </span>
                  {created.email}
                </div>
                <div>
                  <span className="ep-muted text-xs font-sans">Роли: </span>
                  {rolesLabel(created.roles)}
                </div>
              </div>
              <button className="ep-btn-accent w-full py-2.5 text-sm" onClick={closeModal}>
                Готово
              </button>
            </>
          ) : (
            /* Ручной режим: админ задал пароль сам — показываем данные для передачи */
            <>
              <div
                className="p-3 rounded-lg text-xs font-semibold mb-4"
                style={{
                  background: 'rgba(0,229,160,0.1)',
                  border: '1px solid rgba(0,229,160,0.25)',
                  color: 'var(--ep-accent)',
                }}
              >
                <i className="fa-solid fa-check mr-1" />
                Аккаунт создан. Передайте данные пользователю — при первом входе он сменит пароль.
              </div>
              <div className="ep-bg-base rounded-lg p-4 mb-3 font-mono text-sm space-y-2">
                <div className="font-sans text-[10px] font-bold uppercase tracking-wide ep-muted mb-1">
                  {rolesLabel(created.roles)}
                </div>
                <div>
                  <span className="ep-muted text-xs font-sans">Логин: </span>
                  {created.email}
                </div>
                <div>
                  <span className="ep-muted text-xs font-sans">Временный пароль: </span>
                  <span className="font-bold select-all">{created.password}</span>
                </div>
                <div>
                  <span className="ep-muted text-xs font-sans">Роли: </span>
                  {rolesLabel(created.roles)}
                  {created.roles.length > 1 && (
                    <span className="ep-muted text-xs font-sans"> (переключение кабинетов в настройках)</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="ep-btn-accent flex-1 py-2.5 text-sm" onClick={copyCredentials}>
                  <i className="fa-solid fa-copy mr-2" />
                  Скопировать данные
                </button>
                <button className="ep-btn-accent flex-1 py-2.5 text-sm" onClick={closeModal}>
                  Готово
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        /* ─── Форма создания ─── */
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              className="p-3 rounded-lg text-xs font-semibold"
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

          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Имя</label>
            <input className="ep-input" placeholder="Имя пользователя" required value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Email (логин)</label>
            <input className="ep-input" type="text" inputMode="email" placeholder="user@example.com" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="off" />
            <p className="text-[10px] ep-muted mt-1 mb-0">Почта уникальна: у одного человека — один аккаунт</p>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">
              Роли
              <span className="font-normal ep-muted text-[10px] ml-2">(можно обе — один пароль, два кабинета)</span>
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer select-none ep-card border ep-border rounded-lg p-3">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={asTeacher}
                  onChange={e => setAsTeacher(e.target.checked)}
                />
                <span className="text-xs">
                  <span className="font-semibold">{ROLE_LABELS.TEACHER}</span>
                  <span className="block text-[10px] ep-muted mt-0.5">
                    Ученики, занятия, абонементы, финансы — учительский кабинет
                  </span>
                </span>
              </label>
              {isMainAdmin && (
                <label className="flex items-start gap-2 cursor-pointer select-none ep-card border ep-border rounded-lg p-3">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={asAdmin}
                    onChange={e => setAsAdmin(e.target.checked)}
                  />
                  <span className="text-xs">
                    <span className="font-semibold">{ROLE_LABELS.ADMIN}</span>
                    <span className="block text-[10px] ep-muted mt-0.5">
                      Пользователи, статистика, журнал — кабинет администратора
                    </span>
                  </span>
                </label>
              )}
            </div>
            {!isMainAdmin && (
              <p className="text-[10px] ep-muted mt-1 mb-0">Администраторов создаёт только главный администратор</p>
            )}
          </div>

          {/* Режим пароля: выслать на почту или задать вручную */}
          <div className="ep-card border ep-border rounded-lg p-3 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={sendByEmail}
                disabled={mailConfigured === false}
                onChange={e => setSendByEmail(e.target.checked)}
              />
              <span className="text-xs">
                <span className="font-semibold">
                  <i className="fa-solid fa-envelope mr-1.5 ep-accent-color" />
                  Выслать пароль на почту
                </span>
                <span className="block text-[10px] ep-muted mt-0.5">
                  {mailConfigured === false
                    ? 'Почта не настроена — задайте пароль вручную'
                    : 'Сгенерируем временный пароль и отправим его на указанную почту. Вы его не увидите.'}
                </span>
              </span>
            </label>
            {!sendByEmail && mailConfigured !== null && (
              <button
                type="button"
                className="text-[10px] ep-muted underline hover:opacity-80"
                onClick={() => setSendByEmail(true)}
              >
                Вернуть отправку на почту
              </button>
            )}
          </div>

          {!sendByEmail && (
            <div>
              <label className="block text-xs font-semibold mb-2 ep-muted">Временный пароль</label>
              <div className="flex gap-2">
                <input
                  className="ep-input flex-1 font-mono"
                  placeholder="Пароль"
                  required
                  minLength={4}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="px-3 rounded-lg ep-card border ep-border text-xs font-semibold flex-shrink-0"
                  onClick={() => setPassword(generatePassword())}
                  title="Сгенерировать новый пароль"
                >
                  <i className="fa-solid fa-dice-five mr-1" />
                  Сгенерировать
                </button>
              </div>
            </div>
          )}

          <button type="submit" className="ep-btn-accent w-full py-3 text-base" disabled={pending}>
            {pending ? (
              <>
                <i className="fa-solid fa-spinner fa-spin mr-2" />{sendByEmail ? 'Создание и отправка…' : 'Создание…'}
              </>
            ) : sendByEmail ? (
              <>
                <i className="fa-solid fa-paper-plane mr-2" />
                Создать и выслать пароль
              </>
            ) : (
              'Создать аккаунт'
            )}
          </button>
        </form>
      )}
    </div>
  );
}
