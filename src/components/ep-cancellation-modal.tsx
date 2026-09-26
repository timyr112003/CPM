'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { fmtMoney } from '@/lib/ep-utils';
import { CancellationParty } from '@/lib/ep-types';

const REASONS_STUDENT = [
  'Не предупредил(а) заранее',
  'Забыл(а) про занятие',
  'Болезнь ученика',
  'Личные обстоятельства',
];

const REASONS_TUTOR = [
  'Болезнь репетитора',
  'Личные обстоятельства',
  'Технические проблемы',
  'Смена расписания',
];

export function EpCancellationModal() {
  const editingId = useAppStore(s => s.editingId);
  const schedule = useAppStore(s => s.schedule);
  const cancelLessonWithPenalty = useAppStore(s => s.cancelLessonWithPenalty);
  const closeModal = useAppStore(s => s.closeModal);
  const addToast = useAppStore(s => s.addToast);

  const [cancelledBy, setCancelledBy] = useState<CancellationParty>('student');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [penaltyInput, setPenaltyInput] = useState('');
  const [penaltyMode, setPenaltyMode] = useState<'none' | '50' | '100' | 'custom'>('none');

  const lesson = editingId ? schedule.find(l => l.id === editingId) : null;

  const isGroupLesson = lesson?.isGroup || false;
  const reasons = cancelledBy === 'student' ? REASONS_STUDENT : REASONS_TUTOR;
  const isCustom = reason === 'Другое';
  // For group lessons cancelled by student: show only text input
  const isStudentGroupCancel = isGroupLesson && cancelledBy === 'student';

  const fifty = useMemo(() => Math.round((lesson?.price || 0) * 50 / 100), [lesson?.price]);
  const hundred = lesson?.price || 0;

  const effectivePenalty = useMemo(() => {
    if (cancelledBy !== 'student') return 0;
    if (penaltyMode === '50') return fifty;
    if (penaltyMode === '100') return hundred;
    if (penaltyMode === 'custom') return Math.max(0, Number(penaltyInput) || 0);
    return 0;
  }, [cancelledBy, penaltyMode, penaltyInput, fifty, hundred]);

  if (!lesson) return null;

  const handlePresetClick = (mode: '50' | '100') => {
    setPenaltyMode(mode === penaltyMode ? 'none' : mode);
    setPenaltyInput('');
  };

  const handleCustomInput = (val: string) => {
    setPenaltyInput(val);
    setPenaltyMode(val ? 'custom' : 'none');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = isStudentGroupCancel
      ? customReason.trim()
      : (isCustom ? customReason.trim() : reason);
    if (!finalReason) {
      addToast('Укажите причину отмены', 'error');
      return;
    }
    cancelLessonWithPenalty(lesson.id, finalReason, cancelledBy, effectivePenalty);
    closeModal();
  };

  const handlePartyChange = (party: CancellationParty) => {
    setCancelledBy(party);
    setReason('');
    setCustomReason('');
    if (party === 'tutor') {
      setPenaltyMode('none');
      setPenaltyInput('');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,92,92,0.1)', color: 'var(--ep-danger)' }}
        >
          <i className="fa-solid fa-circle-xmark text-lg" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold">Отмена занятия</h3>
          <p className="text-xs ep-muted truncate">{lesson.student} &middot; {lesson.time} &middot; {fmtMoney(lesson.price)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Who is cancelling */}
        <div>
          <label className="block text-xs font-semibold mb-3 ep-muted" style={{ color: '#888' }}>Кто отменяет</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handlePartyChange('student')}
              className="p-3 rounded-lg text-sm font-semibold transition-all text-center"
              style={{
                background: cancelledBy === 'student' ? 'rgba(255,92,92,0.08)' : 'transparent',
                border: cancelledBy === 'student' ? '1.5px solid rgba(255,92,92,0.5)' : '1.5px solid #E0E0E0',
                color: cancelledBy === 'student' ? 'var(--ep-danger)' : '#666',
              }}
            >
              Ученик
            </button>
            <button
              type="button"
              onClick={() => handlePartyChange('tutor')}
              className="p-3 rounded-lg text-sm font-semibold transition-all text-center"
              style={{
                background: cancelledBy === 'tutor' ? 'rgba(251,191,36,0.08)' : 'transparent',
                border: cancelledBy === 'tutor' ? '1.5px solid rgba(251,191,36,0.5)' : '1.5px solid #E0E0E0',
                color: cancelledBy === 'tutor' ? 'var(--ep-warning)' : '#666',
              }}
            >
              Репетитор
            </button>
          </div>
        </div>

        {/* Reason selection */}
        <div>
          <label className="block text-xs font-semibold mb-3" style={{ color: '#888' }}>Причина отмены</label>

          {isStudentGroupCancel ? (
            /* Group lesson cancelled by student: only text input */
            <textarea
              className="w-full px-4 py-3 rounded-lg text-sm transition-all outline-none resize-none"
              rows={3}
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              placeholder="Опишите причину отмены учеником..."
              autoFocus
              style={{
                background: 'var(--ep-bg-secondary)',
                border: '1.5px solid #E0E0E0',
                color: '#333',
              }}
            />
          ) : (
            <>
              {/* 2x2 grid of reasons */}
              <div className="grid grid-cols-2 gap-2.5">
                {reasons.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { setReason(r); setCustomReason(''); }}
                    className="px-4 py-3 rounded-lg text-sm transition-all text-left"
                    style={{
                      background: reason === r ? 'var(--ep-accent-dim-bg)' : 'transparent',
                      border: reason === r ? '1.5px solid var(--ep-accent)' : '1.5px solid #E0E0E0',
                      color: reason === r ? 'var(--ep-accent)' : '#333',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {/* «Другое» — full width */}
              <button
                type="button"
                onClick={() => { setReason('Другое'); }}
                className="w-full mt-2.5 px-4 py-3 rounded-lg text-sm transition-all text-left"
                style={{
                  background: reason === 'Другое' ? 'var(--ep-accent-dim-bg)' : 'transparent',
                  border: reason === 'Другое' ? '1.5px solid var(--ep-accent)' : '1.5px solid #E0E0E0',
                  color: reason === 'Другое' ? 'var(--ep-accent)' : '#333',
                }}
              >
                Другое
              </button>

              {/* Custom reason textarea */}
              {isCustom && (
                <textarea
                  className="w-full px-4 py-3 rounded-lg text-sm transition-all outline-none resize-none"
                  rows={3}
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  placeholder="Введите причину..."
                  autoFocus
                  style={{
                    background: 'var(--ep-bg-secondary)',
                    border: '1.5px solid var(--ep-accent)',
                    color: '#333',
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* Penalty — only for student */}
        {cancelledBy === 'student' && (
          <div>
            <label className="block text-xs font-semibold mb-3" style={{ color: '#888' }}>Штраф</label>

            {/* Buttons: Без штрафа + 50% + 100% */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { setPenaltyMode('none'); setPenaltyInput(''); }}
                className="px-3 py-3 rounded-lg text-sm font-semibold transition-all text-center"
                style={{
                  background: penaltyMode === 'none' ? 'var(--ep-accent-dim-bg)' : 'transparent',
                  border: penaltyMode === 'none' ? '1.5px solid var(--ep-accent)' : '1.5px solid #E0E0E0',
                  color: penaltyMode === 'none' ? 'var(--ep-accent)' : '#333',
                }}
              >
                Без штрафа
              </button>
              <button
                type="button"
                onClick={() => handlePresetClick('50')}
                className="px-3 py-3 rounded-lg text-sm font-semibold transition-all text-center"
                style={{
                  background: penaltyMode === '50' ? 'var(--ep-accent-dim-bg)' : 'transparent',
                  border: penaltyMode === '50' ? '1.5px solid var(--ep-accent)' : '1.5px solid #E0E0E0',
                  color: penaltyMode === '50' ? 'var(--ep-accent)' : '#333',
                }}
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => handlePresetClick('100')}
                className="px-3 py-3 rounded-lg text-sm font-semibold transition-all text-center"
                style={{
                  background: penaltyMode === '100' ? 'var(--ep-accent-dim-bg)' : 'transparent',
                  border: penaltyMode === '100' ? '1.5px solid var(--ep-accent)' : '1.5px solid #E0E0E0',
                  color: penaltyMode === '100' ? 'var(--ep-accent)' : '#333',
                }}
              >
                100%
              </button>
            </div>

            {/* Manual input — shown when 50%, 100% selected, or when typing */}
            {penaltyMode !== 'none' && (
              <div className="mt-2.5">
                <input
                  type="number"
                  className="w-full px-4 py-3 rounded-lg text-sm transition-all outline-none"
                  placeholder={penaltyMode === '50' ? `Сумма штрафа: ${fmtMoney(fifty)}` : penaltyMode === '100' ? `Сумма штрафа: ${fmtMoney(hundred)}` : 'Другая сумма (₽)'}
                  value={penaltyInput}
                  onChange={e => handleCustomInput(e.target.value)}
                  min={0}
                  style={{
                    background: penaltyMode === 'custom' ? 'var(--ep-bg-secondary)' : 'transparent',
                    border: penaltyMode === 'custom' ? '1.5px solid var(--ep-accent)' : '1.5px solid #E0E0E0',
                    color: '#333',
                  }}
                />
              </div>
            )}

            {/* Active penalty summary */}
            {effectivePenalty > 0 && (
              <div
                className="mt-2.5 p-3 rounded-lg flex items-center justify-between"
                style={{ background: 'var(--ep-accent-dim-bg)', border: '1px solid var(--ep-accent)' }}
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--ep-accent)' }}>
                  Штраф:
                </span>
                <span className="text-sm font-bold" style={{ color: 'var(--ep-accent)' }}>
                  {fmtMoney(effectivePenalty)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Tutor notice */}
        {cancelledBy === 'tutor' && (
          <div
            className="p-3 rounded-lg flex items-start gap-2"
            style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}
          >
            <i className="fa-solid fa-info-circle mt-0.5" style={{ color: 'var(--ep-warning)', fontSize: 12 }} />
            <span className="text-xs" style={{ color: 'var(--ep-warning)' }}>
              При отмене по вашей вине штраф ученику не начисляется.
            </span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={closeModal} className="ep-btn-ghost">
            Назад
          </button>
          <button type="submit" className="ep-btn-danger">
            <i className="fa-solid fa-xmark mr-1" />Отменить урок
          </button>
        </div>
      </form>
    </div>
  );
}
