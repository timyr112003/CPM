'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, TRANSFER_FINANCE_CATEGORIES } from '@/lib/ep-types';
import { fmtDate } from '@/lib/ep-utils';

export function EpFinanceModal() {
  const editingId = useAppStore(s => s.editingId);
  const finance = useAppStore(s => s.finance);
  const addFinance = useAppStore(s => s.addFinance);
  const updateFinance = useAppStore(s => s.updateFinance);
  const closeModal = useAppStore(s => s.closeModal);
  const addToast = useAppStore(s => s.addToast);

  const existing = editingId ? finance.find(f => f.id === editingId) : null;

  const [type, setType] = useState<'income' | 'expense'>(existing?.type || 'income');
  const [date, setDate] = useState(existing?.date || fmtDate(new Date()));
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [category, setCategory] = useState(existing?.category || INCOME_CATEGORIES[0]);
  const [description, setDescription] = useState(existing?.description || '');

  // Служебная категория перевода (покупка/возврат абонемента) доступна в списке,
  // только если редактируется существующая операция с ней
  const cats = type === 'income'
    ? (existing && TRANSFER_FINANCE_CATEGORIES.includes(existing.category) && existing.type === 'income' && !INCOME_CATEGORIES.includes(existing.category) ? [...INCOME_CATEGORIES, existing.category] : INCOME_CATEGORIES)
    : (existing && TRANSFER_FINANCE_CATEGORIES.includes(existing.category) && existing.type === 'expense' && !EXPENSE_CATEGORIES.includes(existing.category) ? [...EXPENSE_CATEGORIES, existing.category] : EXPENSE_CATEGORIES);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      addToast('Введите сумму больше 0', 'error');
      return;
    }
    const payload = {
      date,
      type,
      category,
      amount: amountNum,
      description: description || category,
    };
    if (existing) {
      // Сохраняем служебные поля, если они есть
      updateFinance(existing.id, {
        ...payload,
        lessonId: existing.lessonId,
        balanceChange: existing.balanceChange,
      });
      addToast('Операция обновлена', 'success');
    } else {
      addFinance(payload);
      addToast('Операция добавлена', 'success');
    }
    closeModal();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">{existing ? 'Редактировать операцию' : 'Новая операция'}</h3>
      {existing?.lessonId && (
        <div className="p-3 rounded-lg text-xs flex items-center gap-2" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: 'var(--ep-warning)' }}>
          <i className="fa-solid fa-triangle-exclamation" />
          <span>Эта операция связана с уроком. Изменения могут нарушить связь.</span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-2 ep-muted">Тип</label>
          <select
            className="ep-input"
            value={type}
            onChange={e => {
              setType(e.target.value as 'income' | 'expense');
              setCategory(e.target.value === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
            }}
          >
            <option value="income">Доход</option>
            <option value="expense">Расход</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Дата</label>
            <input type="date" className="ep-input" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Сумма (₽)</label>
            <input type="number" className="ep-input" value={amount} onChange={e => setAmount(e.target.value)} min={1} placeholder="0" required />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-2 ep-muted">Категория</label>
          <select className="ep-input" value={category} onChange={e => setCategory(e.target.value)}>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-2 ep-muted">Описание</label>
          <input type="text" className="ep-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Комментарий" />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={closeModal} className="ep-btn-ghost">Отмена</button>
          <button type="submit" className="ep-btn-accent">{existing ? 'Сохранить' : 'Добавить'}</button>
        </div>
      </form>
    </div>
  );
}
