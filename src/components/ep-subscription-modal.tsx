'use client';

import { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { Subscription, SubscriptionStatus } from '@/lib/ep-types';
import {
  getSubStatus, getDisplaySubscription, sortSubsForList,
  subLessonsLeft, subScaleColor, findOverlappingSubscription,
  fmtDateDMY, todayStr, SUB_STATUS_LABELS,
} from '@/lib/ep-subscriptions';
import { fmtMoney, fmtDate } from '@/lib/ep-utils';

const SUB_STATUS_STYLE: Record<SubscriptionStatus, { color: string; bg: string; border: string; icon: string }> = {
  active: { color: '#00e5a0', bg: 'rgba(0,229,160,0.1)', border: 'rgba(0,229,160,0.25)', icon: 'fa-circle-check' },
  scheduled: { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)', icon: 'fa-clock' },
  frozen: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)', icon: 'fa-snowflake' },
  invalid: { color: '#ff5c5c', bg: 'rgba(255,92,92,0.1)', border: 'rgba(255,92,92,0.25)', icon: 'fa-ban' },
  archived: { color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.25)', icon: 'fa-box-archive' },
};

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const st = SUB_STATUS_STYLE[status];
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
      style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, fontSize: '10px' }}
    >
      <i className={`fa-solid ${st.icon} mr-1`} />{SUB_STATUS_LABELS[status]}
    </span>
  );
}

