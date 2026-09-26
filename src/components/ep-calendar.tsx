'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { fmtMoney, fmtDateRu, fmtDate, parseDate, getWeekDays, isToday, timeToMinutes, minutesToTime } from '@/lib/ep-utils';
import { MONTHS_RU, MONTHS_GEN_RU, DAYS_SHORT_RU, DAYS_FULL_RU } from '@/lib/ep-types';

/* ═══════════════════ CONSTANTS ═══════════════════ */
const HOUR_HEIGHT = 60;   // px per hour (1 px = 1 minute)
const SLOT_MIN    = 30;   // 30-minute grid step
const START_HOUR  = 0;
const END_HOUR    = 24;
const HOURS       = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);

/* ═══════════════════ HELPERS ═══════════════════ */

/** Calculate 30-min time slot from pointer event within a time-cell */
function getTimeFromPointer(e: React.DragEvent | React.MouseEvent, hour: number): string {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const offsetY = Math.max(0, Math.min(HOUR_HEIGHT - 1, e.clientY - rect.top));
  const slot = Math.min(1, Math.max(0, Math.floor(offsetY / SLOT_MIN)));
  return minutesToTime(hour * 60 + slot * SLOT_MIN);
}

/** CSS class for lesson status + type */
function lessonCls(l: { status: string; isGroup: boolean }): string {
  if (l.status === 'completed') return 'completed-lesson';
  if (l.status === 'cancelled') return 'cancelled-lesson';
  if (l.isGroup) return 'group-lesson';
  return 'planned-lesson';
}

