'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { fmtMoney, fmtDateRu, parseDate } from '@/lib/ep-utils';

type ClassStatType = 'completed' | 'cancelled';

const STAT_TITLES: Record<ClassStatType, string> = {
  completed: 'Проведённые занятия',
  cancelled: 'История отмен',
};

const STAT_ICONS: Record<ClassStatType, string> = {
  completed: 'fa-circle-check',
  cancelled: 'fa-circle-xmark',
};

const STAT_COLORS: Record<ClassStatType, string> = {
  completed: '#4ade80',
  cancelled: 'var(--ep-danger)',
};

export function EpClassStatsModal() {
  const editingId = useAppStore(s => s.editingId);
  const modalContext = useAppStore(s => s.modalContext);
  const schedule = useAppStore(s => s.schedule);
  const classes = useAppStore(s => s.classes);
  const students = useAppStore(s => s.students);
  const closeModal = useAppStore(s => s.closeModal);

  const statType = (modalContext?.classStatsType || 'completed') as ClassStatType;
  const cls = classes.find(c => c.id === editingId);

  const lessons = useMemo(() => {
    if (!cls) return [];
    return schedule
      .filter(l => l.classId === cls.id && l.status === statType)
      .sort((a, b) => a.date === b.date ? a.time.localeCompare(b.time) : b.date.localeCompare(a.date));
  }, [cls, schedule, statType]);

  if (!cls) return null;

  const title = STAT_TITLES[statType];
  const icon = STAT_ICONS[statType];
  const color = STAT_COLORS[statType];

  const getStudentName = (studentId: string) => {
    const st = students.find(s => s.id === studentId);
    return st?.name || 'Неизвестный';
  };

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
            <p className="text-xs ep-muted">{cls.name} &middot; {lessons.length} {lessons.length === 1 ? 'запись' : lessons.length < 5 ? 'записи' : 'записей'}</p>
          </div>
        </div>
      </div>

      {/* List */}
      {lessons.length === 0 ? (
        <div className="text-center py-8">
          <i className={`fa-solid ${icon} text-3xl mb-3 ep-muted`} />
          <p className="text-sm ep-muted">Нет данных</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
          {statType === 'completed' && lessons.map(l => (
            <div
              key={l.id}
              className="p-3 rounded-lg transition-all"
              style={{ background: 'var(--ep-bg-secondary)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(74,222,128,0.1)' }}
                  >
                    <i className="fa-solid fa-check text-xs" style={{ color: '#4ade80' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{l.topic}</div>
                    <div className="text-xs ep-muted">
                      {fmtDateRu(parseDate(l.date))} &middot; {l.time} &middot; {l.duration} мин
                    </div>
                  </div>
                </div>
                <div className="text-sm font-bold flex-shrink-0 ml-3" style={{ color: '#4ade80' }}>{fmtMoney(l.price)}</div>
              </div>
              {/* Attendance summary for completed group lessons */}
              {l.isGroup && l.attendance && l.attendance.length > 0 && (
                <div className="mt-2 pt-2 flex flex-wrap gap-1.5" style={{ borderTop: '1px solid var(--ep-border)' }}>
                  {l.attendance.map(a => (
                    <span
                      key={a.studentId}
                      className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{
                        background: a.present ? 'rgba(0,229,160,0.1)' : 'rgba(255,92,92,0.1)',
                        color: a.present ? 'var(--ep-accent)' : 'var(--ep-danger)',
                      }}
                    >
                      <i className={`fa-solid ${a.present ? 'fa-check' : 'fa-xmark'} mr-1`} style={{ fontSize: 8 }} />
                      {getStudentName(a.studentId)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {statType === 'cancelled' && lessons.map(l => {
            const byStudent = l.cancellation?.cancelledBy === 'student';
            const byTutor = l.cancellation?.cancelledBy === 'tutor';
            return (
              <div
                key={l.id}
                className="flex items-center justify-between p-3 rounded-lg transition-all"
                style={{ background: 'var(--ep-bg-secondary)' }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: byStudent ? 'rgba(255,92,92,0.1)' : 'rgba(251,191,36,0.1)' }}
                  >
                    <i
                      className={`fa-solid ${byStudent ? 'fa-user-xmark' : 'fa-chalkboard-user'} text-xs`}
                      style={{ color: byStudent ? 'var(--ep-danger)' : 'var(--ep-warning)' }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{l.cancellation?.reason || 'Причина не указана'}</div>
                    <div className="text-xs ep-muted">
                      {fmtDateRu(parseDate(l.date))} &middot; {l.time}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: byStudent ? 'var(--ep-danger)' : 'var(--ep-warning)' }}>
                      {byStudent ? 'Отменено учеником' : byTutor ? 'Отменено репетитором' : 'Вина не указана'}
                    </div>
                  </div>
                </div>
                {l.cancellation?.penaltyAmount && l.cancellation.penaltyAmount > 0 && (
                  <div className="text-right flex-shrink-0 ml-3">
                    <div className="text-sm font-bold" style={{ color: 'var(--ep-danger)' }}>
                      Штраф: {fmtMoney(l.cancellation.penaltyAmount)}
                    </div>
                  </div>
                )}
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
