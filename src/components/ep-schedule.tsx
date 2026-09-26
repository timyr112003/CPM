'use client';

import { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { fmtMoney, fmtDateRu, fmtDate, getWeekDays, parseDate, isToday } from '@/lib/ep-utils';
import { DAYS_SHORT_RU } from '@/lib/ep-types';

export function EpSchedule() {
  const schedule = useAppStore(s => s.schedule);
  const weekOffset = useAppStore(s => s.weekOffset);
  const setWeekOffset = useAppStore(s => s.setWeekOffset);
  const openModal = useAppStore(s => s.openModal);
  const changeLessonStatus = useAppStore(s => s.changeLessonStatus);
  const deleteLesson = useAppStore(s => s.deleteLesson);
  const addToast = useAppStore(s => s.addToast);
  const openConfirm = useAppStore(s => s.openConfirm);

  const [searchQuery, setSearchQuery] = useState('');

  const days = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  const q = searchQuery.trim().toLowerCase();

  const handleCancelLesson = (lessonId: string) => {
    openModal('cancellation', lessonId);
  };

  const handleCompleteLesson = (lesson: { id: string; isGroup: boolean; studentIds: string[] }) => {
    if (lesson.isGroup && lesson.studentIds.length > 1) {
      openModal('attendance', lesson.id);
    } else {
      changeLessonStatus(lesson.id, 'completed');
    }
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3 ep-fade-in">
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekOffset(weekOffset - 1)} className="ep-btn-ghost py-2 px-3">
            <i className="fa-solid fa-chevron-left" />
          </button>
          <span className="font-semibold text-sm min-w-[200px] text-center">
            {fmtDateRu(days[0])} — {fmtDateRu(days[6])}
          </span>
          <button onClick={() => setWeekOffset(weekOffset + 1)} className="ep-btn-ghost py-2 px-3">
            <i className="fa-solid fa-chevron-right" />
          </button>
        </div>
        <div className="flex items-center gap-3 flex-1 justify-end">
          {schedule.length > 0 && (
            <div className="relative w-full max-w-xs">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs ep-muted pointer-events-none" />
              <input
                type="text"
                className="ep-input ep-search-input text-sm"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по ученику, теме..."
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center ep-muted hover:opacity-70"
                  title="Очистить"
                >
                  <i className="fa-solid fa-xmark text-xs" />
                </button>
              )}
            </div>
          )}
          <button onClick={() => setWeekOffset(0)} className="ep-btn-ghost py-2 px-4 text-xs font-semibold">
            Сегодня
          </button>
        </div>
      </div>

      {/* Days */}
      <div className="space-y-4">
        {days.map((day, i) => {
          const ds = fmtDate(day);
          const dl = schedule.filter(l => l.date === ds).sort((a, b) => a.time.localeCompare(b.time));
          // Если есть поисковый запрос — фильтруем уроки по нему
          const filteredDl = q
            ? dl.filter(l =>
                l.student.toLowerCase().includes(q) ||
                l.topic.toLowerCase().includes(q) ||
                l.time.includes(q) ||
                (l.notes || '').toLowerCase().includes(q) ||
                (l.homework || '').toLowerCase().includes(q)
              )
            : dl;
          const td = isToday(day);

          return (
            <div key={i} className="ep-fade-in" style={{ animationDelay: (i * 0.04) + 's' }}>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{
                    background: td ? 'var(--ep-accent)' : 'var(--ep-bg2)',
                    color: td ? '#080b12' : 'var(--ep-muted)',
                  }}
                >
                  {DAYS_SHORT_RU[i]}
                </div>
                <span className={`text-sm font-semibold ${td ? '' : 'opacity-60'}`}>
                  {fmtDateRu(day)}{td ? ' — Сегодня' : ''}
                </span>
                <span className="text-xs ep-muted">{filteredDl.length} уроков</span>
              </div>
              <div className="space-y-2 ml-12">
                {filteredDl.length === 0 ? (
                  <div className="text-xs py-3 ep-muted">{q ? 'Ничего не найдено' : 'Нет занятий'}</div>
                ) : filteredDl.map(l => (
                  <div key={l.id} className="lesson-card flex items-center gap-4 flex-wrap">
                    <div className="text-center min-w-[50px]">
                      <div className="text-sm font-bold">{l.time}</div>
                      <div className="text-xs ep-muted">{l.duration} мин</div>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <div className="text-sm font-semibold">
                        {l.isGroup && <span className="badge badge-group mr-1">Группа</span>}
                        {l.student}
                      </div>
                      <div className="text-xs ep-muted">{l.topic}</div>
                    </div>
                    <div className="text-sm font-semibold ep-accent-color">{fmtMoney(l.price)}</div>
                    <span className={`badge ${l.status === 'completed' ? 'badge-completed' : l.status === 'cancelled' ? 'badge-cancelled' : 'badge-planned'}`}>
                      {l.status === 'completed' ? 'Проведён' : l.status === 'cancelled' ? 'Отменён' : 'Запланирован'}
                    </span>
                    <div className="flex items-center gap-1">
                      {l.status === 'planned' && (
                        <>
                          <button onClick={() => handleCompleteLesson(l)} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(0,229,160,0.12)', color: 'var(--ep-accent)' }} title="Проведён">
                            <i className="fa-solid fa-check text-xs" />
                          </button>
                          <button onClick={() => handleCancelLesson(l.id)} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(255,92,92,0.12)', color: 'var(--ep-danger)' }} title="Отменить">
                            <i className="fa-solid fa-xmark text-xs" />
                          </button>
                        </>
                      )}
                      {l.status === 'completed' && (
                        <>
                          <button onClick={() => handleCancelLesson(l.id)} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(255,92,92,0.12)', color: 'var(--ep-danger)' }} title="Отменить">
                            <i className="fa-solid fa-xmark text-xs" />
                          </button>
                          <button onClick={() => changeLessonStatus(l.id, 'planned')} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(128,128,128,0.12)', color: 'var(--ep-muted)' }} title="Сбросить">
                            <i className="fa-solid fa-rotate-left text-xs" />
                          </button>
                        </>
                      )}
                      {l.status === 'cancelled' && (
                        <>
                          <button onClick={() => handleCompleteLesson(l)} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(0,229,160,0.12)', color: 'var(--ep-accent)' }} title="Проведён">
                            <i className="fa-solid fa-check text-xs" />
                          </button>
                          <button onClick={() => changeLessonStatus(l.id, 'planned')} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(128,128,128,0.12)', color: 'var(--ep-muted)' }} title="Сбросить">
                            <i className="fa-solid fa-rotate-left text-xs" />
                          </button>
                        </>
                      )}
                      <button onClick={() => openModal('lesson', l.id)} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(128,128,128,0.08)', color: 'var(--ep-muted)' }}>
                        <i className="fa-solid fa-pen text-xs" />
                      </button>
                      <button onClick={() => openConfirm('Удалить этот урок?', () => { deleteLesson(l.id); addToast('Урок удалён', 'info'); })} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(128,128,128,0.08)', color: 'var(--ep-muted)' }}>
                        <i className="fa-solid fa-trash text-xs" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
