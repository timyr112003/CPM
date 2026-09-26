'use client';

import { useAppStore } from '@/lib/ep-store';

/**
 * Экран выбора кабинета после входа — только для аккаунтов с двумя ролями
 * (учитель + админ). Один пароль, один аккаунт: решаем лишь, какой интерфейс
 * открыть. Выбор можно менять в любой момент в Настройках (карточка «Кабинет»).
 */
export function EpCabinetChoice() {
  const currentUser = useAppStore(s => s.currentUser);
  const setActiveCabinet = useAppStore(s => s.setActiveCabinet);
  const addToast = useAppStore(s => s.addToast);

  const choose = (cabinet: 'teacher' | 'admin') => {
    setActiveCabinet(cabinet);
    addToast(
      cabinet === 'admin' ? 'Открыт кабинет администратора' : 'Открыт учительский кабинет',
      'success'
    );
  };

  return (
    <div className="auth-bg">
      <div className="ep-card p-8 w-full max-w-lg mx-4 ep-scale-in relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4 ep-accent-dim-bg">
            <i className="fa-solid fa-language text-2xl ep-accent-color" />
          </div>
          <h1 className="text-2xl font-bold mb-1">С возвращением{currentUser?.name ? `, ${currentUser.name}` : ''}!</h1>
          <p className="text-sm ep-muted">У этого аккаунта два кабинета. Какой открыть?</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {/* Учительский кабинет */}
          <button
            type="button"
            className="ep-card border ep-border rounded-xl p-5 text-left transition-all hover:opacity-80 focus:outline-none focus:ring-2"
            onClick={() => choose('teacher')}
            aria-label="Открыть учительский кабинет"
          >
            <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-3 ep-accent-dim-bg">
              <i className="fa-solid fa-language ep-accent-color text-lg" />
            </div>
            <div className="font-bold text-sm mb-1">Преподаватель</div>
            <div className="text-xs ep-muted leading-relaxed">
              Ученики, занятия, расписание, абонементы и финансы
            </div>
          </button>

          {/* Кабинет администратора */}
          <button
            type="button"
            className="ep-card border ep-border rounded-xl p-5 text-left transition-all hover:opacity-80 focus:outline-none focus:ring-2"
            onClick={() => choose('admin')}
            aria-label="Открыть кабинет администратора"
          >
            <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-3 ep-accent-dim-bg">
              <i className="fa-solid fa-user-shield text-lg" style={{ color: '#ffb400' }} />
            </div>
            <div className="font-bold text-sm mb-1">Администратор</div>
            <div className="text-xs ep-muted leading-relaxed">
              Пользователи, статистика школы, журнал действий
            </div>
          </button>
        </div>

        <p className="text-xs ep-muted text-center mt-2 mb-0">
          <i className="fa-solid fa-repeat mr-1" />
          Переключить кабинет можно в любой момент — в Настройках
        </p>
      </div>
    </div>
  );
}
