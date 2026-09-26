'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { isAdminRoles, hasTeacherRole } from '@/lib/ep-types';
import { initSync } from '@/lib/ep-sync';
import { EpToast } from './ep-toast';
import { EpAuth } from './ep-auth';
import { EpLayout } from './ep-layout';
import { EpAdminCabinet } from './ep-cabinet';
import { EpCabinetChoice } from './ep-cabinet-choice';
import { EpForcePasswordChange } from './ep-force-password-change';
import { EpResetPassword } from './ep-reset-password';

const emptySubscribe = () => () => {};

/** Токен восстановления пароля из письма: ссылка вида /?reset=<токен> */
function readResetToken(): string | null {
  if (typeof window === 'undefined') return null;
  const t = new URLSearchParams(window.location.search).get('reset');
  return t && t.trim() ? t.trim() : null;
}

export function EpApp() {
  const currentUser = useAppStore(s => s.currentUser);
  const viewing = useAppStore(s => s.viewing);
  const activeCabinet = useAppStore(s => s.activeCabinet);
  const authChecked = useAppStore(s => s.authChecked);
  const theme = useAppStore(s => s.theme);
  // Wait for client hydration to avoid hydration mismatch with zustand persist
  // (no setState-in-effect: useSyncExternalStore flips to true after hydration)
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Восстановление пароля: ссылка из письма открывает форму нового пароля
  // вместо экрана входа (только пока пользователь не вошёл в аккаунт)
  const [resetToken, setResetToken] = useState<string | null>(readResetToken);

  const closeReset = () => {
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    setResetToken(null);
  };

  useEffect(() => {
    // Проверка сессии на сервере + загрузка данных + запуск автосинхронизации
    void useAppStore.getState().initAuth();
    initSync();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  if (!mounted || !authChecked) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#080b12',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <i
            className="fa-solid fa-language"
            style={{ fontSize: 40, color: '#00e5a0', opacity: 0.8 }}
          />
          <div style={{ marginTop: 14, color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
            Загрузка…
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    // Ссылка из письма «Забыли пароль?» — сначала форма нового пароля
    if (resetToken) {
      return (
        <div className={theme === 'dark' ? 'ep-dark' : 'ep-light'}>
          <EpResetPassword token={resetToken} onDone={closeReset} />
        </div>
      );
    }
    return <EpAuth />;
  }

  // Администратор выдал временный пароль — сначала обязательная смена
  if (currentUser.mustChangePassword) {
    return (
      <div className={theme === 'dark' ? 'ep-dark' : 'ep-light'}>
        <EpToast />
        <EpForcePasswordChange />
      </div>
    );
  }

  const themeWrap = (children: React.ReactNode) => (
    <div className={theme === 'dark' ? 'ep-dark' : 'ep-light'}>{children}</div>
  );

  // Режим управления чужим аккаунтом — всегда учительский стол с баннером
  if (viewing) {
    return themeWrap(<EpLayout />);
  }

  const hasAdmin = isAdminRoles(currentUser.roles);
  const hasTeacher = hasTeacherRole(currentUser.roles);

  // Оба кабинета (гибрид «учитель + админ»): открыт тот, что выбран после входа;
  // переключение — мгновенно, без повторной авторизации
  if (hasAdmin && hasTeacher) {
    if (!activeCabinet) {
      return themeWrap(<EpCabinetChoice />);
    }
    return themeWrap(activeCabinet === 'admin' ? <EpAdminCabinet /> : <EpLayout />);
  }

  // Один кабинет: чистый админ (в т.ч. владелец) или чистый учитель
  return themeWrap(hasAdmin ? <EpAdminCabinet /> : <EpLayout />);
}