/* ═══════════ ФОРМА СОЗДАНИЯ / РЕДАКТИРОВАНИЯ ═══════════ */
function SubForm({
  studentId, editSub, onDone,
}: {
  studentId: string;
  editSub?: Subscription | null;
  onDone: () => void;
}) {
  const students = useAppStore(s => s.students);
  const allSubscriptions = useAppStore(s => s.subscriptions);
  const addSubscription = useAppStore(s => s.addSubscription);
  const updateSubscription = useAppStore(s => s.updateSubscription);
  const closeModal = useAppStore(s => s.closeModal);

  const student = students.find(s => s.id === studentId);
  const isEdit = !!editSub;
  const today = todayStr();

  const defaultStart = today;
  const defaultEnd = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return fmtDate(d);
  })();

  const [lessons, setLessons] = useState<string>(editSub ? String(editSub.totalLessons) : '8');
  const [startDate, setStartDate] = useState(editSub?.startDate || defaultStart);
  const [endDate, setEndDate] = useState(editSub?.endDate || defaultEnd);
  const [price, setPrice] = useState<string>(
    editSub ? String(editSub.price) : String((student?.rate || 0) * 8)
  );
  const [error, setError] = useState('');

  const numLessons = Math.floor(Number(lessons) || 0);
  const numPrice = Math.round(Number(price) || 0);
  const balance = student?.balance || 0;

  const isFuture = !isEdit && startDate > today;
  const datesValid = !!startDate && !!endDate && endDate >= startDate;
  const lessonsValid = isEdit ? numLessons >= (editSub?.usedLessons || 0) && numLessons >= 1 : numLessons >= 1;

  // Запрет пересечения активных абонементов: у ученика не может быть двух
  // одновременно действующих абонементов. Проверяется именно пересечение периодов.
  const overlap = datesValid
    ? findOverlappingSubscription(allSubscriptions, studentId, startDate, endDate, editSub?.id)
    : null;
  const overlapMessage = overlap
    ? `Невозможно ${isEdit ? 'изменить' : 'создать'} абонемент: новый период пересекается с текущим активным абонементом (${fmtDateDMY(overlap.startDate)} — ${fmtDateDMY(overlap.endDate)}).`
    : '';

  // Покупка разрешена при любом балансе: при нехватке средств баланс уйдёт в минус
  const willGoNegative = !isEdit && balance - numPrice < 0;
  const canSubmit = datesValid && lessonsValid && numPrice > 0 && !overlap;

  const handleStartDateChange = (v: string) => {
    setStartDate(v);
    // Сдвигаем дату окончания, чтобы сохранить длительность 30 дней
    if (v && !editSub) {
      const d = new Date(+v.slice(0, 4), +v.slice(5, 7) - 1, +v.slice(8, 10));
      d.setDate(d.getDate() + 30);
      setEndDate(fmtDate(d));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isEdit && editSub) {
      const res = updateSubscription(editSub.id, {
        totalLessons: numLessons,
        startDate,
        endDate,
      });
      if (!res.ok) { setError(res.message || 'Ошибка'); return; }
      onDone();
    } else {
      const res = addSubscription({
        studentId,
        totalLessons: numLessons,
        startDate,
        endDate,
        price: numPrice,
      });
      if (!res.ok) { setError(res.message || 'Ошибка'); return; }
      onDone();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <button
        type="button"
        onClick={onDone}
        className="text-xs ep-muted hover:opacity-70 flex items-center gap-1.5"
      >
        <i className="fa-solid fa-arrow-left" />
        {isEdit ? 'К списку абонементов' : 'К списку абонементов'}
      </button>

      <div>
        <label className="block text-xs font-semibold mb-2 ep-muted">
          Количество занятий
        </label>
        <div className="flex gap-2 mb-2 flex-wrap">
          {[4, 8, 12, 16].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setLessons(String(n));
                if (!isEdit && !price) setPrice(String((student?.rate || 0) * n));
              }}
              className="px-3 py-1 rounded-md text-xs font-semibold transition-all"
              style={{
                background: numLessons === n ? 'var(--ep-accent)' : 'var(--ep-bg-secondary)',
                color: numLessons === n ? '#080b12' : 'var(--ep-text-secondary)',
                border: '1px solid var(--ep-border)',
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <input
          type="number"
          className="ep-input"
          value={lessons}
          onChange={e => setLessons(e.target.value)}
          min={1}
          max={200}
          required
        />
        {isEdit && (editSub?.usedLessons || 0) > 0 && (
          <div className="text-xs mt-1 ep-muted">
            Использовано: {editSub?.usedLessons} — меньше этого количества установить нельзя
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-2 ep-muted">
            Дата начала {isFuture && <span style={{ color: '#a78bfa' }}>(будущий)</span>}
          </label>
          <input
            type="date"
            className="ep-input"
            value={startDate}
            onChange={e => handleStartDateChange(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-2 ep-muted">Дата окончания</label>
          <input
            type="date"
            className="ep-input"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            min={startDate}
            required
          />
        </div>
      </div>
      {!datesValid && (
        <div className="text-xs" style={{ color: 'var(--ep-danger)' }}>
          Дата окончания не может быть раньше даты начала
        </div>
      )}

      {/* Запрет пересечения с действующим абонементом */}
      {overlapMessage && (
        <div
          className="p-2.5 rounded-lg text-xs font-semibold"
          style={{ background: 'rgba(255,92,92,0.1)', border: '1px solid rgba(255,92,92,0.2)', color: 'var(--ep-danger)' }}
        >
          <i className="fa-solid fa-circle-exclamation mr-1" />{overlapMessage}
        </div>
      )}

      {!isEdit && (
        <div>
          <label className="block text-xs font-semibold mb-2 ep-muted">
            Стоимость (спишется с баланса)
          </label>
          <input
            type="number"
            className="ep-input"
            value={price}
            onChange={e => setPrice(e.target.value)}
            min={1}
            placeholder="0"
            required
          />
        </div>
      )}

      {/* Предпросмотр списания (только при создании) */}
      {!isEdit && (
        <div
          className="p-3 rounded-lg"
          style={{
            background: willGoNegative ? 'rgba(255,92,92,0.06)' : 'rgba(0,229,160,0.06)',
            border: `1px solid ${willGoNegative ? 'rgba(255,92,92,0.15)' : 'rgba(0,229,160,0.15)'}`,
          }}
        >
          <div className="flex justify-between items-center text-sm">
            <span className="ep-muted">Текущий баланс:</span>
            <span className="font-semibold" style={{ color: balance < 0 ? 'var(--ep-danger)' : undefined }}>{fmtMoney(balance)}</span>
          </div>
          <div className="flex justify-between items-center text-sm mt-1">
            <span className="ep-muted">Стоимость абонемента:</span>
            <span className="font-semibold" style={{ color: 'var(--ep-danger)' }}>
              −{fmtMoney(numPrice)}
            </span>
          </div>
          <div className="border-t my-2" style={{ borderColor: 'var(--ep-border)' }} />
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold">После списания:</span>
            <span
              className="text-lg font-bold"
              style={{ color: balance - numPrice >= 0 ? 'var(--ep-accent)' : 'var(--ep-danger)' }}
            >
              {fmtMoney(balance - numPrice)}
            </span>
          </div>
          {willGoNegative && (
            <div className="text-xs mt-2 font-semibold" style={{ color: 'var(--ep-danger)' }}>
              <i className="fa-solid fa-triangle-exclamation mr-1" />
              Средств недостаточно: баланс станет отрицательным. Покупка доступна — долг будет числиться на балансе ученика.
            </div>
          )}
        </div>
      )}

      {isEdit && editSub && (
        <div className="p-3 rounded-lg" style={{ background: 'var(--ep-bg-secondary)' }}>
          <div className="flex justify-between items-center text-sm">
            <span className="ep-muted">Стоимость (не изменяется):</span>
            <span className="font-semibold">{fmtMoney(editSub.price)}</span>
          </div>
          <div className="flex justify-between items-center text-sm mt-1">
            <span className="ep-muted">Использовано занятий:</span>
            <span className="font-semibold">{editSub.usedLessons} из {editSub.totalLessons}</span>
          </div>
        </div>
      )}

      {error && (
        <div
          className="p-2.5 rounded-lg text-xs font-semibold"
          style={{ background: 'rgba(255,92,92,0.1)', border: '1px solid rgba(255,92,92,0.2)', color: 'var(--ep-danger)' }}
        >
          <i className="fa-solid fa-circle-exclamation mr-1" />{error}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-1">
        <button type="button" onClick={closeModal} className="ep-btn-ghost">Закрыть</button>
        <button
          type="submit"
          className="ep-btn-accent"
          style={!canSubmit ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          disabled={!canSubmit}
        >
          <i className={`fa-solid ${isEdit ? 'fa-check' : 'fa-ticket'} mr-1.5`} />
          {isEdit ? 'Сохранить' : isFuture ? 'Создать будущий' : 'Создать и списать'}
        </button>
      </div>
    </form>
  );
}

/* ═══════════ ЭЛЕМЕНТ СПИСКА ═══════════ */
function SubListItem({ sub, onEdit }: { sub: Subscription; onEdit: (s: Subscription) => void }) {
  const toggleFreezeSubscription = useAppStore(s => s.toggleFreezeSubscription);
  const archiveSubscription = useAppStore(s => s.archiveSubscription);
  const unarchiveSubscription = useAppStore(s => s.unarchiveSubscription);
  const deleteSubscription = useAppStore(s => s.deleteSubscription);
  const openConfirm = useAppStore(s => s.openConfirm);

  const today = todayStr();
  const status = getSubStatus(sub, today);
  const st = SUB_STATUS_STYLE[status];
  const left = subLessonsLeft(sub);
  const frac = sub.totalLessons > 0 ? left / sub.totalLessons : 0;

  const handleDelete = () => {
    const refund = left > 0 ? Math.round((sub.price / sub.totalLessons) * left) : 0;
    const msg = refund > 0
      ? `Удалить абонемент? Возврат на баланс ученика: ${refund.toLocaleString('ru-RU')} ₽ (за ${left} из ${sub.totalLessons} занятий).`
      : 'Удалить абонемент? Остаток занятий — 0, возврат не производится.';
    openConfirm(msg, () => deleteSubscription(sub.id), {
      confirmLabel: 'Удалить',
      confirmIcon: 'fa-trash',
      danger: true,
    });
  };

  return (
    <div
      className="p-3 rounded-lg"
      style={{ background: 'var(--ep-bg-secondary)', border: '1px solid var(--ep-border)' }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <i className="fa-solid fa-ticket text-sm flex-shrink-0" style={{ color: st.color }} />
          <span className="text-sm font-bold truncate">
            Абонемент на {sub.totalLessons} {sub.totalLessons === 1 ? 'занятие' : sub.totalLessons < 5 ? 'занятия' : 'занятий'}
          </span>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Мини-шкала */}
      <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(128,128,128,0.15)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(frac * 100, left > 0 ? 4 : 0)}%`, background: subScaleColor(sub) }}
        />
      </div>

      <div className="flex items-center justify-between text-xs flex-wrap gap-1">
        <span className="ep-muted">
          Осталось занятий: <span className="font-bold" style={{ color: subScaleColor(sub) }}>{left} из {sub.totalLessons}</span>
        </span>
        <span className="ep-muted">
          {fmtDateDMY(sub.startDate)} — {fmtDateDMY(sub.endDate)} · {fmtMoney(sub.price)}
        </span>
      </div>

      {/* Действия */}
      <div className="flex gap-1.5 mt-2.5 justify-end">
        {status === 'archived' ? (
          <>
            <button
              type="button"
              onClick={() => unarchiveSubscription(sub.id)}
              className="px-2.5 h-7 rounded-md flex items-center justify-center gap-1.5 text-xs font-semibold"
              style={{ background: 'rgba(0,229,160,0.12)', color: 'var(--ep-accent)' }}
              title="Вернуть из архива"
            >
              <i className="fa-solid fa-box-open text-xs" />
              Вернуть из архива
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'rgba(255,92,92,0.12)', color: 'var(--ep-danger)' }}
              title="Удалить"
            >
              <i className="fa-solid fa-trash text-xs" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onEdit(sub)}
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'rgba(128,128,128,0.08)', color: 'var(--ep-muted)' }}
              title="Редактировать"
            >
              <i className="fa-solid fa-pen text-xs" />
            </button>
            <button
              type="button"
              onClick={() => toggleFreezeSubscription(sub.id)}
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{
                background: sub.frozen ? 'rgba(96,165,250,0.15)' : 'rgba(128,128,128,0.08)',
                color: sub.frozen ? '#60a5fa' : 'var(--ep-muted)',
              }}
              title={sub.frozen ? 'Разморозить' : 'Заморозить'}
            >
              <i className="fa-solid fa-snowflake text-xs" />
            </button>
            {status === 'invalid' && (
              <button
                type="button"
                onClick={() => archiveSubscription(sub.id)}
                className="px-2.5 h-7 rounded-md flex items-center justify-center gap-1.5 text-xs font-semibold"
                style={{ background: 'rgba(156,163,175,0.12)', color: '#9ca3af' }}
                title="Отправить в архив — абонемент не будет участвовать в списании и пропадёт с карточки"
              >
                <i className="fa-solid fa-box-archive text-xs" />
                В архив
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'rgba(255,92,92,0.12)', color: 'var(--ep-danger)' }}
              title="Удалить"
            >
              <i className="fa-solid fa-trash text-xs" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════ ГЛАВНАЯ МОДАЛКА ═══════════ */
export function EpSubscriptionModal() {
  const editingId = useAppStore(s => s.editingId);
  const students = useAppStore(s => s.students);
  const subscriptions = useAppStore(s => s.subscriptions);
  const closeModal = useAppStore(s => s.closeModal);

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editSubId, setEditSubId] = useState<string | null>(null);

  const student = students.find(s => s.id === editingId);
  const studentSubs = useMemo(
    () => subscriptions.filter(s => s.studentId === editingId),
    [subscriptions, editingId]
  );
  const today = todayStr();
  const sorted = useMemo(
    () => sortSubsForList(studentSubs, today),
    [studentSubs, today]
  );
  const displaySub = editingId ? getDisplaySubscription(subscriptions, editingId, today) : null;
  const editSub = studentSubs.find(s => s.id === editSubId) || null;

  if (!student) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,229,160,0.1)', color: 'var(--ep-accent)' }}
          >
            <i className="fa-solid fa-ticket text-lg" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold">Абонементы</h3>
            <p className="text-xs ep-muted truncate">{student.name}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs ep-muted">Баланс</div>
          <div
            className="text-lg font-bold"
            style={{ color: (student.balance || 0) >= 0 ? 'var(--ep-accent)' : 'var(--ep-danger)' }}
          >
            {fmtMoney(student.balance || 0)}
          </div>
        </div>
      </div>

      {mode === 'list' && (
        <>
          <button className="ep-btn-accent w-full" onClick={() => { setEditSubId(null); setMode('create'); }}>
            <i className="fa-solid fa-plus mr-1.5" />
            Создать абонемент
          </button>

          {sorted.length === 0 ? (
            <div className="text-center py-8">
              <i className="fa-solid fa-ticket text-4xl mb-3 ep-muted" />
              <p className="text-sm font-semibold mb-1">Абонементов пока нет</p>
              <p className="text-xs ep-muted">
                Создайте первый абонемент — стоимость спишется с баланса ученика
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {sorted.map(sub => (
                <SubListItem
                  key={sub.id}
                  sub={sub}
                  onEdit={s => { setEditSubId(s.id); setMode('edit'); }}
                />
              ))}
            </div>
          )}

          {displaySub && (
            <div className="text-xs ep-muted pt-1">
              <i className="fa-solid fa-circle-info mr-1.5" />
              На карточке ученика отображается только текущий абонемент.
              Будущие активируются автоматически при наступлении даты начала.
            </div>
          )}
        </>
      )}

      {mode === 'create' && (
        <SubForm
          studentId={student.id}
          onDone={() => setMode('list')}
        />
      )}

      {mode === 'edit' && editSub && (
        <SubForm
          studentId={student.id}
          editSub={editSub}
          onDone={() => { setEditSubId(null); setMode('list'); }}
        />
      )}
    </div>
  );
}
