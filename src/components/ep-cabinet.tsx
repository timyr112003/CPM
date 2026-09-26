'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { ROLE_LABELS, isAdminRoles, isHybridRoles } from '@/lib/ep-types';
import { SyncIndicator } from './ep-sidebar';
import { RoleBadges } from './ep-role-badges';
import { EpConfirmDialog } from './ep-confirm-dialog';
import { EpAdminCreateUserModal } from './ep-admin-create-user-modal';
import { EpPhotoEditor } from './ep-photo-editor';

/**
 * Кабинет администратора — отдельный интерфейс вместо учительского рабочего стола.
 * Открывается, когда активен админ-кабинет (у гибрида «учитель+админ» —
 * через настройки; у чистого админа — всегда).
 * Разделы: Обзор, Пользователи, Статистика, Журнал, Настройки.
 * Любые правки в данных учителей — только через «Войти» (режим управления).
 */

interface AdminUser {
  id: string;
  name: string;
  email: string;
  photo: string | null;
  roles: string[];
  status: string;
  mustChangePassword: boolean;
  createdAt: string;
}

interface StatsUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  studentsTotal: number;
  studentsActive: number;
  balanceTotal: number;
  subscriptionsActive: number;
  lessonsCompletedPeriod: number;
  lessonsPlannedPeriod: number;
  incomePeriod: number;
  expensePeriod: number;
}

interface StatsResponse {
  period: string;
  users: StatsUser[];
  totals: {
    studentsTotal: number;
    studentsActive: number;
    balanceTotal: number;
    subscriptionsActive: number;
    lessonsCompletedPeriod: number;
    incomePeriod: number;
    expensePeriod: number;
  };
  attention: {
    expiringSubscriptions: number;
    expiringTeachers: string[];
    debtStudents: number;
    debtTotal: number;
    debtTeachers: string[];
  };
}

interface AuditEntry {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetId: string | null;
  targetEmail: string | null;
  meta: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Вход в систему',
  USER_CREATED: 'Создан аккаунт',
  ROLE_ADDED: 'Роль добавлена',
  ROLE_REMOVED: 'Роль снята',
  ROLE_CHANGED: 'Изменена роль',
  USER_ARCHIVED: 'Аккаунт архивирован',
  USER_RESTORED: 'Аккаунт восстановлен',
  PASSWORD_RESET: 'Сброшен пароль',
  PASSWORD_CHANGED: 'Пароль изменён',
  IMPERSONATE_START: 'Вход в аккаунт (управление)',
  IMPERSONATE_END: 'Выход из чужого аккаунта',
  PROFILE_UPDATED: 'Обновлён профиль',
  PROFILE_UPDATED_BY_ADMIN: 'Профиль обновлён админом',
  BOOTSTRAP_MAIN_ADMIN: 'Назначен главный администратор',
};

const MONTH_NAMES = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

function fmtMoney(n: number): string {
  return `${Math.round(n).toLocaleString('ru-RU')} ₽`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  return Array.from(arr, v => chars[v % chars.length]).join('');
}

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; data: T | null; error?: string }> {
  try {
    const res = await fetch(url, { cache: 'no-store', ...init });
    const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok) return { ok: false, data: json, error: json?.error || `Ошибка ${res.status}` };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, data: null, error: 'Нет соединения с сервером' };
  }
}

type CabinetTab = 'overview' | 'users' | 'stats' | 'audit' | 'settings';

const CABINET_TABS: { key: CabinetTab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Обзор', icon: 'fa-solid fa-grip' },
  { key: 'users', label: 'Пользователи', icon: 'fa-solid fa-users' },
  { key: 'stats', label: 'Статистика', icon: 'fa-solid fa-chart-column' },
  { key: 'audit', label: 'Журнал', icon: 'fa-solid fa-clipboard-list' },
  { key: 'settings', label: 'Настройки', icon: 'fa-solid fa-gear' },
];

const TAB_TITLES: Record<CabinetTab, string> = {
  overview: 'Обзор',
  users: 'Пользователи',
  stats: 'Статистика учителей',
  audit: 'Журнал действий',
  settings: 'Настройки',
};

