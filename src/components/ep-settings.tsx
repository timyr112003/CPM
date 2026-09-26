'use client';

import { useState, useRef } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { isHybridRoles, DAYS_SHORT_RU } from '@/lib/ep-types';
import { plural } from '@/lib/ep-reminders';
import { pushData, pullData, readLegacyBackup, dropLegacyBackup, useSyncStore, DATA_FORMAT } from '@/lib/ep-sync';
import { normalizeStudentsParentFields } from '@/lib/ep-utils';
import { EpPhotoEditor } from './ep-photo-editor';

export function EpSettings() {
  const currentUser = useAppStore(s => s.currentUser);
  const setActiveCabinet = useAppStore(s => s.setActiveCabinet);
  const theme = useAppStore(s => s.theme);
  const toggleTheme = useAppStore(s => s.toggleTheme);
  const updateCurrentUser = useAppStore(s => s.updateCurrentUser);
  const changePassword = useAppStore(s => s.changePassword);
  const addToast = useAppStore(s => s.addToast);
  const openConfirm = useAppStore(s => s.openConfirm);
  const students = useAppStore(s => s.students);
  const schedule = useAppStore(s => s.schedule);
  const finance = useAppStore(s => s.finance);
  const classes = useAppStore(s => s.classes);
  const subscriptions = useAppStore(s => s.subscriptions);
  const settings = useAppStore(s => s.settings);
  const updateSettings = useAppStore(s => s.updateSettings);
  const syncStatus = useSyncStore(s => s.status);
  const lastSyncAt = useSyncStore(s => s.lastSyncAt);
  const syncError = useSyncStore(s => s.error);
  const [legacyBackupExists] = useState(() => typeof window !== 'undefined' && !!readLegacyBackup());

  // Открытая панель настроек уведомления (у каждого уведомления своя шестерёнка)
  const [openNotify, setOpenNotify] = useState<null | 'daily' | 'hourly' | 'weekly' | 'student' | 'parent'>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [localPhoto, setLocalPhoto] = useState<string | undefined>(undefined);
  const [editingSrc, setEditingSrc] = useState<string | null>(null);

  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || '');
  const [profileError, setProfileError] = useState('');

  // Password change state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdPending, setPwdPending] = useState(false);
  const [profilePending, setProfilePending] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const photoUrl = currentUser?.photo || localPhoto;

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditingSrc(reader.result as string);
    };
    reader.readAsDataURL(file);

    e.target.value = '';
  };

  const handlePhotoConfirm = async (croppedBase64: string) => {
    setLocalPhoto(croppedBase64);
    setEditingSrc(null);
    const res = await updateCurrentUser({ photo: croppedBase64 });
    if (!res.ok) addToast(res.error || 'Не удалось сохранить фото', 'error');
  };

  const handlePhotoCancel = () => {
    setEditingSrc(null);
  };

  const handleRemovePhoto = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalPhoto(undefined);
    const res = await updateCurrentUser({ photo: '' });
    if (!res.ok) addToast(res.error || 'Не удалось удалить фото', 'error');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess(false);

    if (!currentPwd || !newPwd || !confirmPwd) {
      setPwdError('Заполните все поля');
      return;
    }
    if (newPwd.length < 4) {
      setPwdError('Пароль должен быть не менее 4 символов');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('Новый пароль и подтверждение не совпадают');
      return;
    }
    if (currentPwd === newPwd) {
      setPwdError('Новый пароль должен отличаться от текущего');
      return;
    }

    setPwdPending(true);
    const res = await changePassword(currentPwd, newPwd);
    setPwdPending(false);
    if (res.ok) {
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setPwdSuccess(true);
      addToast('Пароль успешно изменён', 'success');
      setTimeout(() => setPwdSuccess(false), 3000);
    } else {
      setPwdError(res.error || 'Не удалось изменить пароль');
    }
  };

  const handleProfileEdit = () => {
    setProfileName(currentUser?.name || '');
    setProfileEmail(currentUser?.email || '');
    setProfileError('');
    setEditingProfile(true);
  };

  const handleProfileCancel = () => {
    setEditingProfile(false);
    setProfileError('');
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');

    const name = profileName.trim();
    const email = profileEmail.trim().toLowerCase();

    if (!name) { setProfileError('Имя не может быть пустым'); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProfileError('Введите корректный email');
      return;
    }

    setProfilePending(true);
    // Уникальность email проверяет сервер
    const res = await updateCurrentUser({ name, email });
    setProfilePending(false);
    if (!res.ok) {
      setProfileError(res.error || 'Не удалось обновить профиль');
      return;
    }
    setEditingProfile(false);
    addToast('Профиль обновлён', 'success');
  };

  const handleClearData = () => {
    openConfirm(
      'Удалить ВСЕ данные (учеников, уроки, финансы, классы)? Это действие необратимо!',
      () => {
        // Обновляем Zustand-стор напрямую, чтобы in-memory состояние и
        // persisted localStorage оставались синхронизированными. Прямая
        // запись в localStorage была бы перезаписана ближайшим addToast →
        // persist middleware записал бы устаревшие данные обратно.
        try {
          useAppStore.setState({
            students: [],
            classes: [],
            schedule: [],
            finance: [],
            subscriptions: [],
          });
          addToast('Все данные удалены. Перезагрузка...', 'info');
          setTimeout(() => window.location.reload(), 800);
        } catch (err) {
          addToast('Ошибка при очистке данных', 'error');
        }
      },
      { confirmLabel: 'Удалить всё', confirmIcon: 'fa-trash', danger: true }
    );
  };

  // Экспорт данных в JSON-файл
  const handleExportData = () => {
    try {
      const payload = {
        version: DATA_FORMAT,
        exportedAt: new Date().toISOString(),
        data: {
          students,
          classes,
          schedule,
          finance,
          subscriptions,
        },
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const d = new Date();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const filename = `englishpro-backup-${dateStr}.json`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('Данные экспортированы', 'success');
    } catch (err) {
      addToast('Ошибка при экспорте данных', 'error');
    }
  };

  // Импорт данных из JSON-файла (с подтверждением)
  const handleImportClick = () => {
    importFileRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Сбрасываем значение, чтобы можно было выбрать тот же файл повторно
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = JSON.parse(text);
        const data = parsed?.data;
        if (!data || typeof data !== 'object' || !Array.isArray(data.students)) {
          addToast('Неверный формат файла', 'error');
          return;
        }
        openConfirm(
          'Импортировать данные? Текущие данные будут заменены, а новая копия сохранится на сервер.',
          () => {
            // Обновляем Zustand-стор напрямую, чтобы in-memory состояние и
            // persisted localStorage оставались синхронизированными. Прямая
            // запись в localStorage была бы перезаписана ближайшим addToast →
            // persist middleware записал бы устаревшие данные обратно.
            try {
              // Файлы версии 1 — старого формата: student.socials в них были
              // соцсетями родителя и переносятся в parent.socials
              const rawStudents = Array.isArray(data.students) ? data.students : [];
              const needMigration = (Number(parsed?.version) || 1) < DATA_FORMAT;
              useAppStore.setState({
                students: needMigration ? normalizeStudentsParentFields(rawStudents) : rawStudents,
                classes: Array.isArray(data.classes) ? data.classes : [],
                schedule: Array.isArray(data.schedule) ? data.schedule : [],
                finance: Array.isArray(data.finance) ? data.finance : [],
                subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : [],
              });
              void pushData();
              addToast('Данные импортированы и сохранены на сервере', 'success');
            } catch (err) {
              addToast('Ошибка при импорте данных', 'error');
            }
          },
          { confirmLabel: 'Импортировать', confirmIcon: 'fa-file-import', danger: true }
        );
      } catch (err) {
        addToast('Неверный формат файла', 'error');
      }
    };
    reader.onerror = () => {
      addToast('Не удалось прочитать файл', 'error');
    };
    reader.readAsText(file);
  };

  // Принудительная синхронизация: сохранить локальные изменения и забрать данные сервера
  const handleSyncNow = async () => {
    setSyncing(true);
    await pushData();
    await pullData();
    setSyncing(false);
    const st = useSyncStore.getState();
    if (st.status === 'error') {
      addToast(st.error || 'Ошибка синхронизации', 'error');
    } else {
      addToast('Данные синхронизированы с сервером', 'success');
    }
  };

  // ── Время уведомлений: производные значения и сохранение ──
  const dailyTime = settings.notifyDailyTime || '07:00';
  const weeklyTime = settings.notifyWeeklyTime || '07:00';
  const weeklyDays = Array.isArray(settings.notifyWeeklyDays) ? settings.notifyWeeklyDays : [0];
  const hourlyMinutes = settings.notifyHourlyMinutes ?? 60;

  // Напоминания ученику/родителю: по умолчанию ВЫКЛЮЧЕНЫ (письма уходят третьим лицам,
  // педагог включает их осознанно); индивидуальные настройки ученика перекрывают общие
  const studentNotifyOn = settings.notifyStudentLesson === true;
  const parentNotifyOn = settings.notifyParentLesson === true;
  const studentNotifyMinutes = settings.notifyStudentLessonMinutes ?? 60;
  const parentNotifyMinutes = settings.notifyParentLessonMinutes ?? 60;

  // Недельный план фактически включён, только когда переключатель включён
  // И выбран хотя бы один день (без дней письмо бы не ушло)
  const weeklyEnabled = settings.notifyWeekly !== false && weeklyDays.length > 0;

  const toggleWeekday = (i: number) => {
    const set = new Set(weeklyDays);
    if (set.has(i)) set.delete(i); else set.add(i);
    const days = [...set].sort((a, b) => a - b);
    if (!days.length) {
      // Не выбран ни один день — недельный план отключается:
      // ползунок «План на неделю» уходит влево (в неактивное положение)
      updateSettings({ notifyWeeklyDays: [], notifyWeekly: false });
    } else if (!weeklyDays.length) {
      // Выбран первый день — недельный план снова включается
      updateSettings({ notifyWeeklyDays: days, notifyWeekly: true });
    } else {
      updateSettings({ notifyWeeklyDays: days });
    }
  };

  // Восстановление резервной копии, созданной при очистке/смене аккаунта
  const handleRestoreLegacy = () => {
    const backup = readLegacyBackup();
    if (!backup) {
      addToast('Резервная копия не найдена', 'error');
      return;
    }
    openConfirm(
      'Восстановить резервную копию локальных данных? Текущие данные будут заменены, а копия сохранена на сервер.',
      () => {
        try {
          const b = backup.data;
          const rawStudents = Array.isArray(b.students) ? b.students : [];
          useAppStore.setState({
            students: backup.version < DATA_FORMAT ? normalizeStudentsParentFields(rawStudents) : rawStudents,
            classes: Array.isArray(b.classes) ? b.classes : [],
            schedule: Array.isArray(b.schedule) ? b.schedule : [],
            finance: Array.isArray(b.finance) ? b.finance : [],
            subscriptions: Array.isArray(b.subscriptions) ? b.subscriptions : [],
          });
          void pushData();
          dropLegacyBackup();
          addToast('Резервная копия восстановлена и сохранена на сервере', 'success');
        } catch {
          addToast('Ошибка при восстановлении копии', 'error');
        }
      },
      { confirmLabel: 'Восстановить', confirmIcon: 'fa-rotate-left', danger: true }
    );
  };

  // If photo editor is open, show it inline in the profile section
  if (editingSrc) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="ep-card-static p-6 ep-fade-in">
          <h4 className="font-bold text-sm mb-4">Настроить фото профиля</h4>
          <EpPhotoEditor
            imageSrc={editingSrc}
            onConfirm={handlePhotoConfirm}
            onCancel={handlePhotoCancel}
            size={256}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Profile */}
      <div className="ep-card-static p-6 ep-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-sm">Профиль</h4>
          {!editingProfile && (
            <button
              onClick={handleProfileEdit}
              className="ep-btn-ghost text-xs py-1.5 px-3"
              title="Редактировать имя и email"
            >
              <i className="fa-solid fa-pen mr-1.5" />Изменить
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 mb-6">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={handleAvatarClick}
              className="group relative w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold overflow-hidden ep-accent-dim-bg ep-accent-color cursor-pointer focus:outline-none"
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={currentUser?.name || 'Аватар'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{currentUser?.name?.charAt(0)?.toUpperCase()}</span>
              )}

              {/* Camera icon overlay on hover */}
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <i className="fa-solid fa-camera text-white text-base" />
              </div>
            </button>

            {/* Remove photo link */}
            {photoUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs ep-muted hover:text-red-500 transition-colors whitespace-nowrap"
              >
                Удалить фото
              </button>
            )}
          </div>

          {/* Name + Email display/edit */}
          <div className="pt-1 flex-1 min-w-0">
            {editingProfile ? (
              <form onSubmit={handleProfileSubmit} className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold mb-1 ep-muted">Имя</label>
                  <input
                    type="text"
                    className="ep-input"
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    placeholder="Ваше имя"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 ep-muted">Email</label>
                  <input
                    type="email"
                    className="ep-input"
                    value={profileEmail}
                    onChange={e => setProfileEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
                {profileError && (
                  <div className="p-2 rounded-lg text-xs font-semibold" style={{ background: 'rgba(255,92,92,0.1)', border: '1px solid rgba(255,92,92,0.2)', color: 'var(--ep-danger)' }}>
                    <i className="fa-solid fa-circle-exclamation mr-1" />{profileError}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="ep-btn-accent text-xs py-1.5 px-3" disabled={profilePending}>
                    {profilePending ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin mr-1" />Сохранение…
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-check mr-1" />Сохранить
                      </>
                    )}
                  </button>
                  <button type="button" onClick={handleProfileCancel} className="ep-btn-ghost text-xs py-1.5 px-3">
                    Отмена
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="font-semibold">{currentUser?.name}</div>
                <div className="text-sm ep-muted truncate">{currentUser?.email}</div>
              </>
            )}
          </div>
        </div>

        {!editingProfile && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg ep-bg-base">
              <div>
                <div className="text-sm font-semibold">Email</div>
                <div className="text-xs ep-muted">{currentUser?.email}</div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg ep-bg-base">
              <div>
                <div className="text-sm font-semibold">Роль</div>
                <div className="text-xs ep-muted">Репетитор английского языка</div>
              </div>
            </div>
            {/* Переключение кабинетов (только у гибрида) — внутри панели «Профиль» */}
            {currentUser && isHybridRoles(currentUser.roles) && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg ep-bg-base flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Кабинет</div>
                  <div className="text-xs ep-muted">Сейчас открыт учительский кабинет. Один логин и пароль — два кабинета, переключение без повторного входа.</div>
                </div>
                <button
                  onClick={() => setActiveCabinet('admin')}
                  className="ep-btn-accent text-xs py-2 px-3 flex-shrink-0"
                >
                  <i className="fa-solid fa-user-shield mr-1.5" />В кабинет администратора
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Data management */}
      <div className="ep-card-static p-6 ep-fade-in" style={{ animationDelay: '0.075s' }}>
        <h4 className="font-bold text-sm mb-4">
          <i className="fa-solid fa-database mr-2 ep-muted" />
          Данные
        </h4>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-3 rounded-lg ep-bg-base">
            <div>
              <div className="text-sm font-semibold">Объём данных</div>
              <div className="text-xs ep-muted">
                {students.length} учеников · {schedule.length} уроков · {finance.length} операций · {classes.length} классов · {subscriptions.length} абонементов
              </div>
            </div>
          </div>

          {/* Скрытый input для импорта JSON */}
          <input
            ref={importFileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportFile}
          />

          {/* Экспорт данных */}
          <div className="flex items-center justify-between p-3 rounded-lg ep-bg-base">
            <div>
              <div className="text-sm font-semibold">Экспорт данных</div>
              <div className="text-xs ep-muted">Сохранить всех учеников, уроки, финансы и аккаунт в JSON-файл.</div>
            </div>
            <button
              onClick={handleExportData}
              className="ep-btn-accent text-xs py-2 px-3 flex-shrink-0"
              disabled={students.length === 0 && schedule.length === 0 && finance.length === 0 && classes.length === 0}
            >
              <i className="fa-solid fa-file-export mr-1.5" />Экспорт
            </button>
          </div>

          {/* Импорт данных */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(0,229,160,0.04)', border: '1px solid rgba(0,229,160,0.12)' }}>
            <div>
              <div className="text-sm font-semibold">Импорт данных</div>
              <div className="text-xs ep-muted">Загрузить резервную копию JSON. Текущие данные будут заменены.</div>
            </div>
            <button
              onClick={handleImportClick}
              className="ep-btn-ghost text-xs py-2 px-3 flex-shrink-0"
            >
              <i className="fa-solid fa-file-import mr-1.5" />Импорт
            </button>
          </div>

          {/* Очистить все данные */}
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(255,92,92,0.04)', border: '1px solid rgba(255,92,92,0.12)' }}>
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--ep-danger)' }}>Очистить все данные</div>
              <div className="text-xs ep-muted">Удалить всех учеников, уроки и финансы. Аккаунт останется.</div>
            </div>
            <button
              onClick={handleClearData}
              className="ep-btn-danger text-xs py-2 px-3 flex-shrink-0"
              disabled={students.length === 0 && schedule.length === 0 && finance.length === 0}
            >
              <i className="fa-solid fa-trash mr-1.5" />Очистить
            </button>
          </div>
        </div>
      </div>

      {/* Синхронизация с сервером */}
      <div className="ep-card-static p-6 ep-fade-in" style={{ animationDelay: '0.02s' }}>
        <h4 className="font-bold text-sm mb-4">
          <i className="fa-solid fa-cloud-arrow-up mr-2 ep-muted" />
          Синхронизация
        </h4>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg ep-bg-base">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Состояние</div>
              <div className="text-xs ep-muted truncate">
                {syncStatus === 'saving'
                  ? 'Сохранение изменений…'
                  : syncStatus === 'error'
                    ? syncError || 'Ошибка синхронизации'
                    : lastSyncAt
                      ? `Последняя синхронизация: ${new Date(lastSyncAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                      : 'Готово к синхронизации'}
              </div>
            </div>
            <button
              onClick={handleSyncNow}
              className="ep-btn-accent text-xs py-2 px-3 flex-shrink-0"
              disabled={syncing || syncStatus === 'saving'}
            >
              {syncing || syncStatus === 'saving' ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin mr-1.5" />Синхронизация…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-rotate mr-1.5" />Обновить
                </>
              )}
            </button>
          </div>
          <div className="p-3 rounded-lg ep-bg-base">
            <div className="text-sm font-semibold">Доступ с любых устройств</div>
            <div className="text-xs ep-muted">
              Данные хранятся на сервере: откройте приложение на телефоне или компьютере,
              войдите в тот же аккаунт — ученики, уроки, финансы и абонементы будут одинаковыми.
              Изменения сохраняются автоматически.
            </div>
          </div>
          {legacyBackupExists && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)' }}>
              <div className="min-w-0">
                <div className="text-sm font-semibold">Резервная копия браузера</div>
                <div className="text-xs ep-muted">Найдены данные из прежней локальной версии. Можно восстановить их в этот аккаунт.</div>
              </div>
              <button onClick={handleRestoreLegacy} className="ep-btn-ghost text-xs py-2 px-3 flex-shrink-0">
                <i className="fa-solid fa-rotate-left mr-1.5" />Восстановить
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Уведомления о занятиях (этап 3): у каждого уведомления своя шестерёнка */}
      <div className="ep-card-static p-6 ep-fade-in" style={{ animationDelay: '0.04s' }}>
        <div className="mb-4">
          <h4 className="font-bold text-sm">
            <i className="fa-solid fa-bell mr-2 ep-muted" />
            Уведомления о занятиях
          </h4>
          <div className="text-xs ep-muted mt-1">
            Настройки индивидуальны для этого аккаунта и сохраняются автоматически.
          </div>
        </div>

        <div className="space-y-3 text-sm">
          {/* ── Раздел 1: личные уведомления (педагогу) ── */}
          <div className="text-[11px] font-semibold ep-muted uppercase tracking-wide px-1 pt-1">
            <i className="fa-solid fa-user mr-1.5" />
            Личные уведомления — письма вам на адрес аккаунта
          </div>

          {/* Сводка на день: своя шестерёнка → время отправки */}
          <div className="p-3 rounded-lg ep-bg-base">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Сводка на день</div>
                <div className="text-xs ep-muted">Каждый день в {dailyTime} — письмом список занятий на сегодня</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenNotify(openNotify === 'daily' ? null : 'daily')}
                  className="ep-btn-ghost text-xs py-1.5 px-2"
                  title="Во сколько присылать сводку на день"
                  aria-label="Настроить время дневной сводки"
                >
                  <i className={`fa-solid fa-gear ${openNotify === 'daily' ? 'ep-accent-color' : ''}`} />
                </button>
                <NotifyToggle
                  checked={settings.notifyDaily !== false}
                  onChange={v => updateSettings({ notifyDaily: v })}
                />
              </div>
            </div>
            {openNotify === 'daily' && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(91,108,240,0.06)', border: '1px solid rgba(91,108,240,0.18)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs ep-muted min-w-0">
                    <i className="fa-solid fa-clock mr-1.5" />Во сколько присылать расписание на текущий день (время московское)
                  </div>
                  <input
                    type="time"
                    className="ep-input flex-shrink-0"
                    style={{ width: 118 }}
                    value={dailyTime}
                    onChange={e => { if (e.target.value) updateSettings({ notifyDailyTime: e.target.value }); }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Напоминание перед занятием: своя шестерёнка → за сколько минут */}
          <div className="p-3 rounded-lg ep-bg-base">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Напоминание перед занятием</div>
                <div className="text-xs ep-muted">Письмо за {hourlyMinutes} {plural(hourlyMinutes, 'минуту', 'минуты', 'минут')} до начала занятия</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenNotify(openNotify === 'hourly' ? null : 'hourly')}
                  className="ep-btn-ghost text-xs py-1.5 px-2"
                  title="За сколько минут до занятия напоминать"
                  aria-label="Настроить напоминание перед занятием"
                >
                  <i className={`fa-solid fa-gear ${openNotify === 'hourly' ? 'ep-accent-color' : ''}`} />
                </button>
                <NotifyToggle
                  checked={settings.notifyHourly !== false}
                  onChange={v => updateSettings({ notifyHourly: v })}
                />
              </div>
            </div>
            {openNotify === 'hourly' && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(91,108,240,0.06)', border: '1px solid rgba(91,108,240,0.18)' }}>
                <div className="text-xs ep-muted mb-2">За сколько минут до занятия присылать напоминание (5–1440)</div>
                <div className="flex items-center gap-2">
                  {/**
                    Поле неконтролируемое: пока пользователь печатает — autosave не дёргается,
                    значение сохраняется по потере фокуса/Enter; key премонтирует поле,
                    когда значение изменилось извне (другое устройство, откат).
                  */}
                  <input
                    key={`hm-${hourlyMinutes}`}
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={1440}
                    step={5}
                    className="ep-input"
                    style={{ width: 96 }}
                    defaultValue={hourlyMinutes}
                    onBlur={e => {
                      const n = Math.round(Number(e.target.value));
                      if (Number.isFinite(n) && n >= 5 && n <= 1440 && n !== hourlyMinutes) {
                        updateSettings({ notifyHourlyMinutes: n });
                      } else {
                        e.target.value = String(hourlyMinutes); // невалидное/неизменное — откат
                      }
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  />
                  <span className="text-xs ep-muted">минут до начала</span>
                </div>
              </div>
            )}
          </div>

          {/* План на неделю: своя шестерёнка → время + дни недели */}
          <div className="p-3 rounded-lg ep-bg-base">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">План на неделю</div>
                <div className="text-xs ep-muted">
                  {weeklyEnabled
                    ? `${weeklyDays.map(d => DAYS_SHORT_RU[d]).join(', ')} в ${weeklyTime} — занятия на ближайшие 7 дней`
                    : !weeklyDays.length
                      ? 'Выключен: не выбран ни один день (шестерёнка справа)'
                      : 'Выключен — включите переключателем'}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenNotify(openNotify === 'weekly' ? null : 'weekly')}
                  className="ep-btn-ghost text-xs py-1.5 px-2"
                  title="Время и дни недельного плана"
                  aria-label="Настроить план на неделю"
                >
                  <i className={`fa-solid fa-gear ${openNotify === 'weekly' ? 'ep-accent-color' : ''}`} />
                </button>
                <NotifyToggle
                  checked={weeklyEnabled}
                  onChange={v => {
                    if (!v) {
                      updateSettings({ notifyWeekly: false });
                      return;
                    }
                    // Включение: если дни не выбраны — подставляем понедельник,
                    // чтобы план реально приходил (без дней письмо бы не ушло)
                    updateSettings(weeklyDays.length ? { notifyWeekly: true } : { notifyWeekly: true, notifyWeeklyDays: [0] });
                  }}
                />
              </div>
            </div>
            {openNotify === 'weekly' && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(91,108,240,0.06)', border: '1px solid rgba(91,108,240,0.18)' }}>
                <div className="text-xs ep-muted mb-2">
                  <i className="fa-solid fa-clock mr-1.5" />Время и дни, когда присылать план уроков на неделю
                </div>
                <input
                  type="time"
                  className="ep-input mb-2"
                  style={{ width: 118 }}
                  value={weeklyTime}
                  onChange={e => { if (e.target.value) updateSettings({ notifyWeeklyTime: e.target.value }); }}
                />
                <div className="flex flex-wrap gap-1.5">
                  {DAYS_SHORT_RU.map((label, i) => {
                    const active = weeklyDays.includes(i);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleWeekday(i)}
                        aria-pressed={active}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${active ? 'font-semibold' : 'ep-muted'}`}
                        style={
                          active
                            ? { background: 'var(--ep-accent)', borderColor: 'var(--ep-accent)', color: '#fff' }
                            : { borderColor: 'rgba(128,128,128,0.25)' }
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {!weeklyDays.length && (
                  <div className="text-xs ep-muted mt-1.5">Ни один день не выбран — недельный план отключён, ползунок уходит влево</div>
                )}
              </div>
            )}
          </div>

          {/* ── Раздел 2: уведомления ученикам и родителям ── */}
          <div className="px-1 pt-2">
            <div className="text-[11px] font-semibold ep-muted uppercase tracking-wide">
              <i className="fa-solid fa-graduation-cap mr-1.5" />
              Уведомления для учеников и родителей
            </div>
            <div className="text-xs ep-muted mt-1">
              Главный выключатель: если ползунок выключен здесь — письма не уходят,
              даже если у ученика включены «Свои настройки».
            </div>
          </div>

          {/* Напоминание ученику: своя шестерёнка → за сколько минут */}
          <div className="p-3 rounded-lg ep-bg-base">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Напоминание ученику</div>
                <div className="text-xs ep-muted">
                  {studentNotifyOn
                    ? `Письмо ученику за ${studentNotifyMinutes} ${plural(studentNotifyMinutes, 'минуту', 'минуты', 'минут')} до его занятия`
                    : 'Выключено — письма не отправляются, даже если у ученика включены свои настройки'}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenNotify(openNotify === 'student' ? null : 'student')}
                  className="ep-btn-ghost text-xs py-1.5 px-2"
                  title="За сколько минут до занятия напоминать ученику"
                  aria-label="Настроить напоминание ученику"
                >
                  <i className={`fa-solid fa-gear ${openNotify === 'student' ? 'ep-accent-color' : ''}`} />
                </button>
                <NotifyToggle
                  checked={studentNotifyOn}
                  onChange={v => updateSettings({ notifyStudentLesson: v })}
                />
              </div>
            </div>
            {openNotify === 'student' && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(91,108,240,0.06)', border: '1px solid rgba(91,108,240,0.18)' }}>
                <div className="text-xs ep-muted mb-2">За сколько минут до занятия напоминать ученику (5–1440)</div>
                <div className="flex items-center gap-2">
                  <input
                    key={`snm-${studentNotifyMinutes}`}
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={1440}
                    step={5}
                    className="ep-input"
                    style={{ width: 96 }}
                    defaultValue={studentNotifyMinutes}
                    onBlur={e => {
                      const n = Math.round(Number(e.target.value));
                      if (Number.isFinite(n) && n >= 5 && n <= 1440 && n !== studentNotifyMinutes) {
                        updateSettings({ notifyStudentLessonMinutes: n });
                      } else {
                        e.target.value = String(studentNotifyMinutes);
                      }
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  />
                  <span className="text-xs ep-muted">минут до начала</span>
                </div>
                <div className="text-xs ep-muted mt-2">
                  Письмо уходит на email ученика из его карточки. Ученику без email письмо не отправляется.
                  Для отдельных учеников — шестерёнка «Настройки» на его карточке.
                </div>
              </div>
            )}
          </div>

          {/* Напоминание родителю: своя шестерёнка → за сколько минут */}
          <div className="p-3 rounded-lg ep-bg-base">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Напоминание родителю</div>
                <div className="text-xs ep-muted">
                  {parentNotifyOn
                    ? `Письмо родителю за ${parentNotifyMinutes} ${plural(parentNotifyMinutes, 'минуту', 'минуты', 'минут')} до занятия ученика`
                    : 'Выключено — письма не отправляются, даже если у ученика включены свои настройки'}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenNotify(openNotify === 'parent' ? null : 'parent')}
                  className="ep-btn-ghost text-xs py-1.5 px-2"
                  title="За сколько минут до занятия напоминать родителю"
                  aria-label="Настроить напоминание родителю"
                >
                  <i className={`fa-solid fa-gear ${openNotify === 'parent' ? 'ep-accent-color' : ''}`} />
                </button>
                <NotifyToggle
                  checked={parentNotifyOn}
                  onChange={v => updateSettings({ notifyParentLesson: v })}
                />
              </div>
            </div>
            {openNotify === 'parent' && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: 'rgba(91,108,240,0.06)', border: '1px solid rgba(91,108,240,0.18)' }}>
                <div className="text-xs ep-muted mb-2">За сколько минут до занятия напоминать родителю (5–1440)</div>
                <div className="flex items-center gap-2">
                  <input
                    key={`pnm-${parentNotifyMinutes}`}
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={1440}
                    step={5}
                    className="ep-input"
                    style={{ width: 96 }}
                    defaultValue={parentNotifyMinutes}
                    onBlur={e => {
                      const n = Math.round(Number(e.target.value));
                      if (Number.isFinite(n) && n >= 5 && n <= 1440 && n !== parentNotifyMinutes) {
                        updateSettings({ notifyParentLessonMinutes: n });
                      } else {
                        e.target.value = String(parentNotifyMinutes);
                      }
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  />
                  <span className="text-xs ep-muted">минут до начала</span>
                </div>
                <div className="text-xs ep-muted mt-2">
                  Письмо уходит на email родителя из вкладки «Родитель» в карточке ученика.
                  В письме родителю заметки педагога не показываются.
                </div>
              </div>
            )}
          </div>

          <div className="text-xs ep-muted px-1">
            Письма вам уходят на адрес аккаунта ({currentUser?.email || '—'}); напоминания ученикам и родителям —
            на их email из карточек; время московское. Отменённые занятия не напоминаются, в день без занятий письмо не приходит.
            У каждого уведомления своя шестерёнка — время и дни настраиваются отдельно для этого аккаунта.
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="ep-card-static p-6 ep-fade-in" style={{ animationDelay: '0.05s' }}>
        <h4 className="font-bold text-sm mb-4">
          <i className="fa-solid fa-lock mr-2 ep-muted" />
          Изменение пароля
        </h4>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Текущий пароль</label>
            <input
              type="password"
              className="ep-input"
              value={currentPwd}
              onChange={e => { setCurrentPwd(e.target.value); setPwdError(''); setPwdSuccess(false); }}
              placeholder="Введите текущий пароль"
              autoComplete="current-password"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-2 ep-muted">Новый пароль</label>
              <input
                type="password"
                className="ep-input"
                value={newPwd}
                onChange={e => { setNewPwd(e.target.value); setPwdError(''); setPwdSuccess(false); }}
                placeholder="Минимум 4 символа"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 ep-muted">Подтверждение</label>
              <input
                type="password"
                className="ep-input"
                value={confirmPwd}
                onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); setPwdSuccess(false); }}
                placeholder="Повторите пароль"
                autoComplete="new-password"
              />
            </div>
          </div>
          {pwdError && (
            <div className="p-3 rounded-lg text-xs font-semibold" style={{ background: 'rgba(255,92,92,0.1)', border: '1px solid rgba(255,92,92,0.2)', color: 'var(--ep-danger)' }}>
              <i className="fa-solid fa-circle-exclamation mr-1" />{pwdError}
            </div>
          )}
          {pwdSuccess && (
            <div className="p-3 rounded-lg text-xs font-semibold" style={{ background: 'rgba(0,229,160,0.1)', border: '1px solid rgba(0,229,160,0.2)', color: 'var(--ep-accent)' }}>
              <i className="fa-solid fa-circle-check mr-1" />Пароль успешно изменён
            </div>
          )}
          <div className="flex justify-end">
            <button type="submit" className="ep-btn-accent text-sm" disabled={pwdPending}>
              {pwdPending ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin mr-1.5" />Сохранение…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-key mr-1.5" />Сменить пароль
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Theme */}
      <div className="ep-card-static p-6 ep-fade-in" style={{ animationDelay: '0.1s' }}>
        <h4 className="font-bold text-sm mb-4">Оформление</h4>
        <div className="flex items-center justify-between p-3 rounded-lg ep-bg-base">
          <div className="flex items-center gap-3">
            <i className={`fa-solid ${theme === 'dark' ? 'fa-moon' : 'fa-sun'}`} style={{ color: 'var(--ep-accent)' }} />
            <div>
              <div className="text-sm font-semibold">Тема</div>
              <div className="text-xs ep-muted">{theme === 'dark' ? 'Тёмная тема' : 'Светлая тема'}</div>
            </div>
          </div>
          <button className="ep-theme-toggle" onClick={toggleTheme} />
        </div>
      </div>

      {/* About */}
      <div className="ep-card-static p-6 ep-fade-in" style={{ animationDelay: '0.15s' }}>
        <h4 className="font-bold text-sm mb-4">О приложении</h4>
        <div className="space-y-2 text-sm ep-muted">
          <p><strong className="ep-text">EnglishPro</strong> — платформа для управления репетиторством английского языка</p>
          <p>Версия 2.0 · Backend: Next.js API + Prisma (SQLite)</p>
          <p>Данные хранятся на сервере и синхронизируются между всеми вашими устройствами</p>
        </div>
      </div>
    </div>
  );
}

/** Маленький переключатель в фирменном стиле (on — акцентный цвет) */
function NotifyToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer"
      style={{ background: checked ? 'var(--ep-accent)' : 'rgba(128,128,128,0.3)' }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
      />
    </button>
  );
}
