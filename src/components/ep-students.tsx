'use client';

import { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { fmtMoney } from '@/lib/ep-utils';
import { isBirthdayToday } from '@/lib/ep-utils';
import { StudentSocials, StudentNotifySettings } from '@/lib/ep-types';
import { SOCIAL_NETWORKS, shortSocialUrl } from '@/lib/ep-socials';
import {
  getDisplaySubscription, getSubStatus, SUB_STATUS_LABELS,
  subLessonsLeft, subDaysTotal, subDaysLeft, subScaleColor,
  fmtDateDMY, todayStr,
} from '@/lib/ep-subscriptions';

/* ═══════════════════ STUDENT CARD ═══════════════════ */
function StudentCard({ s, comp, plan, cancelCount, index, isArchived, selectMode, selected, onToggleSelect }: {
  s: { id: string; name: string; photo?: string; balance?: number; notes?: string; phone?: string; email?: string; rate: number; archivedAt?: string; birthDate?: string; socials?: StudentSocials; notify?: StudentNotifySettings };
  comp: number; plan: number;
  cancelCount: number;
  index: number;
  isArchived: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const openModal = useAppStore(s => s.openModal);
  const deleteStudentKeepLessons = useAppStore(s => s.deleteStudentKeepLessons);
  const addToast = useAppStore(s => s.addToast);
  const openConfirm = useAppStore(s => s.openConfirm);
  const archiveStudent = useAppStore(s => s.archiveStudent);
  const unarchiveStudent = useAppStore(s => s.unarchiveStudent);
  const allSubscriptions = useAppStore(s => s.subscriptions);

  const today = todayStr();
  const currentSub = getDisplaySubscription(allSubscriptions, s.id, today);
  const subStatus = currentSub ? getSubStatus(currentSub, today) : null;
  const subLeft = currentSub ? subLessonsLeft(currentSub) : 0;
  const subDaysTotalV = currentSub ? subDaysTotal(currentSub) : 0;
  const subDaysLeftV = currentSub ? subDaysLeft(currentSub, today) : 0;
  const subFrac = currentSub && currentSub.totalLessons > 0 ? subLeft / currentSub.totalLessons : 0;

  const initials = s.name.split(' ').map(n => n[0] || '').join('').slice(0, 2);
  const balance = s.balance || 0;
  const balanceColor = balance > 0 ? 'var(--ep-accent)' : balance < 0 ? 'var(--ep-danger)' : 'var(--ep-muted)';
  const hasPhoto = s.photo && s.photo.trim().length > 0;
  const hasSocials = !!s.socials && Object.values(s.socials).some(Boolean);
  const birthdayToday = !isArchived && isBirthdayToday(s.birthDate);

  const openStats = (type: 'planned' | 'completed' | 'cancelled' | 'transactions') => {
    openModal('student-stats', s.id, { statType: type });
  };

  const handleArchive = () => {
    openConfirm(`Отправить ученика «${s.name}» в архив?`, () => {
      archiveStudent(s.id);
      addToast('Ученик перемещён в архив', 'info');
    }, { confirmLabel: 'В архив', confirmIcon: 'fa-box-archive', danger: false });
  };

  const handleUnarchive = () => {
    unarchiveStudent(s.id);
    addToast('Ученик возвращён из архива', 'success');
  };

  const handleDelete = () => {
    // Удаление доступно только из архива: история уроков (проведённые/отменённые) сохраняется
    openConfirm(
      `Удалить ученика «${s.name}» навсегда? История уроков сохранится, из групп и списков он будет убран.`,
      () => {
        deleteStudentKeepLessons(s.id);
        addToast('Ученик удалён', 'info');
      },
    );
  };

  return (
    <div
      className={`card p-5 ep-fade-in ${birthdayToday ? 'ep-birthday-card' : ''}`}
      style={{
        animationDelay: (index * 0.04) + 's',
        opacity: isArchived ? 0.65 : 1,
        ...(birthdayToday ? {
          borderColor: 'rgba(255,111,174,0.55)',
          boxShadow: '0 0 0 2px rgba(255,111,174,0.25), 0 6px 30px rgba(255,111,174,0.18)',
        } : {}),
        ...(selectMode ? {
          cursor: 'pointer',
          ...(selected ? {
            borderColor: 'var(--ep-accent)',
            boxShadow: '0 0 0 2px rgba(0,229,160,0.3)',
          } : {}),
        } : {}),
      }}
      onClick={selectMode ? () => onToggleSelect(s.id) : undefined}
    >
      {/* Birthday banner */}
      {birthdayToday && (
        <div className="ep-birthday-banner mb-3 -mx-2 -mt-1 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-semibold">
          <i className="fa-solid fa-cake-candles" />
          <span>Сегодня день рождения!</span>
          <i className="fa-solid fa-gift ml-auto" />
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0 overflow-hidden">
          {hasPhoto ? (
            <img
              src={s.photo}
              alt={s.name}
              className={`w-11 h-11 rounded-full object-cover flex-shrink-0 ${birthdayToday ? 'ep-birthday-avatar' : ''}`}
            />
          ) : (
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ep-accent-dim-bg ep-accent-color"
              style={birthdayToday ? {
                background: 'linear-gradient(135deg, rgba(255,111,174,0.35), rgba(255,200,80,0.35))',
                color: '#ff6fae',
              } : undefined}
            >
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-sm flex items-center gap-2">
              {s.name}
              {isArchived && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: 'rgba(128,128,128,0.15)', color: 'var(--ep-muted)', fontSize: '10px' }}>
                  <i className="fa-solid fa-box-archive mr-0.5" />Архив
                </span>
              )}
            </div>
            <div className="text-xs ep-muted truncate" title={s.notes || 'Без заметки'}>{s.notes || 'Без заметки'}</div>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {selectMode ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleSelect(s.id); }}
              className="w-7 h-7 rounded-md flex items-center justify-center transition-all"
              style={{
                background: selected ? 'var(--ep-accent)' : 'rgba(128,128,128,0.08)',
                color: selected ? '#080b12' : 'var(--ep-muted)',
                border: selected ? '1px solid var(--ep-accent)' : '1px solid var(--ep-border)',
              }}
              title={selected ? 'Снять выделение' : 'Выбрать'}
              aria-label={selected ? `Снять выделение с ${s.name}` : `Выбрать ${s.name}`}
              aria-pressed={selected}
            >
              {selected && <i className="fa-solid fa-check text-xs" />}
            </button>
          ) : (
            <>
              {!isArchived && (
                <>
                  <button
                    onClick={() => openModal('balance', s.id)}
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ background: balance >= 0 ? 'rgba(0,229,160,0.12)' : 'rgba(255,92,92,0.12)', color: balanceColor }}
                    title="Пополнить/Списать баланс"
                  >
                    <i className="fa-solid fa-wallet text-xs" />
                  </button>
                  <button
                    onClick={() => openModal('student', s.id)}
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ background: 'rgba(128,128,128,0.08)', color: 'var(--ep-muted)' }}
                    title="Редактировать"
                  >
                    <i className="fa-solid fa-pen text-xs" />
                  </button>
                  <button
                    onClick={() => openModal('subscription', s.id)}
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{
                      background: currentSub && subStatus !== 'invalid' ? 'rgba(0,229,160,0.12)' : 'rgba(128,128,128,0.08)',
                      color: currentSub && subStatus !== 'invalid' ? 'var(--ep-accent)' : 'var(--ep-muted)',
                    }}
                    title="Абонемент"
                  >
                    <i className="fa-solid fa-ticket text-xs" />
                  </button>
                  <button
                    onClick={() => openModal('student-notify', s.id)}
                    className="w-7 h-7 rounded-md flex items-center justify-center relative"
                    style={{ background: 'rgba(128,128,128,0.08)', color: 'var(--ep-muted)' }}
                    title="Настройки"
                    aria-label={`Настройки ученика ${s.name}`}
                  >
                    <i className="fa-solid fa-gear text-xs" />
                    {/* Точка на шестерёнке — у ученика свои настройки напоминаний (не «как у всех») */}
                    {s.notify?.mode === 'custom' && (
                      <span
                        className="absolute rounded-full"
                        style={{ width: 7, height: 7, top: 2, right: 2, background: 'var(--ep-accent)', border: '1px solid var(--ep-card-bg, #fff)' }}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                  <button
                    onClick={handleArchive}
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ background: 'rgba(128,128,128,0.08)', color: 'var(--ep-muted)' }}
                    title="В архив"
                  >
                    <i className="fa-solid fa-box-archive text-xs" />
                  </button>
                </>
              )}
              {isArchived && (
                <>
                  <button
                    onClick={handleUnarchive}
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ background: 'rgba(0,229,160,0.12)', color: 'var(--ep-accent)' }}
                    title="Вернуть из архива"
                  >
                    <i className="fa-solid fa-rotate-left text-xs" />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                    style={{ background: 'rgba(255,92,92,0.12)', color: 'var(--ep-danger)' }}
                    title="Удалить"
                  >
                    <i className="fa-solid fa-trash text-xs" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Balance block */}
      <div
        className="mb-3 p-3 rounded-lg transition-all"
        style={{
          background: balance > 0 ? 'rgba(0,229,160,0.06)' : balance < 0 ? 'rgba(255,92,92,0.06)' : 'var(--ep-bg-secondary)',
          border: `1px solid ${balance > 0 ? 'rgba(0,229,160,0.15)' : balance < 0 ? 'rgba(255,92,92,0.15)' : 'var(--ep-border)'}`,
          pointerEvents: selectMode ? 'none' : 'auto',
        }}
        onClick={() => !isArchived && openModal('balance', s.id)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-wallet text-sm" style={{ color: balanceColor }} />
            <span className="text-xs font-semibold ep-muted">Баланс</span>
          </div>
          <span className="text-sm font-bold" style={{ color: balanceColor }}>
            {balance >= 0 ? '+' : ''}{fmtMoney(balance)}
          </span>
        </div>
        {balance < 0 && (
          <div className="text-xs mt-1" style={{ color: 'var(--ep-danger)' }}>
            <i className="fa-solid fa-triangle-exclamation mr-1" />Есть долг
          </div>
        )}
      </div>

      {/* Subscription block — текущий активный абонемент со шкалой */}
      {currentSub && (
        <div
          className="mb-3 p-3 rounded-lg transition-all cursor-pointer"
          style={{
            background: subStatus === 'invalid' ? 'rgba(255,92,92,0.05)' : subStatus === 'frozen' ? 'rgba(96,165,250,0.05)' : 'rgba(0,229,160,0.04)',
            border: `1px solid ${subStatus === 'invalid' ? 'rgba(255,92,92,0.18)' : subStatus === 'frozen' ? 'rgba(96,165,250,0.18)' : 'var(--ep-border)'}`,
            pointerEvents: selectMode ? 'none' : 'auto',
          }}
          onClick={() => !isArchived && openModal('subscription', s.id)}
          title="Открыть абонементы"
        >
          {/* Заголовок: «Абонемент» + статус */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <i className="fa-solid fa-ticket text-sm flex-shrink-0" style={{ color: subScaleColor(currentSub) }} />
              <span className="text-xs font-semibold ep-muted">Абонемент</span>
            </div>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
              style={{
                background: subStatus === 'invalid' ? 'rgba(255,92,92,0.12)' : subStatus === 'frozen' ? 'rgba(96,165,250,0.12)' : subStatus === 'scheduled' ? 'rgba(167,139,250,0.12)' : 'rgba(0,229,160,0.12)',
                color: subStatus === 'invalid' ? 'var(--ep-danger)' : subStatus === 'frozen' ? '#60a5fa' : subStatus === 'scheduled' ? '#a78bfa' : 'var(--ep-accent)',
                fontSize: '10px',
              }}
            >
              <i className={`fa-solid ${subStatus === 'invalid' ? 'fa-ban' : subStatus === 'frozen' ? 'fa-snowflake' : subStatus === 'scheduled' ? 'fa-clock' : 'fa-circle-check'} mr-1`} />
              {subStatus ? SUB_STATUS_LABELS[subStatus] : ''}
            </span>
          </div>

          {/* Над шкалой справа: оставшиеся дни */}
          <div className="text-right text-xs mb-1" style={{ color: 'var(--ep-text-secondary)' }}>
            <i className="fa-regular fa-calendar mr-1 ep-muted" />
            <span className="font-semibold">{subDaysLeftV} из {subDaysTotalV}</span>
            <span className="ep-muted ml-1">{subDaysLeftV === 1 ? 'день' : subDaysLeftV < 5 ? 'дня' : 'дней'}</span>
          </div>

          {/* Шкала оставшихся занятий */}
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(128,128,128,0.15)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(subFrac * 100, subLeft > 0 ? 3 : 0)}%`,
                background: subScaleColor(currentSub),
              }}
            />
          </div>

          {/* Под шкалой: слева занятия, справа период */}
          <div className="flex items-center justify-between mt-1.5 flex-wrap gap-1">
            <span className="text-xs font-bold" style={{ color: subScaleColor(currentSub) }}>
              {subLeft} из {currentSub.totalLessons}
              <span className="ep-muted font-normal ml-1">
                {subLeft === 1 ? 'занятие' : subLeft < 5 ? 'занятия' : 'занятий'}
              </span>
            </span>
            <span className="text-xs ep-muted">
              {fmtDateDMY(currentSub.startDate)} — {fmtDateDMY(currentSub.endDate)}
            </span>
          </div>
        </div>
      )}

      {/* Stats — 3 columns, clickable */}
      <div
        className="grid grid-cols-3 gap-2 mb-3"
        style={{ pointerEvents: selectMode ? 'none' : 'auto' }}
      >
        <button
          type="button"
          onClick={() => openStats('completed')}
          className="text-center p-2.5 rounded-lg ep-bg-base transition-all hover:opacity-80 cursor-pointer"
        >
          <div className="text-sm font-bold" style={{ color: '#4ade80' }}>{comp}</div>
          <div className="text-xs ep-muted">Проведено</div>
        </button>
        <button
          type="button"
          onClick={() => openStats('planned')}
          className="text-center p-2.5 rounded-lg ep-bg-base transition-all hover:opacity-80 cursor-pointer"
        >
          <div className="text-sm font-bold">{plan}</div>
          <div className="text-xs ep-muted">Планируется</div>
        </button>
        <button
          type="button"
          onClick={() => openStats('cancelled')}
          className="text-center p-2.5 rounded-lg ep-bg-base transition-all hover:opacity-80 cursor-pointer"
        >
          <div className="text-sm font-bold">{cancelCount}</div>
          <div className="text-xs ep-muted">Отмены</div>
        </button>
      </div>

      {/* Contact */}
      <div className="flex items-center gap-4 text-xs flex-wrap ep-muted">
        <span><i className="fa-solid fa-phone mr-1" />{s.phone || '—'}</span>
        <span><i className="fa-solid fa-envelope mr-1" />{s.email || '—'}</span>
      </div>

      {/* Соцсети ученика: только значки-кнопки добавленных сетей
          (добавление/редактирование — в настройках карточки ученика) */}
      {hasSocials && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap" style={{ pointerEvents: selectMode ? 'none' : 'auto' }}>
          {SOCIAL_NETWORKS.filter(n => s.socials?.[n.key]).map(n => (
            <a
              key={n.key}
              href={s.socials![n.key]!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="w-6 h-6 rounded-md flex items-center justify-center text-xs transition-transform hover:scale-110"
              style={{ background: `${n.color}22`, color: n.color }}
              title={`${n.label}: ${shortSocialUrl(s.socials![n.key]!)}`}
              aria-label={`${n.label} ученика`}
            >
              {n.iconClass ? <i className={n.iconClass} /> : <span className="font-bold" style={{ fontSize: '10px' }}>{n.badgeText}</span>}
            </a>
          ))}
        </div>
      )}
      <div className="mt-2 text-xs font-semibold ep-accent-color">{fmtMoney(s.rate)} / час</div>
    </div>
  );
}

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */
export function EpStudents() {
  const students = useAppStore(s => s.students);
  const schedule = useAppStore(s => s.schedule);
  const archiveStudent = useAppStore(s => s.archiveStudent);
  const deleteStudentKeepLessons = useAppStore(s => s.deleteStudentKeepLessons);
  const addToast = useAppStore(s => s.addToast);
  const openConfirm = useAppStore(s => s.openConfirm);

  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const studentStats = useMemo(() => {
    return students.map(s => {
      const ls = schedule.filter(l => l.studentIds.includes(s.id));
      const comp = ls.filter(l => {
        if (l.status !== 'completed') return false;
        if (l.isGroup && l.attendance) {
          const entry = l.attendance.find(a => a.studentId === s.id);
          return entry ? entry.present : true;
        }
        return true;
      }).length;
      const plan = ls.filter(l => l.status === 'planned').length;
      const cancelledLessons = ls.filter(l => l.status === 'cancelled');
      const absentLessons = ls.filter(l => {
        if (l.status !== 'completed' || !l.isGroup || !l.attendance) return false;
        const entry = l.attendance.find(a => a.studentId === s.id);
        return entry ? !entry.present : false;
      });
      return { student: s, comp, plan, cancelCount: cancelledLessons.length + absentLessons.length };
    });
  }, [students, schedule]);

  const activeStudents = studentStats.filter(st => !st.student.archived);
  const archivedStudents = studentStats.filter(st => st.student.archived);

  // Фильтрация по поиску
  const q = searchQuery.trim().toLowerCase();
  const filterFn = (st: typeof studentStats[number]) => {
    if (!q) return true;
    const s = st.student;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.notes || '').toLowerCase().includes(q)
    );
  };

  const filteredActive = activeStudents.filter(filterFn);
  const filteredArchived = archivedStudents.filter(filterFn);
  const displayedStudents = showArchived ? filteredArchived : filteredActive;

  // Bulk-select helpers
  const displayedIds = displayedStudents.map(st => st.student.id);
  const allDisplayedSelected = displayedIds.length > 0 && displayedIds.every(id => selectedIds.includes(id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (allDisplayedSelected) {
      // Снять выделение со всех отображаемых
      setSelectedIds(prev => prev.filter(id => !displayedIds.includes(id)));
    } else {
      // Выбрать все отображаемые (с сохранением ранее выбранных из других вкладок)
      setSelectedIds(prev => Array.from(new Set([...prev, ...displayedIds])));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds([]);
  };

  const switchTab = (val: boolean) => {
    setShowArchived(val);
    setSelectedIds([]);
  };

  const handleBulkArchive = () => {
    const count = selectedIds.length;
    const word = count === 1 ? 'ученика' : 'учеников';
    openConfirm(`Архивировать ${count} ${word}?`, () => {
      selectedIds.forEach(id => archiveStudent(id));
      addToast(`Архивировано: ${count}`, 'info');
      exitSelectMode();
    }, { confirmLabel: 'Архивировать', confirmIcon: 'fa-box-archive', danger: false });
  };

  const handleBulkDelete = () => {
    const count = selectedIds.length;
    // Массовое удаление доступно только во вкладке «Архив» — история уроков сохраняется
    openConfirm(`Удалить ${count} учеников навсегда? История уроков (проведённые/отменённые) сохранится.`, () => {
      selectedIds.forEach(id => deleteStudentKeepLessons(id));
      addToast(`Удалено: ${count}`, 'info');
      exitSelectMode();
    }, { confirmLabel: 'Удалить' });
  };

  if (students.length === 0) {
    return (
      <div className="ep-card-static p-12 text-center ep-fade-in">
        <i className="fa-solid fa-users text-4xl mb-4 ep-muted" />
        <p className="text-lg font-semibold mb-1">Список учеников пуст</p>
        <p className="text-sm ep-muted">Добавьте первого ученика</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toggle active / archived + search + select-mode toggle */}
      <div className="flex items-center gap-3 flex-wrap ep-fade-in">
        <div className="view-tabs">
          <button className={`view-tab ${!showArchived ? 'active' : ''}`} onClick={() => switchTab(false)}>
            <i className="fa-solid fa-users mr-1" />Активные ({activeStudents.length})
          </button>
          <button className={`view-tab ${showArchived ? 'active' : ''}`} onClick={() => switchTab(true)}>
            <i className="fa-solid fa-box-archive mr-1" />Архив ({archivedStudents.length})
          </button>
        </div>
        {students.length > 0 && (
          <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs ep-muted pointer-events-none" />
            <input
              type="text"
              className="ep-input ep-search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени, телефону, email..."
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
        {students.length > 0 && (
          <button
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            className={selectMode ? 'ep-btn-accent text-xs py-1.5 px-3' : 'ep-btn-ghost text-xs py-1.5 px-3'}
            title={selectMode ? 'Выйти из режима выбора' : 'Выбрать несколько учеников'}
            aria-pressed={selectMode}
          >
            <i className={`fa-solid ${selectMode ? 'fa-check' : 'fa-list-check'} mr-1.5`} />
            {selectMode ? 'Готово' : 'Выбрать'}
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selectMode && (
        <div className="ep-card-static p-3 flex items-center gap-3 flex-wrap ep-fade-in">
          <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allDisplayedSelected}
              onChange={toggleSelectAll}
              disabled={displayedIds.length === 0}
              style={{ accentColor: 'var(--ep-accent)', width: 16, height: 16 }}
              className="cursor-pointer"
            />
            Все
          </label>
          <span className="text-sm font-semibold ep-accent-color">
            Выбрано: {selectedIds.length}
          </span>
          <div className="ml-auto flex gap-2 flex-wrap">
            {!showArchived && (
              <button
                onClick={handleBulkArchive}
                disabled={selectedIds.length === 0}
                className="ep-btn-ghost text-xs py-1.5 px-3"
                style={selectedIds.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                <i className="fa-solid fa-box-archive mr-1.5" />Архивировать
              </button>
            )}
            {showArchived && (
              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.length === 0}
                className="ep-btn-danger text-xs py-1.5 px-3"
                style={selectedIds.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
              <i className="fa-solid fa-trash mr-1.5" />Удалить
              </button>
            )}
            <button
              onClick={exitSelectMode}
              className="ep-btn-ghost text-xs py-1.5 px-3"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {displayedStudents.length === 0 ? (
        <div className="ep-card-static p-12 text-center ep-fade-in">
          <i className={`fa-solid ${searchQuery ? 'fa-magnifying-glass' : showArchived ? 'fa-box-archive' : 'fa-users'} text-4xl mb-4 ep-muted`} />
          <p className="text-lg font-semibold mb-1">
            {searchQuery ? 'Ничего не найдено' : showArchived ? 'Архив пуст' : 'Список учеников пуст'}
          </p>
          <p className="text-sm ep-muted">
            {searchQuery
              ? `Попробуйте изменить запрос${searchQuery ? ` «${searchQuery}»` : ''}`
              : showArchived
                ? 'Архивированные ученики появятся здесь'
                : 'Добавьте первого ученика'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayedStudents.map(({ student: s, comp, plan, cancelCount }, i) => (
            <StudentCard
              key={s.id}
              s={s}
              comp={comp}
              plan={plan}
              cancelCount={cancelCount}
              index={i}
              isArchived={!!s.archived}
              selectMode={selectMode}
              selected={selectedIds.includes(s.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
