'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { fmtMoney } from '@/lib/ep-utils';

export function EpClassModal() {
  const editingId = useAppStore(s => s.editingId);
  const classes = useAppStore(s => s.classes);
  const students = useAppStore(s => s.students);
  const activeStudents = students.filter(s => !s.archived);
  const addClass = useAppStore(s => s.addClass);
  const updateClass = useAppStore(s => s.updateClass);
  const closeModal = useAppStore(s => s.closeModal);
  const addToast = useAppStore(s => s.addToast);

  const existing = editingId ? classes.find(c => c.id === editingId) : null;

  const [name, setName] = useState(existing?.name || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [selectedIds, setSelectedIds] = useState<string[]>(existing?.studentIds || []);
  const [priceStr, setPriceStr] = useState(String(existing?.pricePerLesson || 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name, description, studentIds: selectedIds, pricePerLesson: Number(priceStr) || 0 };
    if (editingId) {
      updateClass(editingId, data);
      addToast('Класс обновлён', 'success');
    } else {
      addClass(data);
      addToast('Класс создан', 'success');
    }
    closeModal();
  };

  const toggleStudent = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}
        >
          <i className="fa-solid fa-layer-group text-lg" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold">{existing ? 'Редактировать класс' : 'Новый класс'}</h3>
          <p className="text-xs ep-muted">{existing ? 'Измените параметры класса' : 'Создайте новую учебную группу'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: '#888' }}>
            <i className="fa-solid fa-heading mr-1" style={{ fontSize: 10 }} />
            Название класса
          </label>
          <input
            type="text"
            className="ep-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Например: IELTS-Группа 1"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: '#888' }}>
            <i className="fa-solid fa-align-left mr-1" style={{ fontSize: 10 }} />
            Описание
          </label>
          <textarea
            className="ep-input"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Направление, уровень, расписание..."
            rows={2}
            style={{ resize: 'none' }}
          />
        </div>

        {/* Price */}
        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: '#888' }}>
            <i className="fa-solid fa-coins mr-1" style={{ fontSize: 10 }} />
            Стоимость занятия
          </label>
          <div className="relative">
            <input
              type="number"
              className="ep-input"
              value={priceStr}
              onChange={e => setPriceStr(e.target.value)}
              min={0}
              placeholder="0"
              style={{ paddingRight: 40 }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs ep-muted font-semibold">₽</span>
          </div>
          <div className="text-xs ep-muted mt-1.5" style={{ color: '#888' }}>
            Стоимость по умолчанию при создании группового урока для этого класса
          </div>
        </div>

        {/* Student selection */}
        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: '#888' }}>
            <i className="fa-solid fa-users mr-1" style={{ fontSize: 10 }} />
            Ученики в классе
            {selectedIds.length > 0 && (
              <span
                className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}
              >
                {selectedIds.length}
              </span>
            )}
          </label>
          <div
            className="rounded-xl overflow-hidden"
            style={{
              maxHeight: 160,
              overflowY: 'auto',
              border: '1.5px solid var(--ep-border)',
              background: 'var(--ep-bg-secondary)',
            }}
          >
            {activeStudents.length === 0 ? (
              <div className="p-4 text-center">
                <i className="fa-solid fa-user-plus text-lg mb-1 ep-muted" />
                <div className="text-xs ep-muted">Сначала добавьте учеников</div>
              </div>
            ) : (
              activeStudents.map((s, idx) => {
                const isSelected = selectedIds.includes(s.id);
                const initials = s.name.split(' ').map(n => n[0] || '').join('').slice(0, 2);
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all"
                    style={{
                      background: isSelected ? 'rgba(167,139,250,0.06)' : 'transparent',
                      borderBottom: idx < activeStudents.length - 1 ? '1px solid var(--ep-border)' : 'none',
                    }}
                    onClick={() => toggleStudent(s.id)}
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        background: isSelected ? '#a78bfa' : 'transparent',
                        border: isSelected ? '1.5px solid #a78bfa' : '1.5px solid var(--ep-border)',
                      }}
                    >
                      {isSelected && <i className="fa-solid fa-check" style={{ fontSize: 9, color: '#fff' }} />}
                    </div>
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                      style={{
                        background: isSelected ? 'rgba(167,139,250,0.15)' : 'var(--ep-bg-base)',
                        color: isSelected ? '#a78bfa' : 'var(--ep-muted)',
                      }}
                    >
                      {initials}
                    </div>
                    <span className="text-sm flex-1" style={{ color: isSelected ? 'var(--ep-text)' : 'var(--ep-muted)' }}>
                      {s.name}
                    </span>
                    <span className="text-xs ep-muted flex-shrink-0">{fmtMoney(s.rate)}/ч</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={closeModal} className="ep-btn-ghost">
            Отмена
          </button>
          <button type="submit" className="ep-btn-accent">
            <i className={`fa-solid ${existing ? 'fa-check' : 'fa-plus'} mr-1`} />
            {existing ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  );
}
