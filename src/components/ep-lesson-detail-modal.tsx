'use client';

import { useAppStore } from '@/lib/ep-store';
import { fmtMoney, fmtDateRu, parseDate, fmtDate } from '@/lib/ep-utils';
import { getActiveSubscription, todayStr } from '@/lib/ep-subscriptions';

export function EpLessonDetailModal() {
  const editingId = useAppStore(s => s.editingId);
  const schedule = useAppStore(s => s.schedule);
  const students = useAppStore(s => s.students);
  const subscriptions = useAppStore(s => s.subscriptions);
  const closeModal = useAppStore(s => s.closeModal);
  const openModal = useAppStore(s => s.openModal);
  const changeLessonStatus = useAppStore(s => s.changeLessonStatus);
  const deleteLesson = useAppStore(s => s.deleteLesson);
  const deleteRecurringLessons = useAppStore(s => s.deleteRecurringLessons);
  const addToast = useAppStore(s => s.addToast);
  const openConfirm = useAppStore(s => s.openConfirm);

  const lesson = schedule.find(l => l.id === editingId);
  if (!lesson) return null;

  const isRecurring = !!lesson.recurringGroupId;
  const recurringLessons = isRecurring
    ? schedule.filter(l => l.recurringGroupId === lesson.recurringGroupId)
        .sort((a, b) => a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date))
    : [];
  const recurringPlanned = recurringLessons.filter(l => l.status === 'planned');

  // Get student balances for the lesson
  const lessonStudents = students.filter(s => lesson.studentIds.includes(s.id));

  const statusLabel = lesson.status === 'completed' ? 'Проведён' : lesson.status === 'cancelled' ? 'Отменён' : 'Запланирован';
  const statusClass = lesson.status === 'completed' ? 'badge-completed' : lesson.status === 'cancelled' ? 'badge-cancelled' : 'badge-planned';

  const handleComplete = () => {
    if (lesson.isGroup && lesson.studentIds.length > 1) {
      closeModal();
      setTimeout(() => openModal('attendance', lesson.id), 100);
    } else {
      changeLessonStatus(lesson.id, 'completed');
      closeModal();
    }
  };
  // Ручное списание с баланса: явная альтернатива автооплате — сумма задаётся вручную,
  // абонемент (даже активный) не затрагивается
  const handleManualCharge = () => {
    closeModal();
    setTimeout(() => openModal('balance-charge', lesson.id), 100);
  };
  const handleCancel = () => { closeModal(); setTimeout(() => openModal('cancellation', lesson.id), 100); };
  const handleReset = () => { changeLessonStatus(lesson.id, 'planned'); closeModal(); };
  const handleEdit = () => { closeModal(); setTimeout(() => openModal('lesson', lesson.id), 100); };
  const handleDelete = () => {
    closeModal();
    openConfirm(
      'Удалить этот урок?',
      () => { deleteLesson(lesson.id); addToast('Урок удалён', 'info'); },
      { confirmLabel: 'Удалить', confirmIcon: 'fa-trash', danger: true }
    );
  };
  const handleDeleteSeries = () => {
    closeModal();
    const count = recurringPlanned.length;
    openConfirm(
      `Удалить все ${count} запланированных уроков из этой серии? (Проведённые и отменённые останутся.)`,
      () => {
        deleteRecurringLessons(lesson.recurringGroupId!);
        addToast(`Удалено ${count} уроков серии`, 'info');
      },
      { confirmLabel: 'Удалить серию', confirmIcon: 'fa-layer-group', danger: true }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          {lesson.isGroup && <span className="badge badge-group mr-1">Группа</span>}
          {lesson.student}
        </h3>
        <div className="flex items-center gap-2">
          {isRecurring && (
            <span className="badge" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
              Серия
            </span>
          )}
          <span className={`badge ${statusClass}`}>{statusLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded-lg ep-bg-base">
          <div className="text-xs ep-muted">Дата</div>
          <div className="font-semibold">{fmtDateRu(parseDate(lesson.date))}</div>
        </div>
        <div className="p-3 rounded-lg ep-bg-base">
          <div className="text-xs ep-muted">Время</div>
          <div className="font-semibold">{lesson.time} ({lesson.duration} мин)</div>
        </div>
        <div className="p-3 rounded-lg ep-bg-base">
          <div className="text-xs ep-muted">Тема</div>
          <div className="font-semibold">{lesson.topic}</div>
        </div>
        <div className="p-3 rounded-lg ep-bg-base">
          <div className="text-xs ep-muted">Стоимость</div>
          <div className="font-semibold ep-accent-color">{fmtMoney(lesson.price)}</div>
        </div>
      </div>

      {/* Lesson notes / homework / materials */}
      {(lesson.notes || lesson.homework || lesson.materials) && (
        <div className="space-y-2">
          {lesson.notes && (
            <div className="p-3 rounded-lg" style={{ background: 'var(--ep-bg-secondary)', border: '1px solid var(--ep-border)' }}>
              <div className="text-xs font-semibold mb-1 ep-muted">
                <i className="fa-solid fa-pen-to-square mr-1" />Заметки по уроку
              </div>
              <div className="text-sm whitespace-pre-wrap">{lesson.notes}</div>
            </div>
          )}
          {lesson.homework && (
            <div className="p-3 rounded-lg" style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.15)' }}>
              <div className="text-xs font-semibold mb-1" style={{ color: '#a78bfa' }}>
                <i className="fa-solid fa-book mr-1" />Домашнее задание
              </div>
              <div className="text-sm whitespace-pre-wrap">{lesson.homework}</div>
            </div>
          )}
          {lesson.materials && (
            <div className="p-3 rounded-lg" style={{ background: 'rgba(0,229,160,0.04)', border: '1px solid rgba(0,229,160,0.12)' }}>
              <div className="text-xs font-semibold mb-1 ep-accent-color">
                <i className="fa-solid fa-link mr-1" />Материалы
              </div>
              <div className="text-sm whitespace-pre-wrap">{lesson.materials}</div>
            </div>
          )}
        </div>
      )}

      {/* Cancellation info */}
      {lesson.status === 'cancelled' && lesson.cancellation && (
        <div
          className="p-4 rounded-xl"
          style={{
            background: lesson.cancellation.cancelledBy === 'student'
              ? 'rgba(255,92,92,0.06)'
              : 'rgba(251,191,36,0.06)',
            border: lesson.cancellation.cancelledBy === 'student'
              ? '1px solid rgba(255,92,92,0.15)'
              : '1px solid rgba(251,191,36,0.15)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <i
              className={`fa-solid ${lesson.cancellation.cancelledBy === 'student' ? 'fa-user-xmark' : 'fa-chalkboard-user'}`}
              style={{
                color: lesson.cancellation.cancelledBy === 'student' ? 'var(--ep-danger)' : 'var(--ep-warning)',
                fontSize: 14,
              }}
            />
            <span className="text-sm font-bold" style={{
              color: lesson.cancellation.cancelledBy === 'student' ? 'var(--ep-danger)' : 'var(--ep-warning)',
            }}>
              Отменено {lesson.cancellation.cancelledBy === 'student' ? 'по вине ученика' : 'по вашей вине'}
            </span>
          </div>
          <div className="text-xs ep-muted mb-2">
            <span className="font-semibold">Причина:</span> {lesson.cancellation.reason}
          </div>
          {lesson.cancellation.penaltyAmount > 0 && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--ep-danger)' }}>
              <i className="fa-solid fa-coins" />
              <span className="font-semibold">Штраф: {fmtMoney(lesson.cancellation.penaltyAmount)}</span>
            </div>
          )}
        </div>
      )}

      {/* Attendance info for completed group lessons */}
      {lesson.status === 'completed' && lesson.isGroup && lesson.attendance && lesson.attendance.length > 0 && (
        <div className="p-4 rounded-xl" style={{ background: 'rgba(0,229,160,0.04)', border: '1px solid rgba(0,229,160,0.12)' }}>
          <div className="flex items-center gap-2 mb-3">
            <i className="fa-solid fa-clipboard-check text-sm" style={{ color: 'var(--ep-accent)' }} />
            <span className="text-sm font-bold">Посещаемость</span>
          </div>
          <div className="space-y-1.5">
            {lesson.attendance.map(a => {
              const st = students.find(s => s.id === a.studentId);
              if (!st) return null;
              return (
                <div key={a.studentId} className="flex items-center justify-between text-xs p-2 rounded-lg" style={{ background: 'var(--ep-bg-secondary)' }}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center"
                      style={{ background: a.present ? 'rgba(0,229,160,0.15)' : 'rgba(255,92,92,0.15)' }}
                    >
                      <i className={`fa-solid ${a.present ? 'fa-check' : 'fa-xmark'}`} style={{ color: a.present ? 'var(--ep-accent)' : 'var(--ep-danger)', fontSize: 9 }} />
                    </div>
                    <span className="font-semibold">{st.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.present ? (
                      <span className="ep-muted">-{fmtMoney(lesson.price)}</span>
                    ) : a.penaltyAmount > 0 ? (
                      <span style={{ color: 'var(--ep-danger)' }}>Штраф: -{fmtMoney(a.penaltyAmount)}</span>
                    ) : (
                      <span className="ep-muted">Не присутствовал</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recurring series info */}
      {isRecurring && (
        <div className="p-4 rounded-xl" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.12)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: '#a78bfa' }}>Повторяющаяся серия</span>
            </div>
            <span className="text-xs ep-muted">
              {recurringLessons.length} уроков: {recurringLessons.filter(l => l.status === 'completed').length} проведено,
              {' '}{recurringLessons.filter(l => l.status === 'cancelled').length} отменено,
              {' '}{recurringPlanned.length} запланировано
            </span>
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {recurringLessons.map(l => (
              <div
                key={l.id}
                className="flex items-center gap-2 text-xs py-1 px-2 rounded-md"
                style={{
                  background: l.id === lesson.id ? 'rgba(167,139,250,0.1)' : 'transparent',
                }}
              >
                <span className="font-semibold" style={{ minWidth: 80 }}>
                  {fmtDateRu(parseDate(l.date))}
                </span>
                <span style={{ color: 'var(--ep-text-muted)' }}>{l.time}</span>
                <span className={`badge ${l.status === 'completed' ? 'badge-completed' : l.status === 'cancelled' ? 'badge-cancelled' : 'badge-planned'}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                  {l.status === 'completed' ? 'Проведён' : l.status === 'cancelled' ? 'Отменён' : 'Запланирован'}
                </span>
                {l.id === lesson.id && (
                  <span className="text-xs font-bold" style={{ color: '#a78bfa' }}>&larr; текущий</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student balance warning for planned lessons */}
      {lesson.status === 'planned' && !lesson.isGroup && (() => {
        const today = todayStr();
        // Предупреждаем только о тех, кто будет платить с баланса;
        // у кого активный абонемент — оплата спишется занятиями, баланс не трогается
        const willBeNeg = lessonStudents.filter(s =>
          (s.balance || 0) - lesson.price < 0 &&
          !getActiveSubscription(subscriptions, s.id, today)
        );
        if (willBeNeg.length === 0) return null;
        return (
          <div className="p-3 rounded-lg" style={{ background: 'rgba(255,92,92,0.06)', border: '1px solid rgba(255,92,92,0.15)' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--ep-danger)' }}>
              <i className="fa-solid fa-triangle-exclamation mr-1" />Внимание: после урока баланс станет отрицательным
            </div>
            {willBeNeg.map(s => {
              const bal = s.balance || 0;
              return (
                <div key={s.id} className="flex items-center justify-between text-xs mt-1">
                  <span>{s.name}</span>
                  <span className="font-bold" style={{ color: 'var(--ep-danger)' }}>
                    {fmtMoney(bal)} → {fmtMoney(bal - lesson.price)}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}

      <div className="flex gap-2 justify-between flex-wrap">
        <div className="flex gap-2">
          {lesson.status === 'planned' && (
            <>
              <button onClick={handleComplete} className="ep-btn-accent text-xs py-2 px-4">
                <i className="fa-solid fa-check mr-1" />Проведён
              </button>
              {!lesson.isGroup && (
                <button onClick={handleManualCharge} className="ep-btn-ghost text-xs py-2 px-4" title="Провести урок и списать сумму с баланса вручную (абонемент не используется)">
                  <i className="fa-solid fa-wallet mr-1" />Списать с баланса
                </button>
              )}
              <button onClick={handleCancel} className="ep-btn-danger">
                <i className="fa-solid fa-xmark mr-1" />Отменён
              </button>
            </>
          )}
          {lesson.status === 'completed' && (
            <>
              <button onClick={handleCancel} className="ep-btn-danger">
                <i className="fa-solid fa-xmark mr-1" />Отменён
              </button>
              <button onClick={handleReset} className="ep-btn-ghost text-xs py-2 px-4">
                <i className="fa-solid fa-rotate-left mr-1" />Сбросить
              </button>
            </>
          )}
          {lesson.status === 'cancelled' && (
            <>
              <button onClick={handleComplete} className="ep-btn-accent text-xs py-2 px-4">
                <i className="fa-solid fa-check mr-1" />Проведён
              </button>
              <button onClick={handleReset} className="ep-btn-ghost text-xs py-2 px-4">
                <i className="fa-solid fa-rotate-left mr-1" />Сбросить
              </button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={handleEdit} className="ep-btn-ghost text-xs py-2 px-4">
            <i className="fa-solid fa-pen mr-1" />Редактировать
          </button>
          {isRecurring && recurringPlanned.length > 1 && (
            <button onClick={handleDeleteSeries} className="ep-btn-danger">
              <i className="fa-solid fa-layer-group mr-1" />Удалить серию
            </button>
          )}
          <button onClick={handleDelete} className="ep-btn-danger">
            <i className="fa-solid fa-trash mr-1" />Удалить
          </button>
        </div>
      </div>
    </div>
  );
}
