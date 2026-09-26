'use client';

import { useAppStore, PageType } from '@/lib/ep-store';
import { EpSidebar } from './ep-sidebar';
import { EpDashboard } from './ep-dashboard';
import { EpCalendar } from './ep-calendar';
import { EpSchedule } from './ep-schedule';
import { EpStudents } from './ep-students';
import { EpClasses } from './ep-classes';
import { EpFinance } from './ep-finance';
import { EpSettings } from './ep-settings';
import { EpLessonModal } from './ep-lesson-modal';
import { EpFinanceModal } from './ep-finance-modal';
import { EpStudentModal } from './ep-student-modal';
import { EpClassModal } from './ep-class-modal';
import { EpLessonDetailModal } from './ep-lesson-detail-modal';
import { EpBalanceModal } from './ep-balance-modal';
import { EpSubscriptionModal } from './ep-subscription-modal';
import { EpBalanceChargeModal } from './ep-balance-charge-modal';
import { EpConfirmDialog } from './ep-confirm-dialog';
import { EpCancellationModal } from './ep-cancellation-modal';
import { EpStudentStatsModal } from './ep-student-stats-modal';
import { EpAttendanceModal } from './ep-attendance-modal';
import { EpClassStatsModal } from './ep-class-stats-modal';
import { EpAdminCreateUserModal } from './ep-admin-create-user-modal';
import { EpStudentNotifyModal } from './ep-student-notify-modal';
import { useState, useEffect, useRef } from 'react';

const PAGE_TITLES: Record<PageType, string> = {
  dashboard: 'Дашборд',
  calendar: 'Календарь',
  schedule: 'Расписание',
  students: 'Ученики',
  classes: 'Классы и Группы',
  finance: 'Финансы',
  settings: 'Настройки',
};

// Human-readable label for each modal type, exposed via aria-label on the dialog overlay
const MODAL_ARIA_LABELS: Record<string, string> = {
  lesson: 'Урок',
  'lesson-detail': 'Детали урока',
  finance: 'Финансовая операция',
  student: 'Ученик',
  class: 'Класс',
  balance: 'Баланс',
  subscription: 'Абонементы ученика',
  'balance-charge': 'Списать с баланса',
  cancellation: 'Отмена урока',
  'student-stats': 'Статистика ученика',
  attendance: 'Посещаемость',
  'class-stats': 'Статистика класса',
  'admin-create-user': 'Новый пользователь',
  'student-notify': 'Настройки ученика',
};

