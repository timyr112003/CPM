'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { fmtMoney } from '@/lib/ep-utils';
import { getActiveSubscription, todayStr } from '@/lib/ep-subscriptions';

/**
 * Окно ручного списания с баланса при проведении занятия.
 * Открывается по кнопке «Списать с баланса» из карточки урока.
 * Сумма по умолчанию — стандартная стоимость занятия, её можно изменить.
 * При подтверждении урок проводится, оплата списывается с баланса,
 * абонемент (даже активный) не затрагивается — двойного списания нет.
 */
export function EpBalanceChargeModal() {
  const editingId = useAppStore(s => s.editingId);
  const schedule = useAppStore(s => s.schedule);
  const students = useAppStore(s => s.students);
  const subscriptions = useAppStore(s => s.subscriptions);
  const closeModal = useAppStore(s => s.closeModal);
  const changeLessonStatus = useAppStore(s => s.changeLessonStatus);

  const lesson = editingId ? schedule.find(l => l.id === editingId) : null;
  const student = lesson?.studentId ? students.find(s => s.id === lesson.studentId) : null;

  // Сумма по умолчанию — стандартная стоимость занятия
  const [amount, setAmount] = useState<string>(lesson ? String(lesson.price) : '');

  if (!lesson || !student) return null;

  const numAmount = Math.round(Number(amount) || 0);
  const balance = student.balance || 0;
  const balanceAfter = balance - numAmount;
  const willBeNegative = balanceAfter < 0;
  const hasActiveSub = !!getActiveSubscription(subscriptions, student.id, todayStr());
  const valid = numAmount > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    changeLessonStatus(lesson.id, 'completed', { manualChargeAmount: numAmount });
    closeModal();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(0,229,160,0.1)', color: 'var(--ep-accent)' }}
        >
          <i className="fa-solid fa-wallet text-lg" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold">Списать с баланса</h3>
          <p className="text-xs ep-muted truncate">
            {lesson.student} &middot; {lesson.topic} &middot; {fmtMoney(lesson.price)}
          </p>
        </div>
      </div>

      {/* Сумма списания */}
      <div>
        <label className="block text-xs font-semibold mb-2 ep-muted">
          Сумма списания (₽)
        </label>
        <input
          type="number"
          className="ep-input"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          min={1}
          step={1}
          placeholder={String(lesson.price)}
          required
          autoFocus
        />
        <div className="text-xs mt-1.5 ep-muted">
          По умолчанию — стандартная стоимость занятия. Сумму можно изменить вручную.
        </div>
      </div>

      {/* Итог по балансу */}
      <div
        className="p-3 rounded-lg"
        style={{
          background: willBeNegative ? 'rgba(255,92,92,0.06)' : 'rgba(0,229,160,0.06)',
          border: `1px solid ${willBeNegative ? 'rgba(255,92,92,0.15)' : 'rgba(0,229,160,0.15)'}`,
        }}
      >
        <div className="flex justify-between items-center text-sm">
          <span className="ep-muted">Текущий баланс:</span>
          <span className="font-semibold" style={{ color: balance < 0 ? 'var(--ep-danger)' : undefined }}>
            {fmtMoney(balance)}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm mt-1">
          <span className="ep-muted">Списание:</span>
          <span className="font-semibold" style={{ color: 'var(--ep-danger)' }}>
            −{fmtMoney(numAmount)}
          </span>
        </div>
        <div className="border-t my-2" style={{ borderColor: 'var(--ep-border)' }} />
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold">Баланс после списания:</span>
          <span
            className="text-lg font-bold"
            style={{ color: willBeNegative ? 'var(--ep-danger)' : 'var(--ep-accent)' }}
          >
            {fmtMoney(balanceAfter)}
          </span>
        </div>
        {willBeNegative && (
          <div className="text-xs mt-2 font-semibold" style={{ color: 'var(--ep-danger)' }}>
            <i className="fa-solid fa-triangle-exclamation mr-1" />
            После списания баланс станет отрицательным
          </div>
        )}
      </div>

      {/* Подсказка про абонемент */}
      {hasActiveSub && (
        <div
          className="text-xs p-2.5 rounded-lg flex items-start gap-2"
          style={{ background: 'rgba(0,229,160,0.05)', border: '1px solid rgba(0,229,160,0.12)', color: 'var(--ep-text-secondary)' }}
        >
          <i className="fa-solid fa-ticket mt-0.5" style={{ color: 'var(--ep-accent)' }} />
          <span>
            У ученика есть активный абонемент. При ручном списании оплата спишется с баланса, а занятие абонемента <b>не будет</b> израсходовано.
          </span>
        </div>
      )}

      {/* Кнопки */}
      <div className="flex gap-3 justify-end pt-1">
        <button type="button" onClick={closeModal} className="ep-btn-ghost">Назад</button>
        <button
          type="submit"
          className="ep-btn-accent"
          style={!valid ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          disabled={!valid}
        >
          <i className="fa-solid fa-wallet mr-1.5" />
          Списать и провести
        </button>
      </div>
    </form>
  );
}