/** Subtle 30-min grid lines inside a time cell */
function SlotGrid() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          'repeating-linear-gradient(to bottom, transparent 0px, transparent 29px, var(--ep-border) 29px, var(--ep-border) 30px)',
        opacity: 0.3,
      }}
    />
  );
}

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */
export function EpCalendar() {
  const calView    = useAppStore(s => s.calView);
  const calMonth   = useAppStore(s => s.calMonth);
  const calYear    = useAppStore(s => s.calYear);
  const calSelected= useAppStore(s => s.calSelected);
  const weekOffset = useAppStore(s => s.weekOffset);
  const calDayDate = useAppStore(s => s.calDayDate);
  const schedule   = useAppStore(s => s.schedule);
  const theme      = useAppStore(s => s.theme);

  const setCalView   = useAppStore(s => s.setCalView);
  const setCalMonth  = useAppStore(s => s.setCalMonth);
  const setCalYear   = useAppStore(s => s.setCalYear);
  const setCalSelected = useAppStore(s => s.setCalSelected);
  const setWeekOffset = useAppStore(s => s.setWeekOffset);
  const setCalDayDate = useAppStore(s => s.setCalDayDate);
  const openModal    = useAppStore(s => s.openModal);
  const addToast     = useAppStore(s => s.addToast);
  const moveLesson   = useAppStore(s => s.moveLesson);

  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, lessonId: string) => {
    e.stopPropagation();
    setDraggedId(lessonId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', lessonId);
  };

  const handleDrop = (targetDate: string, targetTime: string) => {
    if (!draggedId) return;
    const lesson = schedule.find(l => l.id === draggedId);
    if (!lesson) return;
    moveLesson(draggedId, targetDate, targetTime);
    const dc = lesson.date !== targetDate;
    const tc = lesson.time !== targetTime;
    if (dc || tc) {
      const parts: string[] = [];
      if (dc) parts.push('на ' + fmtDateRu(parseDate(targetDate)));
      if (tc) parts.push('в ' + targetTime);
      addToast('Занятие перенесено ' + parts.join(' '), 'success');
    }
    setDraggedId(null);
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  return (
    <div className="space-y-5">
      {/* ─── Controls ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3 ep-fade-in">
        <div className="flex items-center gap-3">
          {calView === 'month' && (
            <>
              <button onClick={prevMonth} className="ep-btn-ghost py-2 px-3"><i className="fa-solid fa-chevron-left" /></button>
              <span className="font-semibold text-sm min-w-[200px] text-center">{MONTHS_RU[calMonth]} {calYear}</span>
              <button onClick={nextMonth} className="ep-btn-ghost py-2 px-3"><i className="fa-solid fa-chevron-right" /></button>
            </>
          )}
          {calView === 'week' && (
            <>
              <button onClick={() => setWeekOffset(weekOffset - 1)} className="ep-btn-ghost py-2 px-3"><i className="fa-solid fa-chevron-left" /></button>
              <span className="font-semibold text-sm min-w-[240px] text-center">{fmtDateRu(weekDays[0])} — {fmtDateRu(weekDays[6])}</span>
              <button onClick={() => setWeekOffset(weekOffset + 1)} className="ep-btn-ghost py-2 px-3"><i className="fa-solid fa-chevron-right" /></button>
            </>
          )}
          {calView === 'day' && (
            <>
              <button onClick={() => setCalDayDate(fmtDate(new Date(parseDate(calDayDate).getTime() - 86400000)))} className="ep-btn-ghost py-2 px-3"><i className="fa-solid fa-chevron-left" /></button>
              <span className="font-semibold text-sm min-w-[200px] text-center">
                {DAYS_FULL_RU[(parseDate(calDayDate).getDay() + 6) % 7]}, {fmtDateRu(parseDate(calDayDate))}
              </span>
              <button onClick={() => setCalDayDate(fmtDate(new Date(parseDate(calDayDate).getTime() + 86400000)))} className="ep-btn-ghost py-2 px-3"><i className="fa-solid fa-chevron-right" /></button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCalMonth(new Date().getMonth());
              setCalYear(new Date().getFullYear());
              setCalSelected(null);
              setWeekOffset(0);
              setCalDayDate(fmtDate(new Date()));
            }}
            className="ep-btn-ghost py-2 px-4 text-xs font-semibold"
          >
            Сегодня
          </button>
          <div className="view-tabs">
            {(['month', 'week', 'day'] as const).map(v => (
              <button
                key={v}
                className={`view-tab ${calView === v ? 'active' : ''}`}
                onClick={() => setCalView(v)}
              >
                {v === 'month' ? 'Месяц' : v === 'week' ? 'Неделя' : 'День'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Views ─── */}
      {calView === 'month' && <MonthView onDragStart={handleDragStart} onDrop={handleDrop} />}
      {calView === 'week' && <WeekView onDragStart={handleDragStart} onDrop={handleDrop} />}
      {calView === 'day'  && <DayView  onDragStart={handleDragStart} onDrop={handleDrop} />}
    </div>
  );
}

/* ═══════════════════ MONTH VIEW ═══════════════════ */
function MonthView({ onDragStart, onDrop }: {
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDrop: (date: string, time: string) => void;
}) {
  const calMonth     = useAppStore(s => s.calMonth);
  const calYear      = useAppStore(s => s.calYear);
  const calSelected  = useAppStore(s => s.calSelected);
  const schedule     = useAppStore(s => s.schedule);
  const setCalSelected = useAppStore(s => s.setCalSelected);
  const setCalView   = useAppStore(s => s.setCalView);
  const setCalDayDate = useAppStore(s => s.setCalDayDate);
  const openModal    = useAppStore(s => s.openModal);
  const changeLessonStatus = useAppStore(s => s.changeLessonStatus);
  const deleteLesson = useAppStore(s => s.deleteLesson);
  const addToast     = useAppStore(s => s.addToast);
  const openConfirm  = useAppStore(s => s.openConfirm);

  const todayStr   = fmtDate(new Date());
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDow    = new Date(calYear, calMonth, 1).getDay();
  const firstDowAdj = firstDow === 0 ? 6 : firstDow - 1;
  const prevDays    = new Date(calYear, calMonth, 0).getDate();

  const cells: { day: number; other: boolean; date: string | null }[] = [];
  for (let i = firstDowAdj - 1; i >= 0; i--) cells.push({ day: prevDays - i, other: true, date: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, other: false, date: ds });
  }
  const rem = 7 - cells.length % 7;
  if (rem < 7) for (let i = 1; i <= rem; i++) cells.push({ day: i, other: true, date: null });

  const selectedLessons = calSelected
    ? schedule.filter(l => l.date === calSelected).sort((a, b) => a.time.localeCompare(b.time))
    : [];

  const handleDropMonth = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    onDrop(date, '09:00');
  };

  return (
    <>
      <div className="cal-grid ep-fade-in" style={{ animationDelay: '0.05s' }}>
        {DAYS_SHORT_RU.map(d => <div key={d} className="cal-header">{d}</div>)}
        {cells.map((c, idx) => {
          const isT   = c.date === todayStr;
          const isSel = c.date === calSelected;
          const lessons = c.date ? schedule.filter(l => l.date === c.date) : [];
          return (
            <div
              key={idx}
              className={`cal-day ${c.other ? 'other-month' : ''} ${isT ? 'today' : ''} ${isSel ? 'selected' : ''}`}
              onClick={c.date ? () => setCalSelected(c.date!) : undefined}
              onDragOver={e => e.preventDefault()}
              onDrop={c.date ? (e) => handleDropMonth(e, c.date!) : undefined}
            >
              <div className="cal-day-num" style={isT ? { color: 'var(--ep-accent)' } : {}}>{c.day}</div>
              {lessons.slice(0, 2).map(l => (
                <span
                  key={l.id}
                  className={`cal-lesson-mini ${l.status} ${l.isGroup ? 'group' : ''}`}
                  draggable
                  onDragStart={e => onDragStart(e, l.id)}
                >
                  {l.isGroup && <i className="fa-solid fa-users" style={{ fontSize: 8 }} />}
                  {l.time} {l.student.split(':').pop()?.trim().split(' ')[0]}
                </span>
              ))}
              {lessons.length > 2 && <div className="text-xs mt-1 ep-muted">+{lessons.length - 2}</div>}
              <div className="cal-dots-row">
                {lessons.map((l, j) => (
                  <span
                    key={j}
                    className="cal-dot"
                    style={{
                      background: l.status === 'completed' ? 'var(--ep-accent)'
                        : l.status === 'cancelled' ? 'var(--ep-danger)'
                        : l.isGroup ? '#a78bfa' : '#60a5fa',
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {calSelected ? (
        <CalDayDetail
          dateStr={calSelected}
          lessons={selectedLessons}
          onOpenAdd={() => openModal('lesson', undefined, { prefillDate: calSelected })}
          onViewDay={() => { setCalDayDate(calSelected); setCalView('day'); }}
          onClose={() => setCalSelected(null)}
        />
      ) : (
        <div className="ep-card-static p-8 text-center ep-fade-in" style={{ animationDelay: '0.1s' }}>
          <i className="fa-regular fa-hand-pointer text-3xl mb-3 ep-muted" />
          <p className="ep-muted">Выберите день в календаре для просмотра занятий</p>
        </div>
      )}
    </>
  );
}

/* ═══════════════════ CAL-DAY DETAIL PANEL ═══════════════════ */
function CalDayDetail({ dateStr, lessons, onOpenAdd, onViewDay, onClose }: {
  dateStr: string;
  lessons: { id: string; time: string; duration: number; student: string; topic: string; price: number; status: string; isGroup: boolean; studentIds: string[] }[];
  onOpenAdd: () => void;
  onViewDay: () => void;
  onClose: () => void;
}) {
  const openModal = useAppStore(s => s.openModal);
  const changeLessonStatus = useAppStore(s => s.changeLessonStatus);
  const deleteLesson = useAppStore(s => s.deleteLesson);
  const addToast = useAppStore(s => s.addToast);
  const openConfirm = useAppStore(s => s.openConfirm);

  const d = parseDate(dateStr);
  const dayName = DAYS_SHORT_RU[(d.getDay() + 6) % 7];

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
    <div className="ep-card-static p-5 ep-fade-in" style={{ animationDelay: '0.1s' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-bold text-sm">{dayName}, {fmtDateRu(d)}</h4>
          <p className="text-xs ep-muted">{lessons.length} занятий</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onOpenAdd} className="ep-btn-accent text-xs py-2 px-4">
            <i className="fa-solid fa-plus mr-1" />Добавить
          </button>
          <button onClick={onViewDay} className="ep-btn-ghost text-xs py-2 px-3" title="Дневной вид">
            <i className="fa-solid fa-calendar-day" />
          </button>
          <button onClick={onClose} className="ep-btn-ghost text-xs py-2 px-3">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      </div>
      {lessons.length === 0 ? (
        <p className="text-sm py-4 text-center ep-muted">Нет занятий</p>
      ) : (
        <div className="space-y-3">
          {lessons.map(l => {
            const sc = l.status === 'completed' ? 'badge-completed' : l.status === 'cancelled' ? 'badge-cancelled' : 'badge-planned';
            const st = l.status === 'completed' ? 'Проведён' : l.status === 'cancelled' ? 'Отменён' : 'Запланирован';
            return (
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
                <span className={`badge ${sc}`}>{st}</span>
                <div className="flex items-center gap-1">
                  {l.status === 'planned' && (
                    <>
                      <button
                        onClick={() => handleCompleteLesson(l)}
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ background: 'rgba(0,229,160,0.12)', color: 'var(--ep-accent)' }}
                        title="Проведён"
                      >
                        <i className="fa-solid fa-check text-xs" />
                      </button>
                      <button
                        onClick={() => handleCancelLesson(l.id)}
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ background: 'rgba(255,92,92,0.12)', color: 'var(--ep-danger)' }}
                        title="Отменить"
                      >
                        <i className="fa-solid fa-xmark text-xs" />
                      </button>
                    </>
                  )}
                  {l.status === 'completed' && (
                    <>
                      <button
                        onClick={() => handleCancelLesson(l.id)}
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ background: 'rgba(255,92,92,0.12)', color: 'var(--ep-danger)' }}
                        title="Отменить"
                      >
                        <i className="fa-solid fa-xmark text-xs" />
                      </button>
                      <button
                        onClick={() => changeLessonStatus(l.id, 'planned')}
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ background: 'rgba(128,128,128,0.12)', color: 'var(--ep-muted)' }}
                        title="Сбросить в запланирован"
                      >
                        <i className="fa-solid fa-rotate-left text-xs" />
                      </button>
                    </>
                  )}
                  {l.status === 'cancelled' && (
                    <>
                      <button
                        onClick={() => handleCompleteLesson(l)}
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ background: 'rgba(0,229,160,0.12)', color: 'var(--ep-accent)' }}
                        title="Проведён"
                      >
                        <i className="fa-solid fa-check text-xs" />
                      </button>
                      <button
                        onClick={() => changeLessonStatus(l.id, 'planned')}
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ background: 'rgba(128,128,128,0.12)', color: 'var(--ep-muted)' }}
                        title="Сбросить в запланирован"
                      >
                        <i className="fa-solid fa-rotate-left text-xs" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => openModal('lesson-detail', l.id)}
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ background: 'rgba(128,128,128,0.08)', color: 'var(--ep-muted)' }}
                    title="Подробнее"
                  >
                    <i className="fa-solid fa-eye text-xs" />
                  </button>
                  <button
                    onClick={() => openConfirm('Удалить этот урок?', () => { deleteLesson(l.id); addToast('Урок удалён', 'info'); })}
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ background: 'rgba(128,128,128,0.08)', color: 'var(--ep-muted)' }}
                    title="Удалить"
                  >
                    <i className="fa-solid fa-trash text-xs" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ WEEK VIEW (30-min grid) ═══════════════════ */
function WeekView({ onDragStart, onDrop }: {
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDrop: (date: string, time: string) => void;
}) {
  const weekOffset = useAppStore(s => s.weekOffset);
  const schedule   = useAppStore(s => s.schedule);
  const openModal  = useAppStore(s => s.openModal);
  const todayStr   = fmtDate(new Date());
  const weekDays   = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  /* Scroll to ~8:00 on mount */
  const scrollRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      const now = new Date();
      el.scrollTop = Math.max(0, (now.getHours() - START_HOUR) * HOUR_HEIGHT + now.getMinutes() - HOUR_HEIGHT);
    }
  }, []);

  return (
    <div className="time-grid ep-fade-in" style={{ animationDelay: '0.05s' }}>
      {/* ── Header ── */}
      <div className="time-grid-header" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        <div className="time-grid-header-cell" />
        {weekDays.map((d, i) => {
          const ds = fmtDate(d);
          const isT = ds === todayStr;
          return (
            <div key={i} className={`time-grid-header-cell ${isT ? 'today-col' : ''}`}>
              <div className="text-xs">{DAYS_SHORT_RU[i]}</div>
              <div className="text-base font-bold" style={isT ? { color: 'var(--ep-accent)' } : {}}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      {/* ── Body ── */}
      <div className="time-grid-body" ref={scrollRef} style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {HOURS.map(h => (
          <div key={h} className="time-row" style={{ gridTemplateColumns: '56px repeat(7, 1fr)', height: HOUR_HEIGHT }}>
            <div className="time-label" style={{ height: HOUR_HEIGHT }}>
              {String(h).padStart(2, '0')}:00
            </div>

            {weekDays.map((d, di) => {
              const dateStr = fmtDate(d);
              const isT = dateStr === todayStr;

              /* All lessons whose start falls within this hour (00-59) */
              const hourLessons = schedule.filter(l => {
                if (l.date !== dateStr) return false;
                const m = timeToMinutes(l.time);
                return m >= h * 60 && m < (h + 1) * 60;
              });

              /* Now-line (only for today) */
              let nowLine: React.ReactNode = null;
              if (isT) {
                const now = new Date();
                if (now.getHours() === h) {
                  nowLine = <div className="now-line" style={{ top: now.getMinutes() }} />;
                }
              }

              return (
                <div
                  key={di}
                  className={`time-cell ${isT ? 'today-col' : ''}`}
                  style={{ position: 'relative', height: HOUR_HEIGHT }}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={e => { e.preventDefault(); onDrop(dateStr, getTimeFromPointer(e, h)); }}
                  onClick={e => openModal('lesson', undefined, { prefillDate: dateStr, prefillTime: getTimeFromPointer(e, h) })}
                >
                  <SlotGrid />

                  {hourLessons.map(l => {
                    const startMin = timeToMinutes(l.time);
                    const topPx    = startMin - h * 60;   // offset within hour (px = min)
                    const heightPx = l.duration;            // 1 px per minute
                    return (
                      <div
                        key={l.id}
                        className={`grid-lesson ${lessonCls(l)}`}
                        draggable
                        onDragStart={e => onDragStart(e, l.id)}
                        onClick={e => { e.stopPropagation(); openModal('lesson-detail', l.id); }}
                        style={{ height: heightPx, top: topPx }}
                        title={`${l.time} ${l.student} — ${l.topic}`}
                      >
                        {heightPx >= 20 && (
                          <div className="grid-lesson-title">
                            {l.isGroup && <i className="fa-solid fa-users grid-lesson-group-icon" style={{ fontSize: 9 }} />}
                            {l.time} {l.student.replace('Группа: ', '').split(' ')[0]}
                          </div>
                        )}
                        {heightPx >= 35 && <div className="grid-lesson-sub">{l.topic}</div>}
                      </div>
                    );
                  })}

                  {nowLine}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════ DAY VIEW (30-min grid) ═══════════════════ */
function DayView({ onDragStart, onDrop }: {
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDrop: (date: string, time: string) => void;
}) {
  const calDayDate = useAppStore(s => s.calDayDate);
  const schedule   = useAppStore(s => s.schedule);
  const openModal  = useAppStore(s => s.openModal);
  const todayStr   = fmtDate(new Date());
  const isT        = calDayDate === todayStr;

  const dayLessons = useMemo(
    () => schedule.filter(l => l.date === calDayDate).sort((a, b) => a.time.localeCompare(b.time)),
    [schedule, calDayDate],
  );

  /* Scroll to ~1 hour before now */
  const scrollRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      const now = new Date();
      el.scrollTop = Math.max(0, (now.getHours() - START_HOUR) * HOUR_HEIGHT + now.getMinutes() - HOUR_HEIGHT);
    }
  }, []);

  return (
    <div className="space-y-5">
      {/* ── Day header ── */}
      <div className="flex items-center justify-between mb-4 ep-fade-in">
        <div>
          <div className="day-header-date" style={isT ? { color: 'var(--ep-accent)' } : {}}>
            {parseDate(calDayDate).getDate()} {MONTHS_GEN_RU[parseDate(calDayDate).getMonth()]}
          </div>
          <div className="day-header-weekday">
            {DAYS_FULL_RU[(parseDate(calDayDate).getDay() + 6) % 7]}{isT ? ' — Сегодня' : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm ep-muted">{dayLessons.length} занятий</span>
          <button
            onClick={() => openModal('lesson', undefined, { prefillDate: calDayDate })}
            className="ep-btn-accent text-xs py-2 px-4"
          >
            <i className="fa-solid fa-plus mr-1" />Добавить
          </button>
        </div>
      </div>

      {/* ── Time grid ── */}
      <div className="time-grid ep-fade-in" style={{ animationDelay: '0.05s' }}>
        <div className="time-grid-body" ref={scrollRef} style={{ maxHeight: 'calc(100vh - 360px)' }}>
          {HOURS.map(h => {
            const hourLessons = dayLessons.filter(l => {
              const m = timeToMinutes(l.time);
              return m >= h * 60 && m < (h + 1) * 60;
            });

            /* Now-line */
            let nowLine: React.ReactNode = null;
            if (isT) {
              const now = new Date();
              if (now.getHours() === h) {
                nowLine = <div className="now-line" style={{ top: now.getMinutes() }} />;
              }
            }

            return (
              <div key={h} className="time-row" style={{ gridTemplateColumns: '64px 1fr', height: HOUR_HEIGHT }}>
                <div className="time-label" style={{ height: HOUR_HEIGHT }}>
                  {String(h).padStart(2, '0')}:00
                </div>

                <div
                  className={`time-cell ${isT ? 'today-col' : ''}`}
                  style={{ position: 'relative', height: HOUR_HEIGHT }}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={e => { e.preventDefault(); onDrop(calDayDate, getTimeFromPointer(e, h)); }}
                  onClick={e => openModal('lesson', undefined, { prefillDate: calDayDate, prefillTime: getTimeFromPointer(e, h) })}
                >
                  <SlotGrid />

                  {hourLessons.map(l => {
                    const startMin = timeToMinutes(l.time);
                    const topPx    = startMin - h * 60;
                    const heightPx = l.duration;
                    return (
                      <div
                        key={l.id}
                        className={`grid-lesson ${lessonCls(l)}`}
                        draggable
                        onDragStart={e => onDragStart(e, l.id)}
                        onClick={e => { e.stopPropagation(); openModal('lesson-detail', l.id); }}
                        style={{ height: heightPx, top: topPx }}
                      >
                        {heightPx >= 20 && (
                          <div className="grid-lesson-title">
                            {l.isGroup && <i className="fa-solid fa-users grid-lesson-group-icon" style={{ fontSize: 9 }} />}
                            {l.time} {l.student}
                          </div>
                        )}
                        {heightPx >= 35 && <div className="grid-lesson-sub">{l.topic} · {l.duration} мин</div>}
                      </div>
                    );
                  })}

                  {nowLine}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
