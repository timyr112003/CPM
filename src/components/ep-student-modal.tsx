'use client';

import { useState, useRef } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { EpPhotoEditor } from './ep-photo-editor';
import { SocialNetwork, StudentParent, StudentSocials } from '@/lib/ep-types';
import { SOCIAL_NETWORKS, validateSocialUrl } from '@/lib/ep-socials';

/** Deterministic background colour from a string */
function avatarColor(name: string) {
  const colors = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

/** Extract initials from a name string */
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0][0].toUpperCase();
}

/** Вкладки редактора карточки ученика */
type EditorTab = 'student' | 'parent';

export function EpStudentModal() {
  const editingId = useAppStore(s => s.editingId);
  const students = useAppStore(s => s.students);
  const addStudent = useAppStore(s => s.addStudent);
  const updateStudent = useAppStore(s => s.updateStudent);
  const closeModal = useAppStore(s => s.closeModal);
  const addToast = useAppStore(s => s.addToast);

  const existing = editingId ? students.find(s => s.id === editingId) : null;

  const [activeTab, setActiveTab] = useState<EditorTab>('student');

  const [name, setName] = useState(existing?.name || '');
  const [phone, setPhone] = useState(existing?.phone || '');
  const [email, setEmail] = useState(existing?.email || '');
  const [rate, setRate] = useState(String(existing?.rate || ''));
  const [notes, setNotes] = useState(existing?.notes || '');
  const [balance, setBalance] = useState(String(existing?.balance ?? 0));
  const [birthDate, setBirthDate] = useState(existing?.birthDate || '');
  const [photo, setPhoto] = useState<string | undefined>(existing?.photo);
  const [editingSrc, setEditingSrc] = useState<string | null>(null);

  /* Информация о родителе (вкладка «Родитель») */
  const [parentName, setParentName] = useState(existing?.parent?.name || '');
  const [parentEmail, setParentEmail] = useState(existing?.parent?.email || '');
  const [parentPhone, setParentPhone] = useState(existing?.parent?.phone || '');
  const [parentNotes, setParentNotes] = useState(existing?.parent?.notes || '');

  /* Социальные сети ученика (вкладка «Ученик» — настройки карточки):
     черновики ссылок + ошибки валидации по сетям. */
  const [studentSocialsDraft, setStudentSocialsDraft] = useState<Record<SocialNetwork, string>>({
    vk: existing?.socials?.vk || '',
    telegram: existing?.socials?.telegram || '',
    max: existing?.socials?.max || '',
  });
  const [studentSocialErrors, setStudentSocialErrors] = useState<Partial<Record<SocialNetwork, string>>>({});

  /* Социальные сети родителя (вкладка «Родитель»): черновики ссылок + ошибки валидации по сетям.
     ВАЖНО: берём только из parent.socials — student.socials теперь собственные
     соцсети ученика (редактируются во вкладке «Ученик») и к контактам родителя не относятся. */
  const [socialsDraft, setSocialsDraft] = useState<Record<SocialNetwork, string>>({
    vk: existing?.parent?.socials?.vk || '',
    telegram: existing?.parent?.socials?.telegram || '',
    max: existing?.parent?.socials?.max || '',
  });
  const [socialErrors, setSocialErrors] = useState<Partial<Record<SocialNetwork, string>>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('Пожалуйста, выберите изображение', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast('Файл слишком большой (макс. 5 МБ)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      // Open photo editor instead of directly setting the photo
      setEditingSrc(reader.result as string);
    };
    reader.onerror = () => {
      addToast('Ошибка чтения файла', 'error');
    };
    reader.readAsDataURL(file);

    e.target.value = '';
  };

  const handlePhotoConfirm = (croppedBase64: string) => {
    setPhoto(croppedBase64);
    setEditingSrc(null);
  };

  const handlePhotoCancel = () => {
    setEditingSrc(null);
  };

  const handleRemovePhoto = () => {
    setPhoto(undefined);
  };

  /** Валидация ссылок соцсетей; возвращает объект для сохранения или null при ошибке */
  const buildSocialsFromDraft = (
    draft: Record<SocialNetwork, string>,
    setErrors: React.Dispatch<React.SetStateAction<Partial<Record<SocialNetwork, string>>>>
  ): StudentSocials | undefined | null => {
    const result: StudentSocials = {};
    const errs: Partial<Record<SocialNetwork, string>> = {};
    for (const meta of SOCIAL_NETWORKS) {
      const raw = draft[meta.key].trim();
      if (!raw) continue; // пустое поле — ссылка удаляется
      const res = validateSocialUrl(meta.key, raw);
      if (!res.ok) errs[meta.key] = res.error;
      else result[meta.key] = res.url;
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return null;
    return Object.keys(result).length > 0 ? result : undefined;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Ручная валидация вместо нативной: скрытые на неактивной вкладке
    // поля с required не должны молча блокировать отправку формы
    if (!name.trim()) {
      setActiveTab('student');
      addToast('Укажите имя ученика', 'error');
      return;
    }
    const rateNum = Number(rate);
    if (rate.trim() === '' || Number.isNaN(rateNum) || rateNum < 0) {
      setActiveTab('student');
      addToast('Укажите ставку за час (руб)', 'error');
      return;
    }
    const studentSocials = buildSocialsFromDraft(studentSocialsDraft, setStudentSocialErrors);
    if (studentSocials === null) {
      setActiveTab('student');
      addToast('Проверьте ссылки на социальные сети ученика', 'error');
      return;
    }
    const socials = buildSocialsFromDraft(socialsDraft, setSocialErrors);
    if (socials === null) {
      setActiveTab('parent');
      addToast('Проверьте ссылки на социальные сети', 'error');
      return;
    }

    /* Родитель сохраняется, если заполнено хоть одно поле (включая соцсети) */
    const pName = parentName.trim();
    const pEmail = parentEmail.trim();
    const pPhone = parentPhone.trim();
    const pNotes = parentNotes.trim();
    const parent: StudentParent | undefined =
      (pName || pEmail || pPhone || pNotes || socials)
        ? { name: pName, email: pEmail, phone: pPhone, notes: pNotes, socials }
        : undefined;

    const data = { name, phone, email, rate: rateNum, notes, balance: Number(balance), birthDate: birthDate || undefined, photo, parent, socials: studentSocials };
    if (editingId) {
      updateStudent(editingId, data);
      addToast('Данные обновлены', 'success');
    } else {
      addStudent(data);
      addToast('Ученик добавлен', 'success');
    }
    closeModal();
  };

  // If photo editor is open, show it instead of the form
  if (editingSrc) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold">{existing ? 'Редактировать ученика' : 'Новый ученик'}</h3>
        <div className="flex justify-center">
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
    <div className="space-y-4">
      <h3 className="text-lg font-bold">{existing ? 'Редактировать ученика' : 'Новый ученик'}</h3>

      {/* ── Photo upload area ─────────────────────────────── */}
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative w-20 h-20 rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ border: '2px dashed var(--ep-border, #ccc)' }}
          aria-label="Загрузить фото"
        >
          {photo ? (
            <img
              src={photo}
              alt={name || 'Фото ученика'}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full rounded-full flex items-center justify-center text-white text-2xl font-bold select-none"
              style={{ backgroundColor: avatarColor(name || 'U') }}
            >
              {initials(name || 'U')}
            </div>
          )}

          {/* Camera overlay on hover */}
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <i className="fa-solid fa-camera text-white text-lg" />
          </div>
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Remove photo link */}
        {photo && (
          <button
            type="button"
            onClick={handleRemovePhoto}
            className="text-xs text-red-500 hover:text-red-700 hover:underline transition-colors"
          >
            Удалить фото
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Вкладки: Ученик / Родитель ───────────────────── */}
        <div className="flex rounded-lg p-1 ep-bg-base" role="tablist" aria-label="Разделы карточки ученика">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'student'}
            onClick={() => setActiveTab('student')}
            className="flex-1 py-2 rounded-md text-sm font-semibold transition-all"
            style={{
              background: activeTab === 'student' ? 'var(--ep-accent)' : 'transparent',
              color: activeTab === 'student' ? '#080b12' : 'var(--ep-muted)',
            }}
          >
            <i className="fa-solid fa-user mr-1.5" />Ученик
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'parent'}
            onClick={() => setActiveTab('parent')}
            className="flex-1 py-2 rounded-md text-sm font-semibold transition-all"
            style={{
              background: activeTab === 'parent' ? 'var(--ep-accent)' : 'transparent',
              color: activeTab === 'parent' ? '#080b12' : 'var(--ep-muted)',
            }}
          >
            <i className="fa-solid fa-user-group mr-1.5" />Родитель
          </button>
        </div>

        {/* ── Вкладка «Ученик» ─────────────────────────────── */}
        <div className={activeTab === 'student' ? 'space-y-4' : 'hidden'} role="tabpanel">
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Имя</label>
            <input type="text" className="ep-input" value={name} onChange={e => setName(e.target.value)} placeholder="Имя Фамилия" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-2 ep-muted">Телефон</label>
              <input type="tel" className="ep-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 900 000-00-00" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 ep-muted">Email</label>
              <input type="text" inputMode="email" className="ep-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@mail.ru" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Дата рождения</label>
            <input
              type="date"
              className="ep-input"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
            {birthDate && (
              <div className="text-xs mt-1 ep-muted">
                <i className="fa-solid fa-cake-candles mr-1" style={{ color: '#ff6fae' }} />
                Будут созданы напоминания за 3 дня, за 1 день и в день рождения
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-2 ep-muted">Ставка за час (руб)</label>
              <input type="number" className="ep-input" value={rate} onChange={e => setRate(e.target.value)} placeholder="1500" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 ep-muted">
                Баланс (руб)
                <span className="ml-1 font-normal">{' '}
                  {Number(balance) > 0 && <span style={{ color: 'var(--ep-accent)' }}><i className="fa-solid fa-circle-check text-xs mr-0.5" />Положительный</span>}
                  {Number(balance) < 0 && <span style={{ color: 'var(--ep-danger)' }}><i className="fa-solid fa-circle-exclamation text-xs mr-0.5" />Долг</span>}
                  {Number(balance) === 0 && <span className="ep-muted">Ноль</span>}
                </span>
              </label>
              <input type="number" className="ep-input" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Заметки</label>
            <input type="text" className="ep-input" value={notes} onChange={e => { if (e.target.value.length <= 60) setNotes(e.target.value); }} placeholder="Цели, уровень, пожелания..." maxLength={60} />
            <div className="text-xs mt-1 text-right ep-muted">{notes.length}/60</div>
          </div>
          {/* ── Социальные сети ученика (настройки карточки) ── */}
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">
              <i className="fa-solid fa-share-nodes mr-1.5" />Социальные сети ученика
            </label>
            <div className="space-y-2">
              {SOCIAL_NETWORKS.map(meta => (
                <div key={meta.key}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-xs"
                      style={{ background: `${meta.color}22`, color: meta.color }}
                      title={meta.label}
                    >
                      {meta.iconClass ? <i className={meta.iconClass} /> : <span className="font-bold">{meta.badgeText}</span>}
                    </div>
                    <input
                      type="text"
                      inputMode="url"
                      className="ep-input flex-1 min-w-0"
                      value={studentSocialsDraft[meta.key]}
                      onChange={e => {
                        setStudentSocialsDraft(prev => ({ ...prev, [meta.key]: e.target.value }));
                        setStudentSocialErrors(prev => ({ ...prev, [meta.key]: undefined }));
                      }}
                      placeholder={`${meta.label}: ${meta.placeholder}`}
                      aria-label={`Ссылка ${meta.label} ученика`}
                    />
                  </div>
                  {studentSocialErrors[meta.key] && (
                    <div className="text-xs mt-1 ml-9 font-semibold" style={{ color: 'var(--ep-danger)' }}>
                      <i className="fa-solid fa-circle-exclamation mr-1" />{studentSocialErrors[meta.key]}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="text-xs mt-1.5 ep-muted">
              Оставьте поле пустым, чтобы удалить ссылку. Добавленные сети появятся значками на карточке ученика.
            </div>
          </div>
        </div>

        {/* ── Вкладка «Родитель»: контакты для связи ───────── */}
        <div className={activeTab === 'parent' ? 'space-y-4' : 'hidden'} role="tabpanel">
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Имя</label>
            <input type="text" className="ep-input" value={parentName} onChange={e => setParentName(e.target.value)} placeholder="Иванова Мария (мама)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-2 ep-muted">Почта</label>
              <input type="text" inputMode="email" className="ep-input" value={parentEmail} onChange={e => setParentEmail(e.target.value)} placeholder="parent@mail.ru" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2 ep-muted">Номер телефона</label>
              <input type="tel" className="ep-input" value={parentPhone} onChange={e => setParentPhone(e.target.value)} placeholder="+7 900 000-00-00" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">Заметки</label>
            <input type="text" className="ep-input" value={parentNotes} onChange={e => { if (e.target.value.length <= 200) setParentNotes(e.target.value); }} placeholder="Удобное время связи, кто оплачивает занятия..." maxLength={200} />
            <div className="text-xs mt-1 text-right ep-muted">{parentNotes.length}/200</div>
          </div>
          {/* ── Социальные сети родителя ───────────────────── */}
          <div>
            <label className="block text-xs font-semibold mb-2 ep-muted">
              <i className="fa-solid fa-share-nodes mr-1.5" />Социальные сети
            </label>
            <div className="space-y-2">
              {SOCIAL_NETWORKS.map(meta => (
                <div key={meta.key}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-xs"
                      style={{ background: `${meta.color}22`, color: meta.color }}
                      title={meta.label}
                    >
                      {meta.iconClass ? <i className={meta.iconClass} /> : <span className="font-bold">{meta.badgeText}</span>}
                    </div>
                    <input
                      type="text"
                      inputMode="url"
                      className="ep-input flex-1 min-w-0"
                      value={socialsDraft[meta.key]}
                      onChange={e => {
                        setSocialsDraft(prev => ({ ...prev, [meta.key]: e.target.value }));
                        setSocialErrors(prev => ({ ...prev, [meta.key]: undefined }));
                      }}
                      placeholder={`${meta.label}: ${meta.placeholder}`}
                      aria-label={`Ссылка ${meta.label}`}
                    />
                  </div>
                  {socialErrors[meta.key] && (
                    <div className="text-xs mt-1 ml-9 font-semibold" style={{ color: 'var(--ep-danger)' }}>
                      <i className="fa-solid fa-circle-exclamation mr-1" />{socialErrors[meta.key]}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="text-xs mt-1.5 ep-muted">
              Оставьте поле пустым, чтобы удалить ссылку
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={closeModal} className="ep-btn-ghost">Отмена</button>
          <button type="submit" className="ep-btn-accent">{existing ? 'Сохранить' : 'Добавить'}</button>
        </div>
      </form>
    </div>
  );
}
