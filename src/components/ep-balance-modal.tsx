'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { fmtMoney, fmtDateRu, parseDate, sortFinanceNewestFirst } from '@/lib/ep-utils';

export function EpBalanceModal() {
  const editingId = useAppStore(s => s.editingId);
  const students = useAppStore(s => s.students);
  const schedule = useAppStore(s => s.schedule);
  const finance = useAppStore(s => s.finance);
  const closeModal = useAppStore(s => s.closeModal);
  const adjustBalance = useAppStore(s => s.adjustBalance);
  const addToast = useAppStore(s => s.addToast);

  const student = students.find(s => s.id === editingId);

  const balance = student?.balance || 0;

  // Total earned: completed lessons
  const totalEarned = useMemo(() => {
    const st = students.find(s => s.id === editingId);
    if (!st) return 0;
    return schedule
      .filter(l => l.studentIds.includes(st.id) && l.status === 'completed')
      .reduce((sum, l) => sum + l.price, 0);
  }, [students, editingId, schedule]);

  // Transaction history for this student
  const transactions = useMemo(() => {
    const st = students.find(s => s.id === editingId);
    if (!st) return [];
    return sortFinanceNewestFirst(finance
      .filter(f => {
        if (f.balanceChange && f.description.includes(st.name)) return true;
        if (f.lessonId) {
          const lesson = schedule.find(l => l.id === f.lessonId);
          if (lesson && lesson.studentIds.includes(st.id)) return true;
        }
        if (f.category === 'Штраф за отмену' && f.description.includes(st.name)) return true;
        return false;
      }));
  }, [students, finance, schedule, editingId]);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'topup' | 'withdraw'>('topup');

  if (!student) return null;

  const numAmount = Number(amount) || 0;
  const finalAmount = mode === 'topup' ? numAmount : -numAmount;
  const newBalance = balance + finalAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      addToast('Введите сумму больше нуля', 'error');
      return;
    }
    adjustBalance(student.id, finalAmount, description || (mode === 'topup' ? 'Ручное пополнение' : 'Ручное списание'));
    closeModal();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Баланс ученика</h3>
        <div className="text-right">
          <div className="text-xs ep-muted">{student.name}</div>
          <div className="text-xl font-bold" style={{ color: balance >= 0 ? 'var(--ep-accent)' : 'var(--ep-danger)' }}>
            {balance >= 0 ? '+' : ''}{fmtMoney(balance)}
          </div>
        </div>
      </div>

      {/* Earned block */}
      <div className="p-3 rounded-lg" style={{
        background: 'rgba(0,229,160,0.06)',
        border: '1px solid rgba(0,229,160,0.15)',
      }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-coins text-sm" style={{ color: 'var(--ep-accent)' }} />
            <span className="text-xs font-semibold ep-muted">Заработано</span>
          </div>
          <span className="text-sm font-bold ep-accent-color">{fmtMoney(totalEarned)}</span>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-lg" style={{ background: 'var(--ep-bg-secondary)' }}>
        <button
          type="button"
          onClick={() => setMode('topup')}
          className="py-2 px-3 rounded-md text-sm font-semibold transition-all"
          style={{
            background: mode === 'topup' ? 'var(--ep-accent)' : 'transparent',
            color: mode === 'topup' ? '#fff' : 'var(--ep-muted)',
          }}
        >
          <i className="fa-solid fa-plus mr-1" />Пополнить
        </button>
        <button
          type="button"
          onClick={() => setMode('withdraw')}
          className="py-2 px-3 rounded-md text-sm font-semibold transition-all"
          style={{
            background: mode === 'withdraw' ? 'var(--ep-danger)' : 'transparent',
            color: mode === 'withdraw' ? '#fff' : 'var(--ep-muted)',
          }}
        >
          <i className="fa-solid fa-minus mr-1" />Списать
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amount */}
        <div>
          <label className="block text-xs font-semibold mb-2 ep-muted">Сумма (₽)</label>
          <input
            type="number"
            className="ep-input text-lg font-bold"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min={1}
            placeholder="0"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold mb-2 ep-muted">Комментарий</label>
          <input
            type="text"
            className="ep-input"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Причина пополнения или списания..."
          />
        </div>

        {/* Preview */}
        {numAmount > 0 && (
          <div className="p-3 rounded-lg" style={{
            background: newBalance >= 0 ? 'rgba(0,229,160,0.06)' : 'rgba(255,92,92,0.06)',
            border: `1px solid ${newBalance >= 0 ? 'rgba(0,229,160,0.15)' : 'rgba(255,92,92,0.15)'}`,
          }}>
            <div className="flex justify-between items-center text-sm">
              <span className="ep-muted">Текущий баланс:</span>
              <span className="font-semibold">{fmtMoney(balance)}</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="ep-muted">{mode === 'topup' ? 'Пополнение' : 'Списание'}:</span>
              <span className="font-semibold" style={{ color: mode === 'topup' ? 'var(--ep-accent)' : 'var(--ep-danger)' }}>
                {mode === 'topup' ? '+' : '-'}{fmtMoney(numAmount)}
              </span>
            </div>
            <div className="border-t my-2" style={{ borderColor: 'var(--ep-border)' }} />
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">Новый баланс:</span>
              <span className="text-lg font-bold" style={{ color: newBalance >= 0 ? 'var(--ep-accent)' : 'var(--ep-danger)' }}>
                {newBalance >= 0 ? '+' : ''}{fmtMoney(newBalance)}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={closeModal} className="ep-btn-ghost">Отмена</button>
          <button
            type="submit"
            className="ep-btn-accent"
            style={mode === 'withdraw' ? { background: 'var(--ep-danger)' } : {}}
          >
            <i className={`fa-solid ${mode === 'topup' ? 'fa-plus' : 'fa-minus'} mr-1`} />
            {mode === 'topup' ? 'Пополнить' : 'Списать'}
          </button>
        </div>
      </form>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div>
          <div className="border-t pt-4 mt-2" style={{ borderColor: 'var(--ep-border)' }} />
          <div className="flex items-center gap-2 mb-3">
            <i className="fa-solid fa-receipt text-sm ep-muted" />
            <span className="text-sm font-bold">История операций</span>
            <span className="text-xs ep-muted">({transactions.length})</span>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {transactions.map(f => {
              const isIncome = f.type === 'income';
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-2.5 rounded-lg"
                  style={{ background: 'var(--ep-bg-secondary)' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: isIncome ? 'rgba(0,229,160,0.1)' : 'rgba(255,92,92,0.1)' }}
                    >
                      <i
                        className={`fa-solid ${isIncome ? 'fa-arrow-down' : 'fa-arrow-up'}`}
                        style={{ color: isIncome ? 'var(--ep-accent)' : 'var(--ep-danger)', fontSize: 10 }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{f.category}</div>
                      <div className="text-xs ep-muted truncate">{f.description}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <div
                      className="text-xs font-bold"
                      style={{ color: isIncome ? 'var(--ep-accent)' : 'var(--ep-danger)' }}
                    >
                      {isIncome ? '+' : '-'}{fmtMoney(f.amount)}
                    </div>
                    <div className="text-xs ep-muted">{fmtDateRu(parseDate(f.date))}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
