'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { fmtMoney, fmtDateRu, parseDate, sortFinanceNewestFirst } from '@/lib/ep-utils';

type StatType = 'planned' | 'completed' | 'cancelled' | 'transactions';

const STAT_TITLES: Record<StatType, string> = {
  planned: 'Запланированные занятия',
  completed: 'Проведённые занятия',
  cancelled: 'История отмен',
  transactions: 'История операций',
};

const STAT_ICONS: Record<StatType, string> = {
  planned: 'fa-calendar-check',
  completed: 'fa-circle-check',
  cancelled: 'fa-circle-xmark',
  transactions: 'fa-receipt',
};

const STAT_COLORS: Record<StatType, string> = {
  planned: 'var(--ep-accent)',
  completed: '#4ade80',
  cancelled: 'var(--ep-danger)',
  transactions: 'var(--ep-accent)',
};

export function EpStudentStatsModal() {
  const editingId = useAppStore(s => s.editingId);
  const modalContext = useAppStore(s => s.modalContext);
  const schedule = useAppStore(s => s.schedule);
  const students = useAppStore(s => s.students);
  const finance = useAppStore(s => s.finance);
  const closeModal = useAppStore(s => s.closeModal);

  const statType = (modalContext?.statType || 'planned') as StatType;
  const student = students.find(s => s.id === editingId);

  const lessons = useMemo(() => {
    if (!student) return [];
    return schedule
      .filter(l => {
        if (!l.studentIds.includes(student.id)) return false;
        if (statType !== 'cancelled') {
          return l.status === statType;
        }
        // For cancelled: include both cancelled lessons AND group lesson absences
        if (l.status === 'cancelled') return true;
        if (l.status === 'completed' && l.isGroup && l.attendance) {
          const entry = l.attendance.find(a => a.studentId === student.id);
          if (entry && !entry.present) return true;
        }
        return false;
      })
      .sort((a, b) => a.date === b.date ? a.time.localeCompare(b.time) : b.date.localeCompare(a.date));
  }, [student, schedule, statType]);

  const transactions = useMemo(() => {
    if (!student) return [];
    return sortFinanceNewestFirst(finance
      .filter(f => {
        // Balance operations for this student
        if (f.balanceChange && f.description.includes(student.name)) return true;
        // Lesson-linked income for this student
        if (f.lessonId) {
          const lesson = schedule.find(l => l.id === f.lessonId);
          if (lesson && lesson.studentIds.includes(student.id)) return true;
        }
        // Penalty entries by student name
        if (f.category === 'Штраф за отмену' && f.description.includes(student.name)) return true;
        return false;
      }));
  }, [student, finance, schedule]);

  if (!student) return null;

  const list = statType === 'transactions' ? transactions : lessons;
  const title = STAT_TITLES[statType];
  const icon = STAT_ICONS[statType];
  const color = STAT_COLORS[statType];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}15`, color }}
          >
            <i className={`fa-solid ${icon} text-lg`} />
          </div>
          <div>
            <h3 className="text-base font-bold">{title}</h3>
            <p className="text-xs ep-muted">{student.name} &middot; {list.length} {list.length === 1 ? 'запись' : list.length < 5 ? 'записи' : 'записей'}</p>
          </div>
        </div>
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div className="text-center py-8">
          <i className={`fa-solid ${icon} text-3xl mb-3 ep-muted`} />
          <p className="text-sm ep-muted">Нет данных</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
          {statType === 'transactions' && transactions.map(f => {
            const isIncome = f.type === 'income';
            return (
              <div
                key={f.id}
                className="flex items-center justify-between p-3 rounded-lg transition-all"
                style={{ background: 'var(--ep-bg-secondary)' }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: isIncome ? 'rgba(0,229,160,0.1)' : 'rgba(255,92,92,0.1)' }}
                  >
                    <i
                      className={`fa-solid ${isIncome ? 'fa-arrow-down' : 'fa-arrow-up'} text-xs`}
                      style={{ color: isIncome ? 'var(--ep-accent)' : 'var(--ep-danger)' }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{f.category}</div>
                    <div className="text-xs ep-muted truncate">{f.description}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <div
                    className="text-sm font-bold"
                    style={{ color: isIncome ? 'var(--ep-accent)' : 'var(--ep-danger)' }}
                  >
                    {isIncome ? '+' : '-'}{fmtMoney(f.amount)}
                  </div>
                  <div className="text-xs ep-muted">{fmtDateRu(parseDate(f.date))}</div>
                </div>
              </div>
            );
          })}

          {statType === 'planned' && lessons.map(l => (
            <div
              key={l.id}
              className="flex items-center justify-between p-3 rounded-lg transition-all"
              style={{ background: 'var(--ep-bg-secondary)' }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(0,229,160,0.1)' }}
                >
                  <i className={`fa-solid ${l.isGroup ? 'fa-users' : 'fa-user'} text-xs`} style={{ color: 'var(--ep-accent)' }} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{l.topic}</div>
                  <div className="text-xs ep-muted">
                    {fmtDateRu(parseDate(l.date))} &middot; {l.time} &middot; {l.duration} мин
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: l.isGroup ? '#a78bfa' : 'var(--ep-muted)' }}>
                    <i className={`fa-solid ${l.isGroup ? 'fa-users' : 'fa-user'} mr-1`} style={{ fontSize: 9 }} />
                    {l.isGroup ? 'Групповое' : 'Индивидуальное'}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <div className="text-sm font-bold ep-accent-color">{fmtMoney(l.price)}</div>
              </div>
            </div>
          ))}

          {statType === 'completed' && lessons.map(l => (
            <div
              key={l.id}
              className="flex items-center justify-between p-3 rounded-lg transition-all"
              style={{ background: 'var(--ep-bg-secondary)' }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(74,222,128,0.1)' }}
                >
                  <i className={`fa-solid ${l.isGroup ? 'fa-users' : 'fa-check'} text-xs`} style={{ color: '#4ade80' }} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{l.topic}</div>
                  <div className="text-xs ep-muted">
                    {fmtDateRu(parseDate(l.date))} &middot; {l.time} &middot; {l.duration} мин
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: l.isGroup ? '#a78bfa' : 'var(--ep-muted)' }}>
                    <i className={`fa-solid ${l.isGroup ? 'fa-users' : 'fa-user'} mr-1`} style={{ fontSize: 9 }} />
                    {l.isGroup ? 'Групповое' : 'Индивидуальное'}
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <div className="text-sm font-bold" style={{ color: '#4ade80' }}>{fmtMoney(l.price)}</div>
              </div>
            </div>
          ))}

          {statType === 'cancelled' && lessons.map(l => {
            const isAbsence = l.status === 'completed' && l.isGroup && l.attendance;
            const byStudent = !isAbsence && l.cancellation?.cancelledBy === 'student';
            const byTutor = !isAbsence && l.cancellation?.cancelledBy === 'tutor';
            return (
              <div
                key={l.id}
                className="flex items-center justify-between p-3 rounded-lg transition-all"
                style={{ background: 'var(--ep-bg-secondary)' }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: isAbsence ? 'rgba(251,146,60,0.1)' : byStudent ? 'rgba(255,92,92,0.1)' : 'rgba(251,191,36,0.1)' }}
                  >
                    <i
                      className={`fa-solid ${isAbsence ? 'fa-user-slash' : byStudent ? 'fa-user-xmark' : 'fa-chalkboard-user'} text-xs`}
                      style={{ color: isAbsence ? '#fb923c' : byStudent ? 'var(--ep-danger)' : 'var(--ep-warning)' }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {isAbsence ? 'Отсутствие на групповом занятии' : (l.cancellation?.reason || 'Причина не указана')}
                    </div>
                    <div className="text-xs ep-muted">
                      {fmtDateRu(parseDate(l.date))} &middot; {l.time}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: isAbsence ? '#fb923c' : byStudent ? 'var(--ep-danger)' : 'var(--ep-warning)' }}>
                      {isAbsence ? 'Пропуск группового занятия' : byStudent ? 'По вине ученика' : byTutor ? 'По вине репетитора' : 'Вина не указана'}
                    </div>
                  </div>
                </div>
                {!isAbsence && l.cancellation?.penaltyAmount && l.cancellation.penaltyAmount > 0 && (
                  <div className="text-right flex-shrink-0 ml-3">
                    <div className="text-sm font-bold" style={{ color: 'var(--ep-danger)' }}>
                      Штраф: {fmtMoney(l.cancellation.penaltyAmount)}
                    </div>
                  </div>
                )}
                {isAbsence && (() => {
                  const attEntry = l.attendance?.find(a => a.studentId === student.id);
                  if (attEntry && attEntry.penaltyAmount > 0) {
                    return (
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-sm font-bold" style={{ color: '#fb923c' }}>
                          Штраф: {fmtMoney(attEntry.penaltyAmount)}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary for completed */}
      {statType === 'completed' && lessons.length > 0 && (
        <div
          className="p-3 rounded-lg flex items-center justify-between"
          style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}
        >
          <span className="text-sm font-semibold" style={{ color: '#4ade80' }}>Всего заработано:</span>
          <span className="text-sm font-bold" style={{ color: '#4ade80' }}>
            {fmtMoney(lessons.reduce((sum, l) => sum + l.price, 0))}
          </span>
        </div>
      )}

      {/* Close button */}
      <div className="flex justify-end pt-1">
        <button type="button" onClick={closeModal} className="ep-btn-ghost">
          Закрыть
        </button>
      </div>
    </div>
  );
}