// Selector for all keyboard-focusable elements inside a modal card
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function EpLayout() {
  const currentPage = useAppStore(s => s.currentPage);
  const activeModal = useAppStore(s => s.activeModal);
  const confirmDialog = useAppStore(s => s.confirmDialog);
  const currentUser = useAppStore(s => s.currentUser);
  const viewing = useAppStore(s => s.viewing);
  const stopImpersonation = useAppStore(s => s.stopImpersonation);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const modalCardRef = useRef<HTMLDivElement>(null);

  // Escape-to-close: only fires while a modal is open and no confirm dialog is layered on top
  // (the confirm dialog has its own Escape handler and z-index precedence)
  useEffect(() => {
    if (!activeModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (useAppStore.getState().confirmDialog) return; // defer to confirm dialog
      e.stopPropagation();
      useAppStore.getState().closeModal();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeModal]);

  // Focus trap: move focus into the modal on open and keep Tab cycling within it.
  // Disabled while a confirm dialog is layered on top so the user can interact with it.
  useEffect(() => {
    if (!activeModal || confirmDialog) return;
    const card = modalCardRef.current;
    if (!card) return;

    const getFocusables = (): HTMLElement[] =>
      Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        el => el.offsetParent !== null || el === document.activeElement,
      );

    // Move focus into the modal once its content has rendered
    const raf = requestAnimationFrame(() => {
      const items = getFocusables();
      if (items.length > 0) {
        items[0].focus();
      } else {
        // No focusable element — make the card itself focusable so keyboard events are scoped
        card.setAttribute('tabindex', '-1');
        card.focus();
      }
    });

    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = getFocusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !card.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !card.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    card.addEventListener('keydown', handleKey);
    return () => {
      cancelAnimationFrame(raf);
      card.removeEventListener('keydown', handleKey);
    };
  }, [activeModal, confirmDialog]);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <EpDashboard />;
      case 'calendar': return <EpCalendar />;
      case 'schedule': return <EpSchedule />;
      case 'students': return <EpStudents />;
      case 'classes': return <EpClasses />;
      case 'finance': return <EpFinance />;
      case 'settings': return <EpSettings />;
      default: return <EpDashboard />;
    }
  };

  const renderModal = () => {
    switch (activeModal) {
      case 'lesson': return <EpLessonModal />;
      case 'lesson-detail': return <EpLessonDetailModal />;
      case 'finance': return <EpFinanceModal />;
      case 'student': return <EpStudentModal />;
      case 'class': return <EpClassModal />;
      case 'balance': return <EpBalanceModal />;
      case 'subscription': return <EpSubscriptionModal />;
      case 'balance-charge': return <EpBalanceChargeModal />;
      case 'cancellation': return <EpCancellationModal />;
      case 'student-stats': return <EpStudentStatsModal />;
      case 'attendance': return <EpAttendanceModal />;
      case 'class-stats': return <EpClassStatsModal />;
      case 'admin-create-user': return <EpAdminCreateUserModal />;
      case 'student-notify': return <EpStudentNotifyModal />;
      default: return null;
    }
  };

  const avatarLetter = currentUser?.name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-35 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <EpSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 ml-0 md:ml-60 min-h-screen relative z-1">
        {/* Баннер режима управления чужим аккаунтом */}
        {viewing && (
          <div
            className="sticky top-0 z-30 px-4 md:px-6 py-2 flex items-center justify-between gap-3"
            style={{
              background: 'rgba(255,180,0,0.14)',
              borderBottom: '1px solid rgba(255,180,0,0.3)',
              backdropFilter: 'blur(8px)',
            }}
            role="status"
          >
            <div className="text-xs font-semibold truncate" style={{ color: '#ffb400' }}>
              <i className="fa-solid fa-user-shield mr-2" />
              Режим управления: аккаунт {viewing.name} ({viewing.email}) — изменения сохраняются в его данные
            </div>
            <button
              onClick={() => void stopImpersonation()}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: '#ffb400', color: '#080b12' }}
            >
              <i className="fa-solid fa-arrow-left mr-1" />
              Вернуться
            </button>
          </div>
        )}

        {/* Header */}
        <header className={`sticky ${viewing ? 'top-10' : 'top-0'} z-20 px-6 py-4 flex items-center justify-between ep-header`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center ep-card border ep-border"
            >
              <i className="fa-solid fa-bars text-sm" />
            </button>
            <h2 className="text-lg font-bold">{PAGE_TITLES[currentPage]}</h2>
          </div>
          <HeaderActions />
        </header>

        {/* Page content */}
        <div className="p-6">
          {renderPage()}
        </div>
      </div>

      {/* Confirm dialog */}
      <EpConfirmDialog />

      {/* Modals */}
      {activeModal && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center p-5 ep-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={MODAL_ARIA_LABELS[activeModal] || 'Модальное окно'}
          onClick={e => {
            if (e.target === e.currentTarget) useAppStore.getState().closeModal();
          }}
        >
          <div
            ref={modalCardRef}
            className="ep-modal-card"
            onClick={e => e.stopPropagation()}
          >
            {renderModal()}
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderActions() {
  const currentPage = useAppStore(s => s.currentPage);
  const openModal = useAppStore(s => s.openModal);

  const getAction = (): { label: string; icon: string; onClick: () => void } | null => {
    switch (currentPage) {
      case 'calendar': return { label: 'Урок', icon: 'fa-plus', onClick: () => openModal('lesson') };
      case 'schedule': return { label: 'Добавить урок', icon: 'fa-plus', onClick: () => openModal('lesson') };
      case 'finance': return { label: 'Операция', icon: 'fa-plus', onClick: () => openModal('finance') };
      case 'students': return { label: 'Ученик', icon: 'fa-plus', onClick: () => openModal('student') };
      case 'classes': return { label: 'Класс', icon: 'fa-plus', onClick: () => openModal('class') };
      default: return null;
    }
  };

  const action = getAction();
  if (!action) return null;

  return (
    <button className="ep-btn-accent" onClick={action.onClick}>
      <i className={`fa-solid ${action.icon} mr-2`} />
      {action.label}
    </button>
  );
}
