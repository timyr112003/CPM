'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { plural } from '@/lib/ep-reminders';

/**
 * Компактная модалка «Настройки ученика» — открывается шестерёнкой на карточке
 * (слева от «В архив»). Первый раздел — напоминания о занятиях; сюда же в будущем
 * добавляются другие настройки ученика.
 *
 * Режим «Как у всех»: действуют общие настройки аккаунта
 * (Настройки → «Напоминание ученику» / «Напоминание родителю»).
 * Режим «Свои настройки»: включённость и тайминг задаются индивидуально.
 * ГЛАВНЫЙ ВЫКЛЮЧАТЕЛЬ: если общее уведомление выключено — письма этого типа
 * не уходят никому, даже при включённых личных тумблерах; в модалке в этом
 * случае показывается предупреждение.
 *
 * Все изменения сохраняются сразу (автосейв, как в Настройках).
 */
export function EpStudentNotifyModal() {
  const editingId = useAppStore(s => s.editingId);
  const students = useAppStore(s => s.students);
  const settings = useAppStore(s => s.settings);
  const updateStudentNotify = useAppStore(s => s.updateStudentNotify);
  const closeModal = useAppStore(s => s.closeModal);
  const addToast = useAppStore(s => s.addToast);

  const student = students.find(s => s.id === editingId);

  // Локальное состояние поля «за сколько минут»: сохраняем по потере фокуса/Enter,
  // key премонтирует поле при смене ученика или внешнем обновлении
  const custom = student?.notify?.mode === 'custom' ? student.notify : null;
  const [minutesError, setMinutesError] = useState('');
  const minutesKey = `${student?.id ?? 'x'}-${custom?.minutes ?? 'def'}`;

  if (!student) return null;

  const isCustom = custom !== null;
  const globalStudentOn = settings.notifyStudentLesson === true;
  const globalParentOn = settings.notifyParentLesson === true;
  const globalStudentMinutes = settings.notifyStudentLessonMinutes ?? 60;
  const globalParentMinutes = settings.notifyParentLessonMinutes ?? 60;

  const email = (student.email || '').trim();
  const parentEmail = (student.parent?.email || '').trim();

  /** Включённость письма ученику в текущем режиме (для подписи) */
  const effStudentOn = isCustom ? (custom?.toStudent === true) : globalStudentOn;
  const effParentOn = isCustom ? (custom?.toParent === true) : globalParentOn;
  const effMinutes = custom?.minutes ?? globalStudentMinutes;

  const setMode = (mode: 'inherit' | 'custom') => {
    if (mode === 'inherit') {
      updateStudentNotify(student.id, undefined);
      setMinutesError('');
      addToast('Действуют общие настройки уведомлений', 'info');
      return;
    }
    // Переход к своим настройкам: стартуем от текущего эффективного состояния
    updateStudentNotify(student.id, {
      mode: 'custom',
      toStudent: effStudentOn,
      toParent: effParentOn,
      minutes: effMinutes,
    });
  };

  const patchCustom = (patch: { toStudent?: boolean; toParent?: boolean; minutes?: number }) => {
    updateStudentNotify(student.id, {
      mode: 'custom',
      toStudent: custom?.toStudent === true,
      toParent: custom?.toParent === true,
      minutes: custom?.minutes ?? globalStudentMinutes,
      ...patch,
    });
  };

  const toggleRow = (key: 'toStudent' | 'toParent', value: boolean) => {
    patchCustom({ [key]: value });
    if (key === 'toStudent' && value && !email) addToast('У ученика нет email — добавьте его в редакторе карточки', 'error');
    if (key === 'toParent' && value && !parentEmail) addToast('У родителя нет email — добавьте его на вкладке «Родитель»', 'error');
  };

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">
          <i className="fa-solid fa-gear mr-2 ep-muted" />
          Настройки ученика
        </h3>
        <div className="text-xs ep-muted max-w-[50%] truncate" title={student.name}>{student.name}</div>
      </div>

      {/* Раздел: уведомления о занятиях */}
      <div>
        <div className="text-xs font-semibold ep-muted mb-2 uppercase tracking-wide">
          <i className="fa-solid fa-bell mr-1.5" />
          Напоминания о занятиях
        </div>
        <div className="p-3 rounded-lg ep-bg-base text-sm space-y-3">
          {/* Режим */}
          <div className="text-xs ep-muted">
            Кому и за сколько присылать напоминание о занятии
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('inherit')}
              aria-pressed={!isCustom}
              className={`flex-1 text-xs py-2 px-3 rounded-lg border transition-colors cursor-pointer ${!isCustom ? 'font-semibold' : 'ep-muted'}`}
              style={
                !isCustom
                  ? { background: 'var(--ep-accent)', borderColor: 'var(--ep-accent)', color: '#fff' }
                  : { borderColor: 'rgba(128,128,128,0.25)' }
              }
            >
              Как у всех
            </button>
            <button
              type="button"
              onClick={() => setMode('custom')}
              aria-pressed={isCustom}
              className={`flex-1 text-xs py-2 px-3 rounded-lg border transition-colors cursor-pointer ${isCustom ? 'font-semibold' : 'ep-muted'}`}
              style={
                isCustom
                  ? { background: 'var(--ep-accent)', borderColor: 'var(--ep-accent)', color: '#fff' }
                  : { borderColor: 'rgba(128,128,128,0.25)' }
              }
            >
              Свои настройки
            </button>
          </div>

          {/* Предупреждение: общий выключатель перекрывает любые личные настройки */}
          {(!globalStudentOn || !globalParentOn) && (
            <div
              className="text-xs rounded-lg p-2.5"
              style={{ background: 'rgba(217,119,6,0.10)', border: '1px solid rgba(217,119,6,0.30)' }}
              role="alert"
            >
              <div className="font-semibold" style={{ color: '#b45309' }}>
                <i className="fa-solid fa-triangle-exclamation mr-1.5" />
                Уведомления отключены в общих настройках
              </div>
              <div className="mt-0.5" style={{ color: '#b45309' }}>
                {!globalStudentOn && !globalParentOn
                  ? 'Напоминания и ученику, и родителю выключены в общих настройках (Настройки → «Уведомления о занятиях») — письма не отправляются никому, пока не включите их там.'
                  : !globalStudentOn
                    ? 'Напоминания ученику выключены в общих настройках (Настройки → «Уведомления о занятиях») — письма ученику не отправляются, пока не включите их там.'
                    : 'Напоминания родителю выключены в общих настройках (Настройки → «Уведомления о занятиях») — письма родителю не отправляются, пока не включите их там.'}
              </div>
            </div>
          )}

          {!isCustom ? (
            /* «Как у всех» — сводка общих настроек */
            <div className="text-xs ep-muted space-y-1.5 pt-1">
              <div className="flex items-center justify-between gap-2">
                <span>Ученику:</span>
                <span className="font-semibold" style={{ color: globalStudentOn ? 'var(--ep-accent)' : 'var(--ep-muted)' }}>
                  {globalStudentOn ? `включено, за ${globalStudentMinutes} ${plural(globalStudentMinutes, 'минуту', 'минуты', 'минут')}` : 'выключено'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Родителю:</span>
                <span className="font-semibold" style={{ color: globalParentOn ? 'var(--ep-accent)' : 'var(--ep-muted)' }}>
                  {globalParentOn ? `включено, за ${globalParentMinutes} ${plural(globalParentMinutes, 'минуту', 'минуты', 'минут')}` : 'выключено'}
                </span>
              </div>
              <div className="pt-1">Общие значения меняются в Настройках — «Уведомления о занятиях». Нажмите «Свои настройки», чтобы задать индивидуальные.</div>
            </div>
          ) : (
            /* «Свои настройки» — тумблеры и тайминг */
            <div className="space-y-3 pt-1">
              {/* Ученику */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Слать ученику</div>
                  <div className="text-xs ep-muted truncate">
                    {email ? `Email: ${email}` : 'Email ученика не указан — письмо не уйдёт'}
                  </div>
                </div>
                <NotifyToggle checked={custom?.toStudent === true} onChange={v => toggleRow('toStudent', v)} />
              </div>

              {/* Родителю */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Слать родителю</div>
                  <div className="text-xs ep-muted truncate">
                    {parentEmail
                      ? `Email: ${parentEmail}${student.parent?.name ? ` · ${student.parent.name}` : ''}`
                      : 'Email родителя не указан — письмо не уйдёт'}
                  </div>
                </div>
                <NotifyToggle checked={custom?.toParent === true} onChange={v => toggleRow('toParent', v)} />
              </div>

              {/* Тайминг */}
              <div>
                <div className="text-xs ep-muted mb-1.5">За сколько минут напоминать (5–1440)</div>
                <div className="flex items-center gap-2">
                  <input
                    key={minutesKey}
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={1440}
                    step={5}
                    className="ep-input"
                    style={{ width: 96 }}
                    defaultValue={effMinutes}
                    onBlur={e => {
                      const n = Math.round(Number(e.target.value));
                      if (Number.isFinite(n) && n >= 5 && n <= 1440) {
                        setMinutesError('');
                        if (n !== effMinutes) patchCustom({ minutes: n });
                      } else {
                        e.target.value = String(effMinutes);
                        setMinutesError('Допустимо от 5 до 1440 минут — значение возвращено');
                      }
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  />
                  <span className="text-xs ep-muted">минут до начала</span>
                </div>
                {minutesError && (
                  <div className="text-xs mt-1" style={{ color: 'var(--ep-danger)' }} role="alert">
                    <i className="fa-solid fa-circle-exclamation mr-1" />{minutesError}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <button onClick={closeModal} className="ep-btn-accent w-full py-2.5 text-sm">
        <i className="fa-solid fa-check mr-2" />
        Готово
      </button>
    </div>
  );
}

/** Тумблер в стиле настроек (local copy — чтобы модалка была самостоятельной) */
function NotifyToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex flex-shrink-0 cursor-pointer items-center rounded-full transition-colors"
      style={{
        width: 40,
        height: 22,
        background: checked ? 'var(--ep-accent)' : 'rgba(128,128,128,0.35)',
      }}
    >
      <span
        className="inline-block rounded-full bg-white transition-transform"
        style={{ width: 16, height: 16, transform: checked ? 'translateX(20px)' : 'translateX(4px)' }}
      />
    </button>
  );
}
