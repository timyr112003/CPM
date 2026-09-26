'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { genId, fmtDate, fmtMoney } from '@/lib/ep-utils';
import { DAYS_SHORT_RU, RecurringPattern } from '@/lib/ep-types';

export function EpLessonModal() {
  const editingId = useAppStore(s => s.editingId);
  const modalContext = useAppStore(s => s.modalContext);
  const students = useAppStore(s => s.students);
  const classes = useAppStore(s => s.classes);
  const activeStudents = useMemo(() => students.filter(s => !s.archived), [students]);
  const schedule = useAppStore(s => s.schedule);
  const addLesson = useAppStore(s => s.addLesson);
  const addRecurringLessons = useAppStore(s => s.addRecurringLessons);
  const updateLesson = useAppStore(s => s.updateLesson);
  const closeModal = useAppStore(s => s.closeModal);
  const addToast = useAppStore(s => s.addToast);

  const existing = editingId ? schedule.find(l => l.id === editingId) : null;
  const prefillDate = modalContext.prefillDate || (existing?.date || fmtDate(new Date()));
  const prefillTime = modalContext.prefillTime || existing?.time || '10:00';

  const [isGroup, setIsGroup] = useState(existing?.isGroup || false);
  const [studentId, setStudentId] = useState(existing?.studentId || '');
  const [classId, setClassId] = useState(existing?.classId || (classes[0]?.id || ''));
  const [date, setDate] = useState(prefillDate);
  const [time, setTime] = useState(prefillTime);
  const [duration, setDuration] = useState(existing?.duration || 60);
  const [priceStr, setPriceStr] = useState(String(existing?.price || 0));

  // Auto-set price when switching student (only for new lessons)
  const handleStudentChange = (newId: string) => {
    setStudentId(newId);
    if (!existing) {
      const s = activeStudents.find(st => st.id === newId);
      if (s) setPriceStr(String(s.rate));
    }
  };

  // Auto-set price when switching class (only for new lessons)
  const handleClassChange = (newId: string) => {
    setClassId(newId);
    if (!existing) {
      const cls = classes.find(c => c.id === newId);
      if (cls) setPriceStr(String(cls.pricePerLesson || 0));
    }
  };
  const [topic, setTopic] = useState(existing?.topic || '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [homework, setHomework] = useState(existing?.homework || '');
  const [materials, setMaterials] = useState(existing?.materials || '');

  // Recurring state
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [recEndDate, setRecEndDate] = useState('');

  const selectedStudent = students.find(s => s.id === studentId);
  const selectedClass = classes.find(c => c.id === classId);
  const price = Number(priceStr) || 0;

  // Calculate how many lessons will be created
  const recurringCount = useMemo(() => {
    if (!isRecurring || selectedDays.length === 0 || !date || !recEndDate) return 0;
    const startDate = new Date(date + 'T00:00:00');
    const endDate = new Date(recEndDate + 'T00:00:00');
    if (endDate <= startDate) return 0;
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      const dow = (current.getDay() + 6) % 7;
      if (selectedDays.includes(dow)) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }, [isRecurring, selectedDays, date, recEndDate]);

  const toggleDay = (dayIdx: number) => {
    setSelectedDays(prev =>
      prev.includes(dayIdx)
        ? prev.filter(d => d !== dayIdx)
        : [...prev, dayIdx].sort()
    );
  };

  // When date changes and recurring is on, auto-select that day of week
  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    if (isRecurring) {
      const d = new Date(newDate + 'T00:00:00');
      const dow = (d.getDay() + 6) % 7;
      if (!selectedDays.includes(dow)) {
        setSelectedDays(prev => [...prev, dow].sort());
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let lessonStudent = '';
    let lessonStudentIds: string[] = [];
    let lessonStudentId: string | null = null;
    let lessonClassId: string | null = null;

    if (isGroup) {
      lessonClassId = classId;
      lessonStudentIds = selectedClass?.studentIds || [];
      lessonStudent = 'Группа: ' + (selectedClass?.name || 'Неизвестно');
    } else {
      lessonStudentId = studentId;
      lessonStudentIds = [studentId];
      lessonStudent = selectedStudent?.name || '';
    }

    if (!isGroup && !studentId) { addToast('Выберите ученика', 'error'); return; }

    if (isRecurring && selectedDays.length === 0) {
      addToast('Выберите хотя бы один день недели для повторения', 'error');
      return;
    }
    if (isRecurring && !recEndDate) {
      addToast('Укажите дату окончания повторения', 'error');
      return;
    }
    if (isRecurring && recEndDate <= date) {
      addToast('Дата окончания должна быть позже даты начала', 'error');
      return;
    }

    const lessonBase = {
      date, time, topic: topic || 'Без темы', duration, price: Number(priceStr) || 0,
      status: 'planned' as const,
      isGroup,
      classId: lessonClassId,
      studentId: lessonStudentId,
      studentIds: lessonStudentIds,
      student: lessonStudent,
      notes: notes.trim() || undefined,
      homework: homework.trim() || undefined,
      materials: materials.trim() || undefined,
    };

    if (editingId) {
      updateLesson(editingId, {
        ...lessonBase,
        id: editingId,
        recurringGroupId: existing?.recurringGroupId || null,
        status: existing?.status || 'planned',
        cancellation: existing?.cancellation,
        attendance: existing?.attendance,
      });
      addToast('Урок обновлён', 'success');
    } else if (isRecurring) {
      const pattern: RecurringPattern = {
        daysOfWeek: selectedDays,
        endDate: recEndDate,
      };
      const count = addRecurringLessons(lessonBase, pattern);
      addToast(`Создано ${count} повторяющихся уроков`, 'success');
    } else {
      addLesson({ ...lessonBase, id: genId(), recurringGroupId: null });
      addToast('Урок добавлен', 'success');
    }
    closeModal();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">{existing ? 'Редактировать урок' : 'Новый урок'}</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Group toggle */}
        <div className="flex items-center gap-3 p-3 rounded-lg cursor-pointer ep-bg-base" onClick={() => setIsGroup(!isGroup)}>
          <input type="checkbox" checked={isGroup} onChange={() => setIsGroup(!isGroup)} className="w-4 h-4" style={{ accentColor: 'var(--ep-accent)' }} />
          <label className="text-sm font-semibold cursor-pointer flex items-center gap-2">
            <i className="fa-solid fa-users" style={{ color: '#a78bfa' }} />
            Групповое занятие (выбрать класс)
          </label>
        </div>

        {/* Student or Class */}
        {!isGroup ? (
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Ученик</label>
            <select className="ep-input" value={studentId} onChange={e => handleStudentChange(e.target.value)} required>
              <option value="">Выберите ученика</option>
              {activeStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({fmtMoney(s.rate)}/час)</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Класс</label>
            <select className="ep-input" value={classId} onChange={e => handleClassChange(e.target.value)}>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.studentIds.length} чел.)</option>
              ))}
            </select>
            {selectedClass && (
              <div className="mt-2 text-xs ep-muted">
                Ученики: {selectedClass.studentIds.map(id => students.find(s => s.id === id)?.name).filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Дата</label>
            <input type="date" className="ep-input" value={date} onChange={e => handleDateChange(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Время</label>
            <input type="time" className="ep-input" value={time} onChange={e => setTime(e.target.value)} required />
          </div>
        </div>

        {/* Duration & Price */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Длительность</label>
            <select className="ep-input" value={duration} onChange={e => setDuration(Number(e.target.value))}>
              <option value={45}>45 минут</option>
              <option value={60}>60 минут</option>
              <option value={90}>90 минут</option>
              <option value={120}>120 минут</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Стоимость (₽)</label>
            <input type="number" className="ep-input" value={priceStr} onChange={e => setPriceStr(e.target.value)} min={0} placeholder="0" />
          </div>
        </div>

        {/* Topic */}
        <div>
          <label className="block text-xs font-semibold mb-2 ep-muted">Тема занятия</label>
          <input type="text" className="ep-input" value={topic} onChange={e => setTopic(e.target.value)} placeholder="Например: Грамматика: Past Perfect" />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold mb-2 ep-muted">
            <i className="fa-solid fa-pen-to-square mr-1" />Заметки по уроку
          </label>
          <textarea
            className="ep-input min-h-[70px] resize-y"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Что прошли, на что обратить внимание..."
            rows={2}
          />
        </div>

        {/* Homework & Materials */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">
              <i className="fa-solid fa-book mr-1" />Домашнее задание
            </label>
            <textarea
              className="ep-input min-h-[70px] resize-y"
              value={homework}
              onChange={e => setHomework(e.target.value)}
              placeholder="Упражнения, страницы учебника..."
              rows={2}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">
              <i className="fa-solid fa-link mr-1" />Материалы
            </label>
            <textarea
              className="ep-input min-h-[70px] resize-y"
              value={materials}
              onChange={e => setMaterials(e.target.value)}
              placeholder="Ссылки, учебник, страницы..."
              rows={2}
            />
          </div>
        </div>

        {/* ═══ Recurring Lesson Section ═══ */}
        {!existing && (
          <div className="border border-dashed rounded-xl p-4 space-y-3" style={{ borderColor: 'var(--ep-border)', background: isRecurring ? 'rgba(167,139,250,0.04)' : 'transparent' }}>
            {/* Toggle */}
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setIsRecurring(!isRecurring)}
            >
              <div
                className="w-10 h-6 rounded-full relative transition-all duration-200"
                style={{ background: isRecurring ? 'var(--ep-accent)' : 'var(--ep-border)' }}
              >
                <div
                  className="absolute top-1 w-4 h-4 rounded-full transition-all duration-200"
                  style={{
                    left: isRecurring ? '20px' : '4px',
                    background: isRecurring ? '#080b12' : 'var(--ep-text-muted)',
                  }}
                />
              </div>
              <label className="text-sm font-semibold cursor-pointer">
                Повторяющийся урок
              </label>
            </div>

            {isRecurring && (
              <>
                {/* Day selection */}
                <div>
                  <label className="block text-xs font-semibold mb-2 ep-muted">
                <i className="fa-solid fa-calendar-week mr-1" style={{ color: '#a78bfa', fontSize: 11 }} />Повторять по дням
              </label>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS_SHORT_RU.map((dayLabel, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className="w-10 h-10 rounded-lg text-xs font-bold transition-all duration-150 flex items-center justify-center"
                        style={{
                          background: selectedDays.includes(idx) ? 'rgba(167,139,250,0.2)' : 'var(--ep-bg2, var(--ep-surface))',
                          color: selectedDays.includes(idx) ? '#a78bfa' : 'var(--ep-text-muted)',
                          border: selectedDays.includes(idx) ? '1px solid rgba(167,139,250,0.4)' : '1px solid var(--ep-border)',
                        }}
                      >
                        {dayLabel}
                      </button>
                    ))}
                  </div>
                  {selectedDays.length === 0 && (
                    <p className="text-xs mt-1" style={{ color: 'var(--ep-danger)' }}>Выберите хотя бы один день</p>
                  )}
                </div>

                {/* End date */}
                <div>
                  <label className="block text-xs font-semibold mb-2 ep-muted">Повторять до</label>
                  <input
                    type="date"
                    className="ep-input"
                    value={recEndDate}
                    min={date}
                    onChange={e => setRecEndDate(e.target.value)}
                  />
                </div>

                {/* Preview */}
                {recurringCount > 0 && (
                  <div
                    className="p-3 rounded-lg flex items-center gap-3"
                    style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)' }}
                  >
                    <i className="fa-solid fa-calendar-check" style={{ color: '#a78bfa', fontSize: 18 }} />
                    <div>
                      <div className="text-sm font-semibold" style={{ color: '#a78bfa' }}>
                        Будет создано {recurringCount} {recurringCount === 1 ? 'урок' : recurringCount < 5 ? 'урока' : 'уроков'}
                      </div>
                      <div className="text-xs ep-muted">
                        {selectedDays.map(d => DAYS_SHORT_RU[d]).join(', ')} &middot; с {date} по {recEndDate}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={closeModal} className="ep-btn-ghost">Отмена</button>
          <button type="submit" className="ep-btn-accent">{existing ? 'Сохранить' : 'Добавить'}</button>
        </div>
      </form>
    </div>
  );
}
