'use client';

import { useAppStore, PageType } from '@/lib/ep-store';
import { useSyncStore } from '@/lib/ep-sync';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS: { page: PageType; icon: string; label: string; group?: string }[] = [
  { page: 'dashboard', icon: 'fa-solid fa-grip', label: 'Дашборд', group: 'ГЛАВНОЕ' },
  { page: 'calendar', icon: 'fa-regular fa-calendar-days', label: 'Календарь' },
  { page: 'schedule', icon: 'fa-solid fa-list-check', label: 'Расписание' },
  { page: 'students', icon: 'fa-solid fa-users', label: 'Ученики', group: 'УПРАВЛЕНИЕ' },
  { page: 'classes', icon: 'fa-solid fa-layer-group', label: 'Классы и Группы' },
  { page: 'finance', icon: 'fa-solid fa-wallet', label: 'Финансы' },
  { page: 'settings', icon: 'fa-solid fa-gear', label: 'Настройки', group: 'СИСТЕМА' },
];

/** Мини-индикатор синхронизации с сервером */
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const status = useSyncStore(s => s.status);
  const lastSyncAt = useSyncStore(s => s.lastSyncAt);
  const error = useSyncStore(s => s.error);

  const icon =
    status === 'saving'
      ? 'fa-solid fa-spinner fa-spin'
      : status === 'error'
        ? 'fa-solid fa-triangle-exclamation'
        : 'fa-solid fa-cloud';
  const color =
    status === 'error'
      ? 'var(--ep-danger)'
      : status === 'saving'
        ? 'var(--ep-accent)'
        : 'var(--ep-accent)';
  const label =
    status === 'saving'
      ? 'Сохранение…'
      : status === 'error'
        ? error || 'Ошибка синхронизации'
        : lastSyncAt
          ? `Сохранено · ${new Date(lastSyncAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
          : 'Синхронизировано';

  return (
    <div
      className="flex items-center gap-2 text-xs ep-muted"
      style={{ padding: compact ? '0' : '0 8px', marginBottom: compact ? 0 : 8 }}
      title={label}
      aria-live="polite"
    >
      <i className={icon} style={{ color, fontSize: 11 }} />
      <span className="truncate" style={{ fontSize: 11 }}>{label}</span>
    </div>
  );
}

export function EpSidebar({ open, onClose }: SidebarProps) {
  const currentPage = useAppStore(s => s.currentPage);
  const navigate = useAppStore(s => s.navigate);
  const currentUser = useAppStore(s => s.currentUser);
  const theme = useAppStore(s => s.theme);
  const toggleTheme = useAppStore(s => s.toggleTheme);
  const logout = useAppStore(s => s.logout);
  const addToast = useAppStore(s => s.addToast);

  const avatar = currentUser?.name?.charAt(0)?.toUpperCase() || 'U';
  const userPhoto = currentUser?.photo;

  const handleLogout = async () => {
    await logout();
    addToast('Вы вышли из аккаунта', 'info');
  };

  const renderedGroups = new Set<string>();

  return (
    <aside className={`ep-sidebar ${open ? 'open' : ''}`}>
      {/* Logo */}
      <div className="p-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center ep-accent-dim-bg">
            <i className="fa-solid fa-language ep-accent-color" style={{ fontSize: 16 }} />
          </div>
          <div>
            <div className="font-bold text-sm">EnglishPro</div>
            <div className="text-xs ep-muted">Репетиторство</div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <div className="px-2 mt-2 flex-1 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const showGroup = item.group && !renderedGroups.has(item.group);
          if (item.group) renderedGroups.add(item.group);
          return (
            <div key={item.page}>
              {showGroup && (
                <div className="text-xs font-semibold px-4 mb-2 mt-4 ep-muted" style={{ letterSpacing: 0.5 }}>
                  {item.group}
                </div>
              )}
              <div
                className={`ep-sidebar-link ${currentPage === item.page ? 'active' : ''}`}
                onClick={() => { navigate(item.page); onClose(); }}
              >
                <i className={item.icon} style={{ width: 20, textAlign: 'center', fontSize: 15 }} />
                {item.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
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
  );
}
