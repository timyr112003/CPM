'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { fmtMoney, fmtDateRu, parseDate } from '@/lib/ep-utils';
import { LessonAttendance } from '@/lib/ep-types';
import { getActiveSubscription, todayStr } from '@/lib/ep-subscriptions';

export function EpAttendanceModal() {
  const editingId = useAppStore(s => s.editingId);
  const schedule = useAppStore(s => s.schedule);
  const students = useAppStore(s => s.students);
  const closeModal = useAppStore(s => s.closeModal);
  const completeLessonWithAttendance = useAppStore(s => s.completeLessonWithAttendance);
  const addToast = useAppStore(s => s.addToast);

  const lesson = schedule.find(l => l.id === editingId);
  const lessonStudents = lesson ? students.filter(s => lesson.studentIds.includes(s.id)) : [];
  const halfPrice = lesson ? Math.round(lesson.price * 0.5) : 0;

  // Initialize: all present by default
  const [attendance, setAttendance] = useState<LessonAttendance[]>(
    lessonStudents.map(s => ({ studentId: s.id, present: true, penaltyAmount: 0 }))
  );

  if (!lesson) return null;

  const togglePresent = (studentId: string) => {
    setAttendance(prev => prev.map(a =>
      a.studentId === studentId
        ? { ...a, present: !a.present, penaltyAmount: a.present ? 0 : a.penaltyAmount }
        : a
    ));
  };

  const setPenalty = (studentId: string, amount: number) => {
    setAttendance(prev => prev.map(a =>
      a.studentId === studentId ? { ...a, penaltyAmount: amount } : a
    ));
  };

  const presentCount = attendance.filter(a => a.present).length;
  const absentCount = attendance.filter(a => !a.present).length;
  // Сколько присутствующих спишется по абонементу (а не с баланса)
  const subPaidCount = attendance.filter(a =>
    a.present && !!getActiveSubscription(useAppStore.getState().subscriptions, a.studentId, todayStr())
  ).length;
  const totalIncome = lesson.price * (presentCount - subPaidCount);
  const totalPenalty = attendance.reduce((sum, a) => sum + a.penaltyAmount, 0);

  const handleSubmit = () => {
    if (presentCount === 0) {
      addToast('Отметьте хотя бы одного присутствующего', 'error');
      return;
    }
    completeLessonWithAttendance(lesson.id, attendance);
    closeModal();
  };

  const lessonDate = fmtDateRu(parseDate(lesson.date));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}
        >
          <i className="fa-solid fa-clipboard-user text-lg" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold">Посещаемость</h3>
          <p className="text-xs ep-muted truncate">
            {lesson.student} &middot; {lessonDate} &middot; {lesson.time}
          </p>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2.5 rounded-lg" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)' }}>
          <div className="text-base font-bold" style={{ color: '#4ade80' }}>{presentCount}</div>
          <div className="text-xs ep-muted">Присутствуют</div>
        </div>
        <div className="text-center p-2.5 rounded-lg" style={{ background: absentCount > 0 ? 'rgba(255,92,92,0.06)' : 'var(--ep-bg-secondary)', border: absentCount > 0 ? '1px solid rgba(255,92,92,0.12)' : '1px solid transparent' }}>
          <div className="text-base font-bold" style={{ color: absentCount > 0 ? 'var(--ep-danger)' : 'var(--ep-muted)' }}>{absentCount}</div>
          <div className="text-xs ep-muted">Отсутствуют</div>
        </div>
        <div className="text-center p-2.5 rounded-lg" style={{ background: 'rgba(0,229,160,0.06)', border: '1px solid rgba(0,229,160,0.12)' }}>
          <div className="text-base font-bold" style={{ color: 'var(--ep-accent)' }}>{fmtMoney(totalIncome + totalPenalty)}</div>
          <div className="text-xs ep-muted">Итого к оплате</div>
        </div>
      </div>

      {subPaidCount > 0 && (
        <div
          className="text-xs p-2.5 rounded-lg flex items-center gap-2"
          style={{ background: 'rgba(0,229,160,0.05)', border: '1px solid rgba(0,229,160,0.12)', color: 'var(--ep-text-secondary)' }}
        >
          <i className="fa-solid fa-ticket" style={{ color: 'var(--ep-accent)' }} />
          <span>
            По абонементу спишется: <b style={{ color: 'var(--ep-accent)' }}>{subPaidCount}</b>{' '}
            {subPaidCount === 1 ? 'ученик' : 'учеников'} — с баланса эти ученики списываться не будут
          </span>
        </div>
      )}

      {/* Student list */}
      <div className="space-y-2">
        {lessonStudents.map(student => {
          const entry = attendance.find(a => a.studentId === student.id);
          if (!entry) return null;
          const isPresent = entry.present;
          const studentBal = student.balance || 0;
          const initials = student.name.split(' ').map(n => n[0] || '').join('').slice(0, 2);

          return (
            <div
              key={student.id}
              className="rounded-xl overflow-hidden transition-all"
              style={{
                border: `1px solid ${isPresent ? 'rgba(0,229,160,0.15)' : 'rgba(255,92,92,0.15)'}`,
              }}
            >
              {/* Main row */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer transition-all"
                style={{ background: isPresent ? 'rgba(0,229,160,0.04)' : 'rgba(255,92,92,0.04)' }}
                onClick={() => togglePresent(student.id)}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: isPresent ? 'rgba(0,229,160,0.12)' : 'rgba(255,92,92,0.12)',
                      color: isPresent ? 'var(--ep-accent)' : 'var(--ep-danger)',
                    }}
                  >
                    {initials}
                  </div>
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{
                      background: isPresent ? 'var(--ep-accent)' : 'var(--ep-danger)',
                      border: '2px solid var(--ep-card-bg, #0d1117)',
                    }}
                  >
                    <i className={`fa-solid ${isPresent ? 'fa-check' : 'fa-xmark'}`} style={{ fontSize: 7, color: isPresent ? '#080b12' : '#fff' }} />
                  </div>
                </div>

                {/* Name + balance */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{student.name}</div>
                  <div className="text-xs ep-muted">
                    Баланс: <span style={{ color: studentBal >= 0 ? 'var(--ep-accent)' : 'var(--ep-danger)' }}>
                      {studentBal >= 0 ? '+' : ''}{fmtMoney(studentBal)}
                    </span>
                  </div>
                </div>

                {/* Amount */}
                {isPresent ? (
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs font-bold" style={{ color: 'var(--ep-accent)' }}>-{fmtMoney(lesson.price)}</div>
                    <div className="text-xs ep-muted">оплата</div>
                  </div>
                ) : entry.penaltyAmount > 0 ? (
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs font-bold" style={{ color: 'var(--ep-danger)' }}>-{fmtMoney(entry.penaltyAmount)}</div>
                    <div className="text-xs ep-muted">штраф</div>
                  </div>
                ) : (
                  <div className="flex-shrink-0">
                    <div className="text-xs font-semibold ep-muted">Не оплатил</div>
                  </div>
                )}
              </div>

              {/* Penalty section for absent students */}
              {!isPresent && (
                <div
                  className="px-3 pb-3 pt-1"
                  style={{ background: 'rgba(255,92,92,0.02)' }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="text-xs font-semibold ep-muted mb-2">Штраф за отсутствие:</div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setPenalty(student.id, 0)}
                      className="py-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: entry.penaltyAmount === 0 ? 'rgba(128,128,128,0.15)' : 'var(--ep-bg-secondary)',
                        color: entry.penaltyAmount === 0 ? 'var(--ep-text)' : 'var(--ep-muted)',
                        border: entry.penaltyAmount === 0 ? '1px solid rgba(128,128,128,0.3)' : '1px solid transparent',
                      }}
                    >
                      Без штрафа
                    </button>
                    <button
                      type="button"
                      onClick={() => setPenalty(student.id, halfPrice)}
                      className="py-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: entry.penaltyAmount === halfPrice ? 'rgba(255,92,92,0.15)' : 'var(--ep-bg-secondary)',
                        color: entry.penaltyAmount === halfPrice ? 'var(--ep-danger)' : 'var(--ep-muted)',
                        border: entry.penaltyAmount === halfPrice ? '1px solid rgba(255,92,92,0.3)' : '1px solid transparent',
                      }}
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setPenalty(student.id, lesson.price)}
                      className="py-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: entry.penaltyAmount === lesson.price ? 'rgba(255,92,92,0.15)' : 'var(--ep-bg-secondary)',
                        color: entry.penaltyAmount === lesson.price ? 'var(--ep-danger)' : 'var(--ep-muted)',
                        border: entry.penaltyAmount === lesson.price ? '1px solid rgba(255,92,92,0.3)' : '1px solid transparent',
                      }}
                    >
                      100%
                    </button>
                    <div className="relative">
                      <input
                        type="number"
                        className="ep-input text-xs py-1.5 pr-7"
                        style={{ width: 100 }}
                        value={entry.penaltyAmount > 0 && entry.penaltyAmount !== halfPrice && entry.penaltyAmount !== lesson.price ? entry.penaltyAmount : ''}
                        onChange={e => setPenalty(student.id, Math.max(0, Number(e.target.value) || 0))}
                        placeholder="Своё"
                        min={0}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs ep-muted">₽</span>
                    </div>
                  </div>
                  {entry.penaltyAmount > 0 && (
                    <div className="text-xs mt-1.5" style={{ color: 'var(--ep-danger)' }}>
                      <i className="fa-solid fa-triangle-exclamation mr-1" />
                      Баланс после штрафа: {fmtMoney(studentBal - entry.penaltyAmount)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Buttons */}
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={closeModal} className="ep-btn-ghost">Отмена</button>
        <button type="button" onClick={handleSubmit} className="ep-btn-accent">
          <i className="fa-solid fa-check mr-1" />Провести урок
        </button>
      </div>
    </div>
  );
}
