'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/ep-store';

export function EpClasses() {
  const classes = useAppStore(s => s.classes);
  const students = useAppStore(s => s.students);
  const schedule = useAppStore(s => s.schedule);
  const openModal = useAppStore(s => s.openModal);
  const deleteClass = useAppStore(s => s.deleteClass);
  const addToast = useAppStore(s => s.addToast);
  const openConfirm = useAppStore(s => s.openConfirm);

  const classStats = useMemo(() => {
    return classes.map(c => {
      const comp = schedule.filter(l => l.classId === c.id && l.status === 'completed').length;
      const cancelCount = schedule.filter(l => l.classId === c.id && l.status === 'cancelled').length;
      return { classGroup: c, comp, cancelCount };
    });
  }, [classes, schedule]);

  if (classes.length === 0) {
    return (
      <div className="ep-card-static p-12 text-center ep-fade-in">
        <i className="fa-solid fa-layer-group text-4xl mb-4 ep-muted" />
        <p className="text-lg font-semibold mb-1">Нет созданных классов</p>
        <p className="text-sm mb-4 ep-muted">Объединяйте учеников в группы</p>
        <button onClick={() => openModal('class')} className="ep-btn-accent">Создать первый класс</button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {classStats.map(({ classGroup: c, comp, cancelCount }, i) => {
        const members = students.filter(s => c.studentIds.includes(s.id));

        return (
          <div key={c.id} className="card p-5 ep-fade-in" style={{ animationDelay: (i * 0.04) + 's' }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-sm flex items-center gap-2">
                  <i className="fa-solid fa-layer-group" style={{ color: '#a78bfa' }} />
                  {c.name}
                </div>
                <div className="text-xs mt-1 ep-muted">{c.description || 'Без описания'}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openModal('class', c.id)} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(128,128,128,0.08)', color: 'var(--ep-muted)' }}>
                  <i className="fa-solid fa-pen text-xs" />
                </button>
                <button onClick={() => openConfirm(`Удалить класс «${c.name}»?`, () => { deleteClass(c.id); addToast('Класс удалён', 'info'); })} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(255,92,92,0.12)', color: 'var(--ep-danger)' }}>
                  <i className="fa-solid fa-trash text-xs" />
                </button>
              </div>
            </div>

            <div className="mb-3">
              <div className="text-xs font-semibold mb-2 ep-muted">УЧЕНИКИ ({members.length})</div>
              {members.length === 0 ? (
                <div className="text-xs ep-muted">Пусто</div>
              ) : (
                <div className="space-y-1">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center gap-2 text-xs p-1.5 rounded ep-bg-base">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ep-accent-dim-bg ep-accent-color">
                        {m.name[0]}
                      </div>
                      {m.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openModal('class-stats', c.id, { classStatsType: 'completed' })}
                className="text-center p-2.5 rounded-lg ep-bg-base transition-all hover:opacity-80 cursor-pointer"
              >
                <div className="text-sm font-bold" style={{ color: '#4ade80' }}>{comp}</div>
                <div className="text-xs ep-muted">Проведено</div>
              </button>
              <button
                type="button"
                onClick={() => openModal('class-stats', c.id, { classStatsType: 'cancelled' })}
                className="text-center p-2.5 rounded-lg ep-bg-base transition-all hover:opacity-80 cursor-pointer"
              >
                <div className="text-sm font-bold" style={{ color: 'var(--ep-danger)' }}>{cancelCount}</div>
                <div className="text-xs ep-muted">Отмены</div>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