export function EpAdminCabinet() {
  const currentUser = useAppStore(s => s.currentUser);
  const theme = useAppStore(s => s.theme);
  const toggleTheme = useAppStore(s => s.toggleTheme);
  const logout = useAppStore(s => s.logout);
  const addToast = useAppStore(s => s.addToast);
  const activeModal = useAppStore(s => s.activeModal);
  const confirmDialog = useAppStore(s => s.confirmDialog);
  const [tab, setTab] = useState<CabinetTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const modalCardRef = useRef<HTMLDivElement>(null);

  // После закрытия модалки создания пользователя — обновить данные разделов
  // (setState во время рендера при смене «пропсов» — каноничный паттерн React)
  const [lastModal, setLastModal] = useState(activeModal);
  const [dataKey, setDataKey] = useState(0);
  if (lastModal !== activeModal) {
    setLastModal(activeModal);
    if (lastModal === 'admin-create-user' && activeModal === null) {
      setDataKey(k => k + 1);
    }
  }

  // Escape закрывает модалку (если нет диалога подтверждения поверх)
  useEffect(() => {
    if (!activeModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (useAppStore.getState().confirmDialog) return;
      useAppStore.getState().closeModal();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeModal]);

  const isMainAdmin = !!currentUser?.roles?.includes('MAIN_ADMIN');
  const avatar = currentUser?.name?.charAt(0)?.toUpperCase() || 'A';
  const userPhoto = currentUser?.photo;

  const handleLogout = async () => {
    await logout();
    addToast('Вы вышли из аккаунта', 'info');
  };

  const renderTab = () => {
    switch (tab) {
      case 'overview': return <OverviewTab dataKey={dataKey} isMainAdmin={!!isMainAdmin} onAddUser={() => useAppStore.getState().openModal('admin-create-user')} onGoUsers={() => setTab('users')} />;
      case 'users': return <UsersTab isMainAdmin={!!isMainAdmin} reloadKey={dataKey} />;
      case 'stats': return <StatsTab />;
      case 'audit': return <AuditTab />;
      case 'settings': return <CabinetSettingsTab />;
      default: return null;
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-35 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`ep-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center ep-accent-dim-bg">
              <i className="fa-solid fa-user-shield ep-accent-color" style={{ fontSize: 15 }} />
            </div>
            <div>
              <div className="font-bold text-sm">Панель администратора</div>
              <div className="text-xs ep-muted">EnglishPro</div>
            </div>
          </div>
        </div>

        {/* Переключение кабинета — в Настройках, панель «Профиль» */}

        <div className="px-2 mt-2 flex-1 overflow-y-auto">
          {CABINET_TABS.map(t => (
            <div key={t.key}>
              <div
                className={`ep-sidebar-link ${tab === t.key ? 'active' : ''}`}
                onClick={() => { setTab(t.key); setSidebarOpen(false); }}
              >
                <i className={`${t.icon}`} style={{ width: 20, textAlign: 'center', fontSize: 15 }} />
                {t.label}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t ep-border">
          <SyncIndicator />
          <div className="flex items-center gap-3 mb-3">
            {userPhoto ? (
              <img src={userPhoto} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ep-accent-dim-bg ep-accent-color flex-shrink-0">
                {avatar}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{currentUser?.name}</div>
              <div className="text-xs truncate ep-muted">{currentUser?.email}</div>
            </div>
          </div>
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-xs ep-muted">
              <i className={`fa-solid ${theme === 'dark' ? 'fa-moon' : 'fa-sun'}`} />
              <span>{theme === 'dark' ? 'Тёмная' : 'Светлая'}</span>
            </div>
            <button className="ep-theme-toggle" onClick={toggleTheme} aria-label="Переключить тему" />
          </div>
          <button onClick={handleLogout} className="ep-sidebar-link w-full justify-center mt-2" style={{ color: 'var(--ep-danger)', margin: 0 }}>
            <i className="fa-solid fa-arrow-right-from-bracket" />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-0 md:ml-60 min-h-screen relative z-1">
        <header className="sticky top-0 z-20 px-6 py-4 flex items-center justify-between ep-header">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center ep-card border ep-border"
            >
              <i className="fa-solid fa-bars text-sm" />
            </button>
            <h2 className="text-lg font-bold">{TAB_TITLES[tab]}</h2>
          </div>
          {currentUser && <RoleBadges roles={currentUser.roles} />}
        </header>

        <div className="p-6">{renderTab()}</div>
      </div>

      {/* Confirm dialog */}
      <EpConfirmDialog />

      {/* Модалка создания пользователя */}
      {activeModal === 'admin-create-user' && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center p-5 ep-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Новый пользователь"
          onClick={e => {
            if (e.target === e.currentTarget) useAppStore.getState().closeModal();
          }}
        >
          <div ref={modalCardRef} className="ep-modal-card" onClick={e => e.stopPropagation()}>
            <EpAdminCreateUserModal />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════ ОБЗОР ═══════════ */

function OverviewTab({ dataKey, isMainAdmin, onAddUser, onGoUsers }: { dataKey: number; isMainAdmin: boolean; onAddUser: () => void; onGoUsers: () => void }) {
  const startImpersonation = useAppStore(s => s.startImpersonation);
  const openConfirm = useAppStore(s => s.openConfirm);
  const addToast = useAppStore(s => s.addToast);

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const applyData = useCallback((res: { ok: boolean; data: StatsResponse | null; error?: string }, auditRes: { ok: boolean; data: { entries: AuditEntry[] } | null; error?: string }) => {
    if (res.ok && res.data) {
      setStats(res.data);
      setError('');
    } else {
      setError(res.error || 'Не удалось загрузить данные');
    }
    if (auditRes.ok && auditRes.data) setAuditEntries(auditRes.data.entries);
    setLoading(false);
  }, []);

  const fetchData = useCallback(async () => {
    const [statsRes, auditRes] = await Promise.all([
      api<StatsResponse>('/api/admin/stats?period=month'),
      api<{ entries: AuditEntry[] }>('/api/admin/audit'),
    ]);
    return { statsRes, auditRes };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchData().then(({ statsRes, auditRes }) => {
      if (alive) applyData(statsRes, auditRes);
    });
    return () => { alive = false; };
  }, [dataKey]);

  const handleImpersonate = (u: StatsUser) => {
    openConfirm(
      `Войти в аккаунт ${u.name} (${u.email})? Ваши действия будут сохраняться в его данных.`,
      async () => {
        const res = await startImpersonation(u.id);
        if (!res.ok) addToast(res.error || 'Не удалось открыть аккаунт', 'error');
      },
      { confirmLabel: 'Войти', confirmIcon: 'fa-right-to-bracket', danger: false }
    );
  };

  if (loading) {
    return (
      <div className="ep-card p-8 text-center">
        <i className="fa-solid fa-spinner fa-spin ep-muted" />
      </div>
    );
  }
  if (error || !stats) {
    return (
      <div className="ep-card p-6 text-center text-sm" style={{ color: 'var(--ep-danger)' }}>
        <i className="fa-solid fa-triangle-exclamation mr-2" />
        {error}
      </div>
    );
  }

  const teachers = stats.users.filter(u => u.roles.includes('TEACHER'));
  const selfId = useAppStore.getState().currentUser?.id;
  const now = new Date();
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  const cards = [
    { label: 'Учителя', value: String(teachers.length), icon: 'fa-chalkboard-user', hint: 'активных' },
    { label: 'Ученики', value: `${stats.totals.studentsActive}/${stats.totals.studentsTotal}`, icon: 'fa-users', hint: 'активных/всего' },
    { label: 'Абонементы', value: String(stats.totals.subscriptionsActive), icon: 'fa-ticket', hint: 'активных' },
    { label: 'Баланс учеников', value: fmtMoney(stats.totals.balanceTotal), icon: 'fa-wallet', hint: 'суммарно' },
    { label: 'Доход', value: fmtMoney(stats.totals.incomePeriod), icon: 'fa-arrow-down', hint: monthLabel, color: 'var(--ep-accent)' },
    { label: 'Расход', value: fmtMoney(stats.totals.expensePeriod), icon: 'fa-arrow-up', hint: monthLabel, color: 'var(--ep-danger)' },
  ];

  const a = stats.attention;
  const hasAttention = a.expiringSubscriptions > 0 || a.debtStudents > 0;

  return (
    <div className="space-y-4">
      {/* Быстрые действия */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm font-semibold ep-muted">
          <i className="fa-regular fa-calendar mr-2" />
          Сводка за {monthLabel}
        </div>
        <div className="flex gap-2">
          <button className="ep-btn-accent py-1.5 px-3 text-xs" onClick={() => void fetchData().then(({ statsRes, auditRes }) => applyData(statsRes, auditRes))}>
            <i className="fa-solid fa-rotate mr-1" />
            Обновить
          </button>
          <button className="ep-btn-accent py-1.5 px-3 text-xs" onClick={onAddUser}>
            <i className="fa-solid fa-user-plus mr-1" />
            Добавить пользователя
          </button>
        </div>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {cards.map(c => (
          <div key={c.label} className="ep-card p-4">
            <div className="text-xs ep-muted mb-1">
              <i className={`fa-solid ${c.icon} mr-1`} />
              {c.label}
            </div>
            <div className="text-lg font-bold" style={{ color: c.color }}>
              {c.value}
            </div>
            {c.hint && <div className="text-[10px] ep-muted mt-0.5">{c.hint}</div>}
          </div>
        ))}
      </div>

      {/* Требует внимания */}
      <div className="ep-card p-4">
        <div className="text-sm font-semibold mb-3">
          <i className="fa-solid fa-bell mr-2" style={{ color: '#ffb400' }} />
          Требует внимания
        </div>
        {hasAttention ? (
          <div className="space-y-2 text-sm">
            {a.expiringSubscriptions > 0 && (
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-ticket mt-0.5" style={{ color: '#ffb400', fontSize: 13 }} />
                <span>
                  Истекает в ближайшие 7 дней абонементов: <b>{a.expiringSubscriptions}</b>{' '}
                  <span className="ep-muted text-xs">({a.expiringTeachers.join(', ')})</span>
                </span>
              </div>
            )}
            {a.debtStudents > 0 && (
              <div className="flex items-start gap-2">
                <i className="fa-solid fa-circle-exclamation mt-0.5" style={{ color: 'var(--ep-danger)', fontSize: 13 }} />
                <span>
                  Учеников с долгом: <b>{a.debtStudents}</b> на сумму <b>{fmtMoney(a.debtTotal)}</b>{' '}
                  <span className="ep-muted text-xs">({a.debtTeachers.join(', ')})</span>
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm ep-muted">
            <i className="fa-solid fa-circle-check mr-2" style={{ color: 'var(--ep-accent)' }} />
            Всё спокойно: нет истекающих абонементов и долгов учеников
          </div>
        )}
      </div>

      {/* Топ учителей по доходу за месяц */}
      {teachers.length > 0 && (
        <div className="ep-card p-4">
          <div className="text-sm font-semibold mb-3">
            <i className="fa-solid fa-ranking-star mr-2 ep-accent-color" />
            Учителя за {monthLabel}
          </div>
          <div className="space-y-2">
            {[...teachers].sort((x, y) => y.incomePeriod - x.incomePeriod).map(u => (
              <div key={u.id} className="flex items-center gap-3 flex-wrap rounded-lg p-2 ep-bg-base">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ep-accent-dim-bg ep-accent-color flex-shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-32">
                  <div className="text-sm font-semibold">{u.name}</div>
                  <div className="text-[11px] ep-muted">
                    {u.studentsActive} учеников · {u.lessonsCompletedPeriod} занятий · {u.subscriptionsActive} абонементов
                  </div>
                </div>
                <div className="text-sm font-bold" style={{ color: 'var(--ep-accent)' }}>{fmtMoney(u.incomePeriod)}</div>
                {u.id === selfId ? (
                  <span className="px-3 py-1.5 text-xs ep-muted" title="Это ваш аккаунт">
                    <i className="fa-solid fa-circle-user mr-1" />
                    это вы
                  </span>
                ) : (
                  <button
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold ep-btn-accent"
                    onClick={() => handleImpersonate(u)}
                    title="Открыть аккаунт в режиме управления"
                  >
                    <i className="fa-solid fa-right-to-bracket mr-1" />
                    Войти
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Последние события */}
      <div className="ep-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">
            <i className="fa-solid fa-clipboard-list mr-2 ep-accent-color" />
            Последние события
          </div>
          <button className="ep-btn-ghost text-xs" onClick={onGoUsers}>
            Весь журнал
            <i className="fa-solid fa-arrow-right ml-1" />
          </button>
        </div>
        <div className="space-y-1.5">
          {auditEntries.slice(0, 8).map(e => (
            <div key={e.id} className="flex items-center gap-2 text-xs flex-wrap">
              <span className="ep-muted flex-shrink-0" style={{ minWidth: 88 }}>{fmtDateTime(e.createdAt)}</span>
              <span className="font-semibold">{ACTION_LABELS[e.action] || e.action}</span>
              {e.targetEmail && <span className="ep-muted">· {e.targetEmail}</span>}
              <span className="ep-muted ml-auto flex-shrink-0">{e.actorEmail || 'система'}</span>
            </div>
          ))}
          {auditEntries.length === 0 && <div className="text-xs ep-muted">Событий пока нет</div>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════ ПОЛЬЗОВАТЕЛИ ═══════════ */

function UsersTab({ isMainAdmin, reloadKey }: { isMainAdmin: boolean; reloadKey: number }) {
  const currentUser = useAppStore(s => s.currentUser);
  const startImpersonation = useAppStore(s => s.startImpersonation);
  const openConfirm = useAppStore(s => s.openConfirm);
  const addToast = useAppStore(s => s.addToast);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const applyUsers = useCallback((res: { ok: boolean; data: { users: AdminUser[] } | null; error?: string }) => {
    if (res.ok && res.data?.users) {
      setUsers(res.data.users);
      setError('');
    } else {
      setError(res.error || 'Не удалось загрузить список');
    }
    setLoading(false);
  }, []);

  const fetchUsers = useCallback(async () => {
    applyUsers(await api<{ users: AdminUser[] }>('/api/admin/users'));
  }, [applyUsers]);

  useEffect(() => {
    let alive = true;
    api<{ users: AdminUser[] }>('/api/admin/users').then(res => {
      if (alive) applyUsers(res);
    });
    return () => { alive = false; };
  }, [applyUsers, reloadKey]);

  const patchUser = async (u: AdminUser, body: Record<string, unknown>, successToast: string) => {
    setBusyId(u.id);
    const res = await api<{ ok: boolean }>(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (res.ok) {
      addToast(successToast, 'success');
      void fetchUsers();
    } else {
      addToast(res.error || 'Не удалось выполнить действие', 'error');
    }
  };

  const handleImpersonate = (u: AdminUser) => {
    openConfirm(
      `Войти в аккаунт ${u.name} (${u.email})? Ваши действия будут сохраняться в его данных, в журнале останется запись о входе.`,
      async () => {
        const res = await startImpersonation(u.id);
        if (!res.ok) addToast(res.error || 'Не удалось открыть аккаунт', 'error');
      },
      { confirmLabel: 'Войти', confirmIcon: 'fa-right-to-bracket', danger: false }
    );
  };

  const handleResetPassword = (u: AdminUser) => {
    const pwd = generatePassword();
    openConfirm(
      `Выдать временный пароль для ${u.name}: ${pwd} — скопируйте и передайте его. Аккаунт будет выведен из системы, при следующем входе пароль нужно сменить.`,
      async () => {
        setBusyId(u.id);
        const res = await api<{ ok: boolean }>(`/api/admin/users/${u.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'password', password: pwd }),
        });
        setBusyId(null);
        if (res.ok) {
          void navigator.clipboard?.writeText(pwd).catch(() => {});
          addToast(`Пароль скопирован в буфер: ${pwd}`, 'success');
          void fetchUsers();
        } else {
          addToast(res.error || 'Не удалось сбросить пароль', 'error');
        }
      },
      { confirmLabel: 'Сбросить', confirmIcon: 'fa-key', danger: false }
    );
  };

  const handleArchive = (u: AdminUser) => {
    openConfirm(
      `Архивировать аккаунт ${u.name} (${u.email})? Данные сохранятся, вход будет заблокирован. Позже аккаунт можно восстановить.`,
      () => void patchUser(u, { action: 'archive' }, 'Аккаунт архивирован'),
      { confirmLabel: 'Архивировать', confirmIcon: 'fa-box-archive' }
    );
  };

  const handleRestore = (u: AdminUser) => {
    void patchUser(u, { action: 'restore' }, 'Аккаунт восстановлен');
  };

  /** Добавить/снять роль (только главный админ): у учителя появляется вторая
   *  этикетка, кабинеты остаются оба; снятие роли — обратная операция */
  const handleRole = (u: AdminUser, mode: 'add' | 'remove', role: 'ADMIN' | 'TEACHER') => {
    const label = ROLE_LABELS[role];
    const verb = mode === 'add' ? 'Добавить' : 'Снять';
    openConfirm(
      `${verb} роль «${label}» у ${u.name} (${u.email})?`,
      () =>
        void patchUser(
          u,
          { action: mode === 'add' ? 'addRole' : 'removeRole', role },
          mode === 'add' ? `Роль добавлена: ${label}` : `Роль снята: ${label}`
        ),
      { confirmLabel: verb, confirmIcon: 'fa-user-pen', danger: false }
    );
  };

  const roleButton = (u: AdminUser) => {
    if (!isMainAdmin) return null;
    // Роли главного админа неизменяемы (сервер не даст) — кнопки не показываем
    if (u.roles.includes('MAIN_ADMIN')) return null;
    const isHybrid = u.roles.includes('ADMIN') && u.roles.includes('TEACHER');
    if (isHybrid)
      return (
        <>
          <button
            className="px-3 py-1.5 rounded-lg text-xs font-semibold ep-card border ep-border"
            disabled={busyId === u.id}
            onClick={() => handleRole(u, 'remove', 'ADMIN')}
            title="Снять админ-права: останется только учительский кабинет"
          >
            <i className="fa-solid fa-user-pen mr-1" />
            Снять админа
          </button>
          <button
            className="px-3 py-1.5 rounded-lg text-xs font-semibold ep-card border ep-border"
            disabled={busyId === u.id}
            onClick={() => handleRole(u, 'remove', 'TEACHER')}
            title="Снять учительскую роль: останется только кабинет администратора"
          >
            <i className="fa-solid fa-user-pen mr-1" />
            Снять учителя
          </button>
        </>
      );
    if (u.roles.includes('TEACHER'))
      return (
        <button
          className="px-3 py-1.5 rounded-lg text-xs font-semibold ep-card border ep-border"
          disabled={busyId === u.id}
          onClick={() => handleRole(u, 'add', 'ADMIN')}
          title="Добавить админ-права: появится кабинет администратора, учительский останется"
        >
          <i className="fa-solid fa-user-pen mr-1" />
          Сделать админом
        </button>
      );
    // чистый админ — можно добавить учительскую роль
    return (
      <button
        className="px-3 py-1.5 rounded-lg text-xs font-semibold ep-card border ep-border"
        disabled={busyId === u.id}
        onClick={() => handleRole(u, 'add', 'TEACHER')}
        title="Добавить учительскую роль: появится учительский кабинет"
      >
        <i className="fa-solid fa-user-pen mr-1" />
        Добавить учителя
      </button>
    );
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    : users;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <input
          className="ep-input flex-1 min-w-48"
          placeholder="Поиск по имени или email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Поиск пользователей"
        />
        <button className="ep-btn-accent" onClick={() => useAppStore.getState().openModal('admin-create-user')}>
          <i className="fa-solid fa-user-plus mr-2" />
          Добавить пользователя
        </button>
      </div>

      {loading ? (
        <div className="ep-card p-8 text-center">
          <i className="fa-solid fa-spinner fa-spin ep-muted" />
        </div>
      ) : error ? (
        <div className="ep-card p-6 text-center text-sm" style={{ color: 'var(--ep-danger)' }}>
          <i className="fa-solid fa-triangle-exclamation mr-2" />
          {error}
          <button className="ep-btn-accent ml-3 py-1.5 px-3 text-xs" onClick={() => void fetchUsers()}>
            Повторить
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => {
            const isSelf = u.id === currentUser?.id;
            const disabled = u.status !== 'ACTIVE';
            const isMainAdminTarget = u.roles.includes('MAIN_ADMIN');
            const targetTeaches = u.roles.includes('TEACHER');
            const isJuniorAdmin = !!currentUser?.roles?.includes('ADMIN') && !isMainAdmin;
            // Младший админ управляет только чистыми учителями (как canManage на сервере)
            const canManageThis =
              !isSelf &&
              !isMainAdminTarget &&
              (isMainAdmin || (isJuniorAdmin && u.roles.length === 1 && u.roles[0] === 'TEACHER'));
            return (
              <div key={u.id} className="ep-card p-4" style={{ opacity: disabled ? 0.55 : 1 }}>
                <div className="flex items-start gap-3 flex-wrap">
                  {u.photo ? (
                    <img src={u.photo} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ep-accent-dim-bg ep-accent-color flex-shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-40">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{u.name}</span>
                      {isSelf && <span className="text-xs ep-muted">(вы)</span>}
                      <RoleBadges roles={u.roles} />
                      {disabled && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase"
                          style={{ background: 'rgba(255,92,92,0.12)', color: 'var(--ep-danger)' }}
                        >
                          Архив
                        </span>
                      )}
                      {!disabled && u.mustChangePassword && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase"
                          style={{ background: 'rgba(255,180,0,0.12)', color: '#ffb400' }}
                          title="Пользователь ещё не сменил временный пароль"
                        >
                          Временный пароль
                        </span>
                      )}
                    </div>
                    <div className="text-xs ep-muted mt-0.5">
                      {u.email} · создан {fmtDateTime(u.createdAt)}
                    </div>
                  </div>

                  {/* Действия. «Пароль» и «Архив» — только для чистых учителей,
                      которыми смотрящий вправе управлять: у главного админа,
                      других админов и своей строки этих кнопок нет */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {isSelf && targetTeaches && (
                      <span className="px-3 py-1.5 text-xs ep-muted" title="Свой учительский кабинет переключается в Настройках">
                        <i className="fa-solid fa-circle-user mr-1" />
                        это вы
                      </span>
                    )}
                    {!isSelf && targetTeaches && canManageThis && (
                      <button
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold ep-btn-accent"
                        disabled={busyId === u.id || disabled}
                        onClick={() => handleImpersonate(u)}
                        title="Открыть учительский кабинет аккаунта в режиме управления"
                      >
                        <i className="fa-solid fa-right-to-bracket mr-1" />
                        Войти
                      </button>
                    )}
                    {canManageThis && !u.roles.includes('ADMIN') && (
                      <button
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold ep-card border ep-border"
                        disabled={busyId === u.id}
                        onClick={() => handleResetPassword(u)}
                        title="Выдать временный пароль (один на все кабинеты аккаунта)"
                      >
                        <i className="fa-solid fa-key mr-1" />
                        Пароль
                      </button>
                    )}
                    {roleButton(u)}
                    {canManageThis && !u.roles.includes('ADMIN') &&
                      (disabled ? (
                        <button
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ color: 'var(--ep-accent)' }}
                          disabled={busyId === u.id}
                          onClick={() => handleRestore(u)}
                          title="Восстановить аккаунт"
                        >
                          <i className="fa-solid fa-rotate-left mr-1" />
                          Восстановить
                        </button>
                      ) : (
                        <button
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ color: 'var(--ep-danger)' }}
                          disabled={busyId === u.id}
                          onClick={() => handleArchive(u)}
                          title="Архивировать аккаунт с сохранением данных"
                        >
                          <i className="fa-solid fa-box-archive mr-1" />
                          Архив
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="ep-card p-8 text-center text-sm ep-muted">Ничего не найдено</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════ СТАТИСТИКА ═══════════ */

type StatsPeriod = 'month' | 'quarter' | 'year' | 'all';

const PERIOD_LABELS: Record<StatsPeriod, string> = {
  month: 'Месяц',
  quarter: '3 месяца',
  year: 'Год',
  all: 'Всё время',
};

function StatsTab() {
  const startImpersonation = useAppStore(s => s.startImpersonation);
  const openConfirm = useAppStore(s => s.openConfirm);
  const addToast = useAppStore(s => s.addToast);
  const currentUser = useAppStore(s => s.currentUser);

  const [period, setPeriod] = useState<StatsPeriod>('month');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const applyStats = useCallback((res: { ok: boolean; data: StatsResponse | null; error?: string }) => {
    if (res.ok && res.data) {
      setStats(res.data);
      setError('');
    } else {
      setError(res.error || 'Не удалось загрузить статистику');
    }
    setLoading(false);
  }, []);

  const fetchStats = useCallback(async (p: StatsPeriod) => {
    applyStats(await api<StatsResponse>(`/api/admin/stats?period=${p}`));
  }, [applyStats]);

  useEffect(() => {
    let alive = true;
    api<StatsResponse>(`/api/admin/stats?period=${period}`).then(res => {
      if (alive) applyStats(res);
    });
    return () => { alive = false; };
  }, [applyStats, period]);

  const handleImpersonate = (u: StatsUser) => {
    openConfirm(
      `Войти в аккаунт ${u.name} (${u.email})? Ваши действия будут сохраняться в его данных.`,
      async () => {
        const res = await startImpersonation(u.id);
        if (!res.ok) addToast(res.error || 'Не удалось открыть аккаунт', 'error');
      },
      { confirmLabel: 'Войти', confirmIcon: 'fa-right-to-bracket', danger: false }
    );
  };

  if (loading) {
    return (
      <div className="ep-card p-8 text-center">
        <i className="fa-solid fa-spinner fa-spin ep-muted" />
      </div>
    );
  }
  if (error || !stats) {
    return (
      <div className="ep-card p-6 text-center text-sm" style={{ color: 'var(--ep-danger)' }}>
        <i className="fa-solid fa-triangle-exclamation mr-2" />
        {error}
        <button className="ep-btn-accent ml-3 py-1.5 px-3 text-xs" onClick={() => void fetchStats(period)}>
          Повторить
        </button>
      </div>
    );
  }

  const totals = stats.totals;
  const totalCards = [
    { label: 'Ученики', value: `${totals.studentsActive}/${totals.studentsTotal}`, icon: 'fa-users', hint: 'активных/всего' },
    { label: 'Абонементы', value: String(totals.subscriptionsActive), icon: 'fa-ticket', hint: 'активных' },
    { label: 'Занятия', value: String(totals.lessonsCompletedPeriod), icon: 'fa-graduation-cap', hint: PERIOD_LABELS[period].toLowerCase() },
    { label: 'Доход', value: fmtMoney(totals.incomePeriod), icon: 'fa-arrow-down', hint: '', color: 'var(--ep-accent)' },
    { label: 'Расход', value: fmtMoney(totals.expensePeriod), icon: 'fa-arrow-up', hint: '', color: 'var(--ep-danger)' },
  ];

  return (
    <div className="space-y-4">
      {/* Период + обновить */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex rounded-lg p-1 ep-bg-base gap-1" role="tablist" aria-label="Период статистики">
          {(Object.keys(PERIOD_LABELS) as StatsPeriod[]).map(p => (
            <button
              key={p}
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className="py-1.5 px-3 rounded-md text-xs font-semibold transition-all"
              style={{
                background: period === p ? 'var(--ep-accent)' : 'transparent',
                color: period === p ? '#080b12' : 'var(--ep-muted)',
              }}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <button className="ep-btn-accent py-1.5 px-3 text-xs" onClick={() => void fetchStats(period)}>
          <i className="fa-solid fa-rotate mr-1" />
          Обновить
        </button>
      </div>

      {/* Итого */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {totalCards.map(c => (
          <div key={c.label} className="ep-card p-4">
            <div className="text-xs ep-muted mb-1">
              <i className={`fa-solid ${c.icon} mr-1`} />
              {c.label}
            </div>
            <div className="text-lg font-bold" style={{ color: c.color }}>
              {c.value}
            </div>
            {c.hint && <div className="text-[10px] ep-muted mt-0.5">{c.hint}</div>}
          </div>
        ))}
      </div>

      {/* По пользователям */}
      <div className="space-y-3">
        {stats.users.map(u => (
          <div key={u.id} className="ep-card p-4">
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ep-accent-dim-bg ep-accent-color flex-shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-40">
                <div className="font-semibold text-sm">{u.name}</div>
                <div className="text-xs ep-muted">{u.email}</div>
              </div>
              <RoleBadges roles={u.roles} />
              {u.id === currentUser?.id ? (
                <span className="px-3 py-1.5 text-xs ep-muted" title="Это ваш аккаунт — кабинет переключается в Настройках">
                  <i className="fa-solid fa-circle-user mr-1" />
                  это вы
                </span>
              ) : (
                <button
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold ep-btn-accent"
                  onClick={() => handleImpersonate(u)}
                  title="Открыть учительский кабинет в режиме управления"
                >
                  <i className="fa-solid fa-right-to-bracket mr-1" />
                  Войти
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
              <Metric label="Ученики" value={`${u.studentsActive}/${u.studentsTotal}`} hint="активных" />
              <Metric label="Абонементы" value={String(u.subscriptionsActive)} hint="активных" />
              <Metric label="Баланс" value={fmtMoney(u.balanceTotal)} hint="учеников" />
              <Metric label="Проведено" value={String(u.lessonsCompletedPeriod)} hint={PERIOD_LABELS[period].toLowerCase()} />
              <Metric label="Доход" value={fmtMoney(u.incomePeriod)} hint="" color="var(--ep-accent)" />
              <Metric label="Расход" value={fmtMoney(u.expensePeriod)} hint="" color="var(--ep-danger)" />
            </div>
          </div>
        ))}
        {stats.users.length === 0 && (
          <div className="ep-card p-8 text-center text-sm ep-muted">Нет активных пользователей</div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <div className="rounded-lg p-2 ep-bg-base">
      <div className="text-[10px] ep-muted">{label}</div>
      <div className="text-sm font-bold mt-0.5" style={{ color }}>{value}</div>
      {hint && <div className="text-[9px] ep-muted">{hint}</div>}
    </div>
  );
}

/* ═══════════ ЖУРНАЛ ═══════════ */

function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const applyAudit = useCallback((res: { ok: boolean; data: { entries: AuditEntry[] } | null; error?: string }) => {
    if (res.ok && res.data) {
      setEntries(res.data.entries);
      setError('');
    } else {
      setError(res.error || 'Не удалось загрузить журнал');
    }
    setLoading(false);
  }, []);

  const fetchAudit = useCallback(async () => {
    const [auditRes, usersRes] = await Promise.all([
      api<{ entries: AuditEntry[] }>('/api/admin/audit'),
      api<{ users: AdminUser[] }>('/api/admin/users'),
    ]);
    applyAudit(auditRes);
    if (usersRes.ok && usersRes.data?.users) setUsers(usersRes.data.users);
  }, [applyAudit]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api<{ entries: AuditEntry[] }>('/api/admin/audit'),
      api<{ users: AdminUser[] }>('/api/admin/users'),
    ]).then(([auditRes, usersRes]) => {
      if (!alive) return;
      applyAudit(auditRes);
      if (usersRes.ok && usersRes.data?.users) setUsers(usersRes.data.users);
    });
    return () => { alive = false; };
  }, []);

  // email → подпись с ролями аккаунта (у одной почты — один аккаунт)
  const roleSignature = (email: string | null): string => {
    if (!email) return '';
    const u = users.find(x => x.email === email);
    return u ? u.roles.map(r => ROLE_LABELS[r as keyof typeof ROLE_LABELS] || r).join(' + ') : '';
  };

  if (loading) {
    return (
      <div className="ep-card p-8 text-center">
        <i className="fa-solid fa-spinner fa-spin ep-muted" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="ep-card p-6 text-center text-sm" style={{ color: 'var(--ep-danger)' }}>
        <i className="fa-solid fa-triangle-exclamation mr-2" />
        {error}
        <button className="ep-btn-accent ml-3 py-1.5 px-3 text-xs" onClick={() => void fetchAudit()}>
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="text-sm font-semibold ep-muted">
          <i className="fa-solid fa-clipboard-list mr-2" />
          Последние действия в системе (новые сверху)
        </div>
        <button className="ep-btn-accent py-1.5 px-3 text-xs" onClick={() => void fetchAudit()}>
          <i className="fa-solid fa-rotate mr-1" />
          Обновить
        </button>
      </div>

      {entries.map(e => {
        let metaText = '';
        if (e.meta) {
          try {
            const m = JSON.parse(e.meta) as Record<string, unknown>;
            const roleLabel = (v: unknown) =>
              ROLE_LABELS[String(v) as keyof typeof ROLE_LABELS] ?? String(v);
            if (m.from !== undefined && m.to !== undefined) {
              // Исторические записи о замене роли (до перехода на набор ролей)
              metaText = `${roleLabel(m.from)} → ${roleLabel(m.to)}`;
            } else if (Array.isArray(m.roles)) {
              metaText = `роли: ${(m.roles as unknown[]).map(roleLabel).join(' + ')}`;
            } else if (m.role) {
              metaText = `роль: ${roleLabel(m.role)}`;
            } else if (m.fields) {
              metaText = `поля: ${String(m.fields)}`;
            }
          } catch {
            /* ignore */
          }
        }
        const targetSig = roleSignature(e.targetEmail);
        const actorSig = roleSignature(e.actorEmail);
        return (
          <div key={e.id} className="ep-card px-4 py-3 flex items-center gap-3 flex-wrap">
            <div className="text-xs ep-muted flex-shrink-0" style={{ minWidth: 96 }}>
              {fmtDateTime(e.createdAt)}
            </div>
            <div className="flex-1 min-w-48 text-sm">
              <span className="font-semibold">{ACTION_LABELS[e.action] || e.action}</span>
              {e.targetEmail && (
                <span className="ep-muted">
                  {' '}· {e.targetEmail}
                  {targetSig && <span className="text-[10px]"> ({targetSig})</span>}
                </span>
              )}
              {metaText && <span className="ep-muted text-xs"> ({metaText})</span>}
            </div>
            <div className="text-xs ep-muted flex-shrink-0">
              {e.actorEmail || 'система'}
              {actorSig && <span className="text-[10px]"> · {actorSig}</span>}
            </div>
          </div>
        );
      })}
      {entries.length === 0 && (
        <div className="ep-card p-8 text-center text-sm ep-muted">Журнал пуст</div>
      )}
    </div>
  );
}

/* ═══════════ НАСТРОЙКИ КАБИНЕТА ═══════════ */

function CabinetSettingsTab() {
  const currentUser = useAppStore(s => s.currentUser);
  const setActiveCabinet = useAppStore(s => s.setActiveCabinet);
  const updateCurrentUser = useAppStore(s => s.updateCurrentUser);
  const changePassword = useAppStore(s => s.changePassword);
  const addToast = useAppStore(s => s.addToast);

  // Профиль (режим просмотра/редактирования — как в учительских настройках)
  const [editingProfile, setEditingProfile] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Фото профиля
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localPhoto, setLocalPhoto] = useState<string | undefined>(undefined);
  const [editingSrc, setEditingSrc] = useState<string | null>(null);
  const photoUrl = currentUser?.photo || localPhoto;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Почта (этап 1): статус шлюза + тестовое письмо
  const [mailStatus, setMailStatus] = useState<{ configured: boolean; host: string; from: string | null } | null>(null);
  const [mailSending, setMailSending] = useState(false);
  const [mailResult, setMailResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/admin/mail-test')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (alive && d) setMailStatus(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditingSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePhotoConfirm = async (croppedBase64: string) => {
    setLocalPhoto(croppedBase64);
    setEditingSrc(null);
    const res = await updateCurrentUser({ photo: croppedBase64 });
    if (!res.ok) addToast(res.error || 'Не удалось сохранить фото', 'error');
  };

  const handlePhotoCancel = () => {
    setEditingSrc(null);
  };

  const handleRemovePhoto = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalPhoto(undefined);
    const res = await updateCurrentUser({ photo: '' });
    if (!res.ok) addToast(res.error || 'Не удалось удалить фото', 'error');
  };

  const handleProfileEdit = () => {
    setName(currentUser?.name || '');
    setEmail(currentUser?.email || '');
    setProfileError('');
    setEditingProfile(true);
  };

  const handleProfileCancel = () => {
    setEditingProfile(false);
    setProfileError('');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingProfile) return;
    setProfileError('');
    if (!name.trim()) return setProfileError('Имя не может быть пустым');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setProfileError('Введите корректный email');
    setSavingProfile(true);
    const res = await updateCurrentUser({ name: name.trim(), email: email.trim() });
    setSavingProfile(false);
    if (res.ok) {
      setEditingProfile(false);
      addToast('Профиль обновлён', 'success');
    } else {
      setProfileError(res.error || 'Не удалось сохранить профиль');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPassword) return;
    setPasswordError('');
    if (newPassword.length < 4) return setPasswordError('Новый пароль — не менее 4 символов');
    if (newPassword !== repeatPassword) return setPasswordError('Пароли не совпадают');
    setSavingPassword(true);
    const res = await changePassword(currentPassword, newPassword);
    setSavingPassword(false);
    if (res.ok) {
      addToast('Пароль изменён', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
    } else {
      setPasswordError(res.error || 'Не удалось изменить пароль');
    }
  };

  const handleSendTestMail = async () => {
    if (mailSending) return;
    setMailResult(null);
    setMailSending(true);
    try {
      const r = await fetch('/api/admin/mail-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.ok) {
        setMailResult({ ok: true, text: `Тестовое письмо отправлено на ${currentUser?.email}. Если его нет во «Входящих» — проверьте «Спам».` });
      } else {
        setMailResult({ ok: false, text: d?.error || 'Не удалось отправить тестовое письмо' });
      }
    } catch {
      setMailResult({ ok: false, text: 'Нет связи с сервером' });
    } finally {
      setMailSending(false);
    }
  };

  // Редактор фото — отдельный экран (как в учительских настройках)
  if (editingSrc) {
    return (
      <div className="max-w-xl space-y-4">
        <div className="ep-card p-5">
          <h4 className="font-bold text-sm mb-4">Настроить фото профиля</h4>
          <EpPhotoEditor
            imageSrc={editingSrc}
            onConfirm={handlePhotoConfirm}
            onCancel={handlePhotoCancel}
            size={256}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      {/* Профиль — оформлен как в учительских настройках; роль здесь «Админ»,
          а переключение кабинетов (у гибрида) — строкой «Кабинет» внутри панели */}
      <div className="ep-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">
            <i className="fa-solid fa-id-badge mr-2 ep-accent-color" />
            Профиль
          </div>
          {!editingProfile && (
            <button
              onClick={handleProfileEdit}
              className="ep-btn-ghost text-xs py-1.5 px-3"
              title="Редактировать имя и email"
            >
              <i className="fa-solid fa-pen mr-1.5" />Изменить
            </button>
          )}
        </div>
        {profileError && (
          <div
            className="p-3 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(255,92,92,0.1)', border: '1px solid rgba(255,92,92,0.2)', color: 'var(--ep-danger)' }}
            role="alert"
          >
            <i className="fa-solid fa-circle-exclamation mr-1" />
            {profileError}
          </div>
        )}
        <div className="flex items-center gap-4 mb-6">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={handleAvatarClick}
              className="group relative w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold overflow-hidden ep-accent-dim-bg ep-accent-color cursor-pointer focus:outline-none"
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={currentUser?.name || 'Аватар'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{currentUser?.name?.charAt(0)?.toUpperCase()}</span>
              )}

              {/* Camera icon overlay on hover */}
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <i className="fa-solid fa-camera text-white text-base" />
              </div>
            </button>

            {/* Remove photo link */}
            {photoUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs ep-muted hover:text-red-500 transition-colors whitespace-nowrap"
              >
                Удалить фото
              </button>
            )}
          </div>

          {/* Name + Email display/edit */}
          <div className="pt-1 flex-1 min-w-0">
            {editingProfile ? (
              <form onSubmit={handleSaveProfile} className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold mb-1 ep-muted">Имя</label>
                  <input
                    type="text"
                    className="ep-input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ваше имя"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 ep-muted">Email</label>
                  <input
                    type="email"
                    className="ep-input"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="ep-btn-accent text-xs py-1.5 px-3" disabled={savingProfile}>
                    {savingProfile ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin mr-1" />Сохранение…
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-check mr-1" />Сохранить
                      </>
                    )}
                  </button>
                  <button type="button" onClick={handleProfileCancel} className="ep-btn-ghost text-xs py-1.5 px-3">
                    Отмена
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="font-semibold">{currentUser?.name}</div>
                <div className="text-sm ep-muted truncate">{currentUser?.email}</div>
              </>
            )}
          </div>
        </div>

        {!editingProfile && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg ep-bg-base">
              <div>
                <div className="text-sm font-semibold">Email</div>
                <div className="text-xs ep-muted">{currentUser?.email}</div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg ep-bg-base">
              <div>
                <div className="text-sm font-semibold">Роль</div>
                <div className="text-xs ep-muted">Админ</div>
              </div>
            </div>
            {/* Переключение кабинетов (только у гибрида) — внутри панели «Профиль» */}
            {isHybridRoles(currentUser?.roles) && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg ep-bg-base flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Кабинет</div>
                  <div className="text-xs ep-muted">Сейчас открыт кабинет администратора. Один логин и пароль — два кабинета, переключение без повторного входа.</div>
                </div>
                <button
                  className="ep-btn-accent py-2 px-3 text-xs flex-shrink-0"
                  onClick={() => setActiveCabinet('teacher')}
                >
                  <i className="fa-solid fa-language mr-1.5" />
                  В учительский кабинет
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Почта (этап 1): статус шлюза и тестовое письмо */}
      <div className="ep-card p-5 space-y-4">
        <div className="text-sm font-semibold">
          <i className="fa-solid fa-envelope mr-2 ep-accent-color" />
          Почта
        </div>
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg ep-bg-base flex-wrap">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Отправка писем</div>
            <div className="text-xs ep-muted">
              {mailStatus === null
                ? 'Получаем статус…'
                : mailStatus.configured
                  ? `Настроена — письма уходят через ${mailStatus.host}, от ${mailStatus.from || mailStatus.host}`
                  : 'Не настроена — задайте SMTP_USER и SMTP_PASS в .env (пароль приложения Яндекса), затем перезапустите приложение'}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg ep-bg-base flex-wrap">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Тестовое письмо</div>
            <div className="text-xs ep-muted">Придёт на вашу почту ({currentUser?.email})</div>
          </div>
          <button
            className="ep-btn-accent py-2 px-3 text-xs flex-shrink-0"
            onClick={handleSendTestMail}
            disabled={!mailStatus?.configured || mailSending}
          >
            {mailSending ? (
              <>
                <i className="fa-solid fa-spinner fa-spin mr-1.5" />Отправка…
              </>
            ) : (
              <>
                <i className="fa-solid fa-paper-plane mr-1.5" />Отправить
              </>
            )}
          </button>
        </div>
        {mailResult && (
          <div
            className="p-3 rounded-lg text-xs font-semibold"
            style={
              mailResult.ok
                ? { background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.25)', color: '#2e9e52' }
                : { background: 'rgba(255,92,92,0.1)', border: '1px solid rgba(255,92,92,0.2)', color: 'var(--ep-danger)' }
            }
            role="status"
          >
            <i className={`fa-solid ${mailResult.ok ? 'fa-circle-check' : 'fa-circle-exclamation'} mr-1`} />
            {mailResult.text}
          </div>
        )}
      </div>

      {/* Смена пароля */}
      <form onSubmit={handleChangePassword} className="ep-card p-5 space-y-4">
        <div className="text-sm font-semibold">
          <i className="fa-solid fa-key mr-2 ep-accent-color" />
          Смена пароля
        </div>
        {passwordError && (
          <div
            className="p-3 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(255,92,92,0.1)', border: '1px solid rgba(255,92,92,0.2)', color: 'var(--ep-danger)' }}
            role="alert"
          >
            <i className="fa-solid fa-circle-exclamation mr-1" />
            {passwordError}
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold mb-2 ep-muted">Текущий пароль</label>
          <input className="ep-input" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-2 ep-muted">Новый пароль</label>
          <input className="ep-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={4} autoComplete="new-password" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-2 ep-muted">Повторите новый пароль</label>
          <input className="ep-input" type="password" value={repeatPassword} onChange={e => setRepeatPassword(e.target.value)} required minLength={4} autoComplete="new-password" />
        </div>
        <button type="submit" className="ep-btn-accent py-2.5 px-5 text-sm" disabled={savingPassword}>
          {savingPassword ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Сохранение…</> : 'Изменить пароль'}
        </button>
      </form>
    </div>
  );
}
