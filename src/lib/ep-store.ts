import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Student, ClassGroup, Lesson, FinanceEntry,
  PageType, RecurringPattern, LessonCancellation, CancellationParty,
  AppSettings, DEFAULT_SETTINGS, LessonAttendance, Subscription,
  StudentNotifySettings,
  UserRole, isAdminRoles, hasTeacherRole, isHybridRoles,
} from './ep-types';
import { getActiveSubscription, getSubStatus, subLessonsLeft, todayStr, fmtDateDMY, findOverlappingSubscription } from './ep-subscriptions';
import { applyData, captureLegacy, captureLegacyEarly, clearLocalDataWithBackup, isEmptyData, pullData, pushData, resetLocalData } from './ep-sync';

export type { PageType } from './ep-types';
import { genId, fmtDate, parseDate, normalizeStudentsParentFields } from './ep-utils';

/** Часть состояния, которая сохраняется в localStorage (офлайн-кэш) */
type PersistedData = Pick<
  AppState,
  'students' | 'classes' | 'schedule' | 'finance' | 'subscriptions' | 'theme' | 'settings' | 'dataOwnerId' | 'activeCabinet'
>;

/** Ранний захват данных старой локальной версии (до создания store и
 *  гидрации persist, которая перезаписывает хранилище в формат v1) */
if (typeof window !== 'undefined') {
  captureLegacyEarly();
}

/** Какой кабинет открыт (для аккаунтов с несколькими ролями).
 *  null — кабинет ещё не выбран: гибриду после входа показываем экран выбора */
export type ActiveCabinet = 'teacher' | 'admin' | null;

export interface LoginResult {
  ok: boolean;
  error?: string;
}

interface AppState {
  // Auth
  currentUser: { id: string; name: string; email: string; photo?: string; roles: UserRole[]; mustChangePassword?: boolean } | null;
  /** Сессия проверена на сервере (initAuth выполнен) */
  authChecked: boolean;
  /** Чей аккаунт открыт в режиме управления (имперсонация); null — работаем со своим аккаунтом */
  viewing: { id: string; name: string; email: string } | null;
  /** Владелец данных в localStorage: при несовпадении с активным пользователем кэш сбрасывается */
  dataOwnerId: string | undefined;
  /** Активный кабинет (учительский/административный) — выбор после входа, переключение без реавторизации */
  activeCabinet: ActiveCabinet;

  // Data
  students: Student[];
  classes: ClassGroup[];
  schedule: Lesson[];
  finance: FinanceEntry[];
  subscriptions: Subscription[];

  // UI
  currentPage: PageType;
  theme: 'dark' | 'light';
  calView: 'month' | 'week' | 'day';
  calMonth: number;
  calYear: number;
  calSelected: string | null;
  weekOffset: number;
  calDayDate: string;
  finMonth: number;
  finYear: number;

  // Modal state
  activeModal: string | null;
  editingId: string | null;
  modalContext: Record<string, string>;

  // Confirm dialog
  confirmDialog: {
    message: string;
    onConfirm: () => void;
    confirmLabel?: string;
    confirmIcon?: string;
    danger?: boolean;
  } | null;

  // Toast
  toasts: { id: string; message: string; type: 'success' | 'error' | 'info' }[];

  // Actions - Auth
  /** Проверка сессии на сервере + загрузка данных. Вызывается один раз при старте */
  initAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  /** Переключить кабинет (учительский ↔ административный) без повторного входа */
  setActiveCabinet: (cabinet: 'teacher' | 'admin') => void;
  /** Войти в аккаунт пользователя в режиме управления (impersonation) */
  startImpersonation: (userId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Выйти из режима управления — возврат в свой аккаунт */
  stopImpersonation: () => Promise<void>;

  // Actions - Navigation
  navigate: (page: PageType) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;

  // Actions - Calendar
  setCalView: (view: 'month' | 'week' | 'day') => void;
  setCalMonth: (m: number) => void;
  setCalYear: (y: number) => void;
  setCalSelected: (d: string | null) => void;
  setWeekOffset: (o: number) => void;
  setCalDayDate: (d: string) => void;
  setFinMonth: (m: number) => void;
  setFinYear: (y: number) => void;

  // Actions - Modal
  openModal: (modal: string, editId?: string, context?: Record<string, string>) => void;
  closeModal: () => void;

  // Actions - Confirm
  openConfirm: (
    message: string,
    onConfirm: () => void,
    options?: { confirmLabel?: string; confirmIcon?: string; danger?: boolean }
  ) => void;
  closeConfirm: () => void;

  // Actions - Toast
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  // Actions - Students
  addStudent: (s: Omit<Student, 'id'>) => void;
  updateStudent: (id: string, s: Omit<Student, 'id'>) => void;
  /** Личные настройки напоминаний ученика (шестерёнка «Настройки» на карточке); undefined — «как у всех» */
  updateStudentNotify: (id: string, notify: StudentNotifySettings | undefined) => void;
  deleteStudent: (id: string) => void;
  deleteStudentKeepLessons: (id: string) => void;
  archiveStudent: (id: string) => void;
  unarchiveStudent: (id: string) => void;

  // Actions - Password
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;

  // Actions - Classes
  addClass: (c: Omit<ClassGroup, 'id'>) => void;
  updateClass: (id: string, c: Omit<ClassGroup, 'id'>) => void;
  deleteClass: (id: string) => void;

  // Settings
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;

  // Actions - Lessons
  addLesson: (l: Lesson) => void;
  addRecurringLessons: (l: Omit<Lesson, 'id' | 'recurringGroupId'>, pattern: RecurringPattern) => number;
  updateLesson: (id: string, l: Lesson) => void;
  deleteLesson: (id: string) => void;
  deleteRecurringLessons: (groupId: string) => void;
  changeLessonStatus: (id: string, status: 'planned' | 'completed' | 'cancelled', opts?: { manualChargeAmount?: number }) => void;
  completeLessonWithAttendance: (id: string, attendance: LessonAttendance[]) => void;
  cancelLessonWithPenalty: (id: string, reason: string, cancelledBy: CancellationParty, penaltyAmount?: number) => void;
  moveLesson: (id: string, date: string, time: string) => void;

  // Actions - Finance
  addFinance: (f: Omit<FinanceEntry, 'id'>) => void;
  updateFinance: (id: string, f: Omit<FinanceEntry, 'id'>) => void;
  deleteFinance: (id: string) => void;

  // Actions - Balance
  adjustBalance: (studentId: string, amount: number, description: string) => void;

  // Actions - Subscriptions (абонементы)
  addSubscription: (input: { studentId: string; totalLessons: number; startDate: string; endDate: string; price: number }) => { ok: boolean; message?: string };
  updateSubscription: (id: string, patch: { totalLessons?: number; startDate?: string; endDate?: string }) => { ok: boolean; message?: string };
  toggleFreezeSubscription: (id: string) => void;
  archiveSubscription: (id: string) => void;
  unarchiveSubscription: (id: string) => void;
  deleteSubscription: (id: string) => void;
  /** Проверка пересечения периодов для предупреждения в форме (не изменяет данные) */
  checkSubscriptionOverlap: (studentId: string, startDate: string, endDate: string, excludeId?: string) => Subscription | null;

  // Actions - Profile
  updateCurrentUser: (data: { name?: string; email?: string; photo?: string }) => Promise<{ ok: boolean; error?: string }>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      authChecked: false,
      viewing: null,
      dataOwnerId: undefined,
      activeCabinet: null,
      students: [],
      classes: [],
      schedule: [],
      finance: [],
      subscriptions: [],
      settings: DEFAULT_SETTINGS,
      currentPage: 'dashboard',
      theme: 'dark',
      calView: 'week',
      calMonth: new Date().getMonth(),
      calYear: new Date().getFullYear(),
      calSelected: null,
      weekOffset: 0,
      calDayDate: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })(),
      finMonth: new Date().getMonth(),
      finYear: new Date().getFullYear(),
      activeModal: null,
      editingId: null,
      modalContext: {},
      confirmDialog: null,
      toasts: [],

      /* ═══════════ АВТОРИЗАЦИЯ (серверная) ═══════════ */

      initAuth: async () => {
        // Фиксируем данные старой локальной версии до любых перезаписей хранилища
        captureLegacy();
        try {
          const res = await fetch('/api/auth/me', { cache: 'no-store' });
          if (res.ok) {
            const json = await res.json().catch(() => null);
            const u = json?.user;
            const impersonating = (json?.impersonating ?? null) as { id: string; name: string; email: string } | null;
            if (u?.id) {
              const effId = impersonating?.id ?? u.id;
              // Защита от смешивания данных: если в кэше данные другого пользователя — сбрасываем
              if (get().dataOwnerId && get().dataOwnerId !== effId) resetLocalData();
              const roles: UserRole[] = Array.isArray(u.roles) && u.roles.length ? u.roles : ['TEACHER'];
              // Активный кабинет приводим в соответствие ролям: у одноролевого
              // аккаунта выбора нет; у гибрида остаётся прежний выбор (или null → экран выбора)
              const persisted = get().activeCabinet;
              const cabinet: ActiveCabinet = isHybridRoles(roles)
                ? persisted ?? null
                : isAdminRoles(roles)
                  ? 'admin'
                  : 'teacher';
              set({
                currentUser: {
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  photo: u.photo || undefined,
                  roles,
                  mustChangePassword: !!u.mustChangePassword,
                },
                viewing: impersonating,
                activeCabinet: cabinet,
              });
              await pullData();
              set({ dataOwnerId: effId });
            } else {
              set({ currentUser: null, viewing: null });
            }
          } else {
            set({ currentUser: null, viewing: null });
          }
        } catch {
          set({ currentUser: null, viewing: null });
        } finally {
          set({ authChecked: true });
        }
      },

      login: async (email, password) => {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok)
            return { ok: false, error: json?.error || `Не удалось войти (код ${res.status})` };
          const u = json.user as {
            id: string; name: string; email: string; photo?: string | null;
            roles?: UserRole[]; mustChangePassword?: boolean;
          };

          const roles: UserRole[] = Array.isArray(u.roles) && u.roles.length ? u.roles : ['TEACHER'];
          const legacy = captureLegacy();
          // Защита от смешивания данных: в кэше данные другого аккаунта — сброс
          if (get().dataOwnerId && get().dataOwnerId !== u.id) resetLocalData();
          set({
            currentUser: {
              id: u.id,
              name: u.name,
              email: u.email,
              photo: u.photo || undefined,
              roles,
              mustChangePassword: !!u.mustChangePassword,
            },
            viewing: null,
            // Кабинет всегда выбираем заново: у гибрида после входа — экран выбора,
            // у одноролевого — единственно возможный
            activeCabinet: isAdminRoles(roles) && !hasTeacherRole(roles)
              ? 'admin'
              : hasTeacherRole(roles) && !isAdminRoles(roles)
                ? 'teacher'
                : null,
          });

          const remote = await pullData();
          set({ dataOwnerId: u.id });
          if (isEmptyData(remote)) {
            const emailMatch = legacy.emails.includes(String(u.email || '').trim().toLowerCase());
            if (legacy.data && !isEmptyData(legacy.data) && emailMatch) {
              // Автоперенос данных старой локальной версии на сервер
              applyData(legacy.data);
              void pushData();
              get().addToast('Локальные данные перенесены на сервер', 'success');
            } else {
              // Новый аккаунт — начинаем с чистого листа (прежние данные в резервной копии)
              clearLocalDataWithBackup();
            }
          }
          return { ok: true };
        } catch {
          return { ok: false, error: 'Нет соединения с сервером. Проверьте интернет и обновите страницу' };
        }
      },

      logout: async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
          /* ignore */
        }
        set({ currentUser: null, viewing: null, activeCabinet: null, authChecked: true });
      },

      setActiveCabinet: (cabinet) => {
        set({ activeCabinet: cabinet });
      },

      startImpersonation: async (userId) => {
        try {
          const res = await fetch(`/api/admin/users/${userId}/impersonate`, { method: 'POST' });
          const json = await res.json().catch(() => null);
          if (!res.ok) return { ok: false, error: json?.error || 'Не удалось открыть аккаунт' };
          // Полная перезагрузка: boot-последовательность сама подтянет данные ученика
          window.location.reload();
          return { ok: true };
        } catch {
          return { ok: false, error: 'Нет соединения с сервером' };
        }
      },

      stopImpersonation: async () => {
        try {
          await fetch('/api/admin/impersonate', { method: 'DELETE' });
        } catch {
          /* ignore */
        }
        window.location.reload();
      },

      navigate: (page) => set({ currentPage: page }),

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set(s => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      setCalView: (view) => set({ calView: view }),
      setCalMonth: (m) => set({ calMonth: m }),
      setCalYear: (y) => set({ calYear: y }),
      setCalSelected: (d) => set({ calSelected: d }),
      setWeekOffset: (o) => set({ weekOffset: o }),
      setCalDayDate: (d) => set({ calDayDate: d }),
      setFinMonth: (m) => set({ finMonth: m }),
      setFinYear: (y) => set({ finYear: y }),

      openModal: (modal, editId, context) => set({
        activeModal: modal,
        editingId: editId || null,
        modalContext: context || {},
      }),
      closeModal: () => set({ activeModal: null, editingId: null, modalContext: {} }),

      openConfirm: (message, onConfirm, options) => set({
        confirmDialog: {
          message,
          onConfirm,
          confirmLabel: options?.confirmLabel,
          confirmIcon: options?.confirmIcon,
          danger: options?.danger ?? true,
        },
      }),
      closeConfirm: () => set({ confirmDialog: null }),

      addToast: (message, type = 'success') => {
        const id = genId();
        set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
        setTimeout(() => get().removeToast(id), 3000);
      },
      removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

      addStudent: (s) => set(state => ({ students: [...state.students, { ...s, id: genId() }] })),
      // merge поверх существующего: payload формы не содержит archived/archivedAt —
      // полная замена теряла бы статус архива при редактировании архивного ученика
      updateStudent: (id, s) => set(state => ({
        students: state.students.map(st => st.id === id ? { ...st, ...s, id } : st),
      })),
      // Личные настройки напоминаний: mode 'inherit' храним как undefined —
      // без своего режима поле не нужно ни в стор, ни в снапшот
      updateStudentNotify: (id, notify) => set(state => ({
        students: state.students.map(st => {
          if (st.id !== id) return st;
          const { notify: _drop, ...rest } = st;
          return notify && notify.mode === 'custom' ? { ...rest, notify } : rest;
        }),
      })),
      deleteStudent: (id) => set(state => ({
        students: state.students.filter(s => s.id !== id),
        classes: state.classes.map(c => ({ ...c, studentIds: c.studentIds.filter(sid => sid !== id) })),
        subscriptions: state.subscriptions.filter(sub => sub.studentId !== id),
        // Удаляем только запланированные уроки этого ученика (индивидуальные);
        // проведённые и отменённые оставляем как историю, но убираем ученика из studentIds/attendance
        schedule: state.schedule
          .filter(l => !(l.status === 'planned' && !l.isGroup && l.studentId === id))
          .map(l => {
            if (!l.studentIds.includes(id) && l.studentId !== id) return l;
            return {
              ...l,
              studentIds: l.studentIds.filter(sid => sid !== id),
              attendance: l.attendance?.filter(a => a.studentId !== id),
            };
          }),
      })),
      deleteStudentKeepLessons: (id) => set(state => ({
        students: state.students.filter(s => s.id !== id),
        classes: state.classes.map(c => ({ ...c, studentIds: c.studentIds.filter(sid => sid !== id) })),
        subscriptions: state.subscriptions.filter(sub => sub.studentId !== id),
      })),
      archiveStudent: (id) => set(state => ({
        students: state.students.map(s => s.id === id ? { ...s, archived: true, archivedAt: fmtDate(new Date()) } : s),
      })),
      unarchiveStudent: (id) => set(state => ({
        students: state.students.map(s => s.id === id ? { ...s, archived: false, archivedAt: undefined } : s),
      })),

      changePassword: async (currentPassword, newPassword) => {
        try {
          const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword }),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok) return { ok: false, error: json?.error || 'Не удалось изменить пароль' };
          const cur = get().currentUser;
          if (cur) set({ currentUser: { ...cur, mustChangePassword: false } });
          return { ok: true };
        } catch {
          return { ok: false, error: 'Нет соединения с сервером' };
        }
      },

      addClass: (c) => set(state => ({ classes: [...state.classes, { ...c, id: genId() }] })),
      updateClass: (id, c) => set(state => ({
        classes: state.classes.map(cl => cl.id === id ? { ...c, id } : cl),
      })),
      deleteClass: (id) => set(state => ({
        classes: state.classes.filter(c => c.id !== id),
      })),

      addLesson: (l) => set(state => ({
        schedule: [...state.schedule, l].sort((a, b) =>
          a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
        ),
      })),

      addRecurringLessons: (lessonTemplate, pattern) => {
        const groupId = genId();
        const startDate = parseDate(lessonTemplate.date);
        const endDate = parseDate(pattern.endDate);
        const newLessons: Lesson[] = [];

        // Iterate each day from startDate to endDate
        const current = new Date(startDate);
        while (current <= endDate) {
          const dow = (current.getDay() + 6) % 7; // 0=Mon, 6=Sun
          if (pattern.daysOfWeek.includes(dow)) {
            const ds = fmtDate(current);
            if (ds >= lessonTemplate.date) {
              newLessons.push({
                ...lessonTemplate,
                id: genId(),
                date: ds,
                recurringGroupId: groupId,
              });
            }
          }
          current.setDate(current.getDate() + 1);
        }

        set(state => ({
          schedule: [...state.schedule, ...newLessons].sort((a, b) =>
            a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
          ),
        }));

        return newLessons.length;
      },
      updateLesson: (id, l) => set(state => ({
        schedule: state.schedule.map(le => le.id === id ? l : le)
          .sort((a, b) => a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)),
      })),
      deleteLesson: (id) => set(state => ({ schedule: state.schedule.filter(l => l.id !== id) })),

      deleteRecurringLessons: (groupId) => set(state => ({
        schedule: state.schedule.filter(l => l.recurringGroupId !== groupId),
      })),

      changeLessonStatus: (id, status, opts) => {
        const state = get();
        const lesson = state.schedule.find(l => l.id === id);
        if (!lesson) return;
        const prevStatus = lesson.status;
        const updated = { ...lesson, status, cancellation: status !== 'cancelled' ? undefined : lesson.cancellation, balanceCharge: status === 'completed' ? lesson.balanceCharge : undefined };
        set({ schedule: state.schedule.map(l => l.id === id ? updated : l) });

        // ── Revert cancelled side-effects (refund penalty) ──
        if (prevStatus === 'cancelled' && status !== 'cancelled') {
          const penalty = lesson.cancellation?.penaltyAmount || 0;
          if (penalty > 0) {
            // Refund penalty to student balance
            const targetStudentIds = lesson.studentIds || (lesson.studentId ? [lesson.studentId] : []);
            if (targetStudentIds.length > 0) {
              set(st => ({
                students: st.students.map(s =>
                  targetStudentIds.includes(s.id) ? { ...s, balance: (s.balance || 0) + penalty } : s
                ),
              }));
            }
            // Remove penalty finance entry (try lessonId first, fallback to category+date+amount)
            const penaltyFin = state.finance.find(f =>
              f.lessonId === id && f.category === 'Штраф за отмену'
            ) || state.finance.find(f =>
              f.category === 'Штраф за отмену' && f.date === lesson.date && f.amount === penalty
            );
            if (penaltyFin) {
              set(st => ({ finance: st.finance.filter(f => f.id !== penaltyFin.id) }));
            }
            get().addToast(`Штраф ${penalty.toLocaleString('ru-RU')} ₽ возвращен`, 'success');
          }
        }

        // ── Revert completed side-effects ──
        if (prevStatus === 'completed' && status !== 'completed') {
          // Remove finance income entry if it was auto-created for this lesson
          const finEntry = state.finance.find(f => f.lessonId === id && f.category !== 'Штраф за отмену');
          if (finEntry) {
            set(st => ({ finance: st.finance.filter(f => f.id !== finEntry.id) }));
          }
          // Ученики, за которых занятие было списано с абонемента
          const subDeducted = lesson.subscriptionDeductions || [];
          const targetStudentIds = (lesson.studentIds || (lesson.studentId ? [lesson.studentId] : []))
            .filter(sid => !subDeducted.includes(sid));
          // Сколько фактически было списано с баланса (при ручном списании может отличаться от цены урока)
          const chargedAmount = lesson.balanceCharge ?? lesson.price;
          // Restore balance only for those who paid from balance
          if (targetStudentIds.length > 0) {
            set(st => ({
              students: st.students.map(s =>
                targetStudentIds.includes(s.id) ? { ...s, balance: (s.balance || 0) + chargedAmount } : s
              ),
            }));
          }
          // Возвращаем списанные занятия в абонементы
          if (subDeducted.length > 0) {
            const today = todayStr();
            for (const sid of subDeducted) {
              const subs = get().subscriptions;
              let target = getActiveSubscription(subs, sid, today);
              if (!target) {
                const started = subs
                  .filter(s => s.studentId === sid && !s.archived && s.usedLessons > 0 && s.startDate <= today)
                  .sort((a, b) =>
                    ((a.endDate >= today ? 0 : 1) - (b.endDate >= today ? 0 : 1)) ||
                    b.startDate.localeCompare(a.startDate)
                  );
                target = started[0] || null;
              }
              if (target) {
                const tid = target.id;
                set(st => ({
                  subscriptions: st.subscriptions.map(s =>
                    s.id === tid ? { ...s, usedLessons: Math.max(0, s.usedLessons - 1) } : s
                  ),
                }));
              }
            }
          }
        }

        // ── Apply completed side-effects ──
        if (status === 'completed' && prevStatus !== 'completed') {
          // ── Ручное списание с баланса (явное действие репетитора) ──
          // Урок проводится с оплатой с баланса на указанную сумму;
          // абонемент (даже активный) в этом случае не затрагивается — двойного списания нет.
          const manualCharge = opts?.manualChargeAmount;
          if (manualCharge !== undefined && !lesson.isGroup) {
            const amount = Math.max(0, Math.round(manualCharge));
            const targetStudentIds = lesson.studentIds || (lesson.studentId ? [lesson.studentId] : []);
            const sid = targetStudentIds[0];
            const student = get().students.find(s => s.id === sid);
            if (!student) return;
            const newBalance = (student.balance || 0) - amount;
            set(st => ({
              students: st.students.map(s => s.id === sid ? { ...s, balance: newBalance } : s),
            }));
            const newFin: FinanceEntry = {
              id: genId(), date: lesson.date, type: 'income',
              category: 'Оплата за урок', amount,
              description: 'Урок (ручное списание с баланса): ' + lesson.topic,
              lessonId: id,
            };
            set(st => ({ finance: [...st.finance, newFin] }));
            // Фиксируем фактически списанную сумму для корректного отката;
            // абонемент не задействован
            set(st => ({
              schedule: st.schedule.map(l =>
                l.id === id ? { ...l, subscriptionDeductions: undefined, balanceCharge: amount } : l
              ),
            }));
            if (newBalance < 0) {
              get().addToast(`Баланс стал отрицательным: ${newBalance.toLocaleString('ru-RU')} ₽`, 'error');
            }
            get().addToast(`Урок проведён. Списано с баланса: ${amount.toLocaleString('ru-RU')} ₽`, 'success');
            return;
          }

          // Разделяем учеников: с активным абонементом / с оплатой с баланса
          const today = todayStr();
          const targetStudentIds = lesson.studentIds || (lesson.studentId ? [lesson.studentId] : []);
          const subDeductedIds: string[] = [];
          const payStudentIds: string[] = [];
          for (const sid of targetStudentIds) {
            const sub = getActiveSubscription(get().subscriptions, sid, today);
            if (sub) subDeductedIds.push(sid);
            else payStudentIds.push(sid);
          }

          // Списываем по 1 занятию с текущего активного абонемента каждого ученика
          if (subDeductedIds.length > 0) {
            const subIds = subDeductedIds
              .map(sid => getActiveSubscription(get().subscriptions, sid, today)?.id)
              .filter((x): x is string => !!x);
            set(st => ({
              subscriptions: st.subscriptions.map(s =>
                subIds.includes(s.id) ? { ...s, usedLessons: Math.min(s.totalLessons, s.usedLessons + 1) } : s
              ),
            }));
          }

          // Финансовая запись и списание баланса — только для оплачивающих с баланса
          if (payStudentIds.length > 0) {
            const newFin: FinanceEntry = {
              id: genId(), date: lesson.date, type: 'income',
              category: 'Оплата за урок', amount: lesson.price * payStudentIds.length,
              description: 'Урок' + (lesson.isGroup ? ' (группа)' : '') + ': ' + lesson.topic,
              lessonId: id,
            };
            set(st => ({ finance: [...st.finance, newFin] }));
            const students = get().students;
            const updatedStudents = students.map(s => {
              if (payStudentIds.includes(s.id)) {
                return { ...s, balance: (s.balance || 0) - lesson.price };
              }
              return s;
            });
            set({ students: updatedStudents });
            // Show balance warning if negative
            const negStudents = updatedStudents.filter(s => payStudentIds.includes(s.id) && s.balance < 0);
            if (negStudents.length > 0) {
              const names = negStudents.map(s => `${s.name} (${s.balance.toLocaleString('ru-RU')} ₽)`).join(', ');
              get().addToast(`Отрицательный баланс: ${names}`, 'error');
            }
          }

          // Фиксируем, за кого списано с абонемента (для корректного отката)
          set(st => ({
            schedule: st.schedule.map(l =>
              l.id === id
                ? { ...l, subscriptionDeductions: subDeductedIds.length > 0 ? subDeductedIds : undefined }
                : l
            ),
          }));

          if (subDeductedIds.length > 0 && payStudentIds.length === 0) {
            get().addToast('Урок проведён. Занятие списано с абонемента', 'success');
          } else if (subDeductedIds.length > 0) {
            get().addToast(`Урок проведён. По абонементу: ${subDeductedIds.length}`, 'success');
          } else {
            get().addToast('Урок проведён, доход учтён', 'success');
          }
        } else if (status === 'cancelled') {
          get().addToast('Урок отменён', 'success');
        } else if (status === 'planned') {
          get().addToast('Статус сброшен: запланирован', 'info');
        }
      },

      moveLesson: (id, date, time) => {
        const state = get();
        const lesson = state.schedule.find(l => l.id === id);
        if (!lesson) return;
        set({
          schedule: state.schedule.map(l => l.id === id ? { ...l, date, time } : l),
        });
      },

      completeLessonWithAttendance: (id, attendance) => {
        const state = get();
        const lesson = state.schedule.find(l => l.id === id);
        if (!lesson) return;

        // Charge present students, penalize absent
        const presentStudents = attendance.filter(a => a.present);
        const absentStudents = attendance.filter(a => !a.present);

        // Разделяем присутствующих: с активным абонементом / с оплатой с баланса
        const today = todayStr();
        const subDeductedIds: string[] = [];
        const payStudentIds: string[] = [];
        const subIdsToDeduct: string[] = [];
        for (const p of presentStudents) {
          const sub = getActiveSubscription(state.subscriptions, p.studentId, today);
          if (sub) {
            subDeductedIds.push(p.studentId);
            subIdsToDeduct.push(sub.id);
          } else {
            payStudentIds.push(p.studentId);
          }
        }

        // Update lesson status and save attendance (+ фиксируем списания с абонементов)
        const updated = {
          ...lesson,
          status: 'completed' as const,
          attendance,
          subscriptionDeductions: subDeductedIds.length > 0 ? subDeductedIds : undefined,
        };
        set({ schedule: state.schedule.map(l => l.id === id ? updated : l) });

        // Списываем по 1 занятию с текущего активного абонемента каждого присутствующего
        if (subIdsToDeduct.length > 0) {
          set(st => ({
            subscriptions: st.subscriptions.map(s =>
              subIdsToDeduct.includes(s.id)
                ? { ...s, usedLessons: Math.min(s.totalLessons, s.usedLessons + 1) }
                : s
            ),
          }));
        }

        // Create finance entry for balance-paid students' income
        const incomeAmount = lesson.price * payStudentIds.length;
        if (incomeAmount > 0) {
          const newFin: FinanceEntry = {
            id: genId(), date: lesson.date, type: 'income',
            category: 'Оплата за урок', amount: incomeAmount,
            description: `Урок (группа): ${lesson.topic}. Присутствовало: ${presentStudents.length}`,
            lessonId: id,
          };
          set(st => ({ finance: [...st.finance, newFin] }));
        }

        // Deduct balance only for students without subscription
        if (payStudentIds.length > 0) {
          const students = get().students;
          const updatedStudents = students.map(s => {
            if (payStudentIds.includes(s.id)) {
              return { ...s, balance: (s.balance || 0) - lesson.price };
            }
            return s;
          });
          set({ students: updatedStudents });
        }

        // Apply penalties for absent students
        if (absentStudents.length > 0) {
          const students = get().students;
          const penaltyStudents = absentStudents.filter(a => a.penaltyAmount > 0);
          if (penaltyStudents.length > 0) {
            const updatedStudents2 = students.map(s => {
              const penaltyEntry = penaltyStudents.find(p => p.studentId === s.id);
              if (penaltyEntry) {
                return { ...s, balance: (s.balance || 0) - penaltyEntry.penaltyAmount };
              }
              return s;
            });
            set({ students: updatedStudents2 });

            // Create finance entries for penalties
            for (const ps of penaltyStudents) {
              const stud = students.find(s => s.id === ps.studentId);
              const penaltyFin: FinanceEntry = {
                id: genId(),
                date: lesson.date,
                type: 'income',
                category: 'Штраф за отмену',
                amount: ps.penaltyAmount,
                description: `Штраф за отсутствие: ${stud?.name || 'Ученик'}. Урок: ${lesson.topic}`,
                lessonId: id,
              };
              set(st => ({ finance: [...st.finance, penaltyFin] }));
            }
          }
        }

        const penaltyCount = absentStudents.filter(a => a.penaltyAmount > 0).length;
        const subPart = subDeductedIds.length > 0 ? `, по абонементу: ${subDeductedIds.length}` : '';
        const msg = `Урок проведён. Присутствовало: ${presentStudents.length}${subPart}${absentStudents.length > 0 ? `, отсутствовало: ${absentStudents.length}` : ''}${penaltyCount > 0 ? `, штрафов: ${penaltyCount}` : ''}`;
        get().addToast(msg, 'success');
      },

      updateSettings: (s) => set(state => ({ settings: { ...state.settings, ...s } })),

      cancelLessonWithPenalty: (id, reason, cancelledBy, penaltyAmountParam) => {
        const state = get();
        const lesson = state.schedule.find(l => l.id === id);
        if (!lesson) return;

        const prevStatus = lesson.status;

        // Revert completed side-effects if needed
        if (prevStatus === 'completed') {
          const finEntry = state.finance.find(f => f.lessonId === id);
          if (finEntry) {
            set(st => ({ finance: st.finance.filter(f => f.id !== finEntry.id) }));
          }
          // Ученики, за которых занятие было списано с абонемента
          const subDeducted = lesson.subscriptionDeductions || [];
          // Restore balance only for those who paid from balance
          const targetStudentIds = (lesson.studentIds || (lesson.studentId ? [lesson.studentId] : []))
            .filter(sid => !subDeducted.includes(sid));
          // Сколько фактически было списано с баланса (при ручном списании может отличаться от цены урока)
          const chargedAmount = lesson.balanceCharge ?? lesson.price;
          if (targetStudentIds.length > 0) {
            set(st => ({
              students: st.students.map(s =>
                targetStudentIds.includes(s.id) ? { ...s, balance: (s.balance || 0) + chargedAmount } : s
              ),
            }));
          }
          // Возвращаем списанные занятия в абонементы
          if (subDeducted.length > 0) {
            const today = todayStr();
            for (const sid of subDeducted) {
              const subs = get().subscriptions;
              let target = getActiveSubscription(subs, sid, today);
              if (!target) {
                const started = subs
                  .filter(s => s.studentId === sid && !s.archived && s.usedLessons > 0 && s.startDate <= today)
                  .sort((a, b) =>
                    ((a.endDate >= today ? 0 : 1) - (b.endDate >= today ? 0 : 1)) ||
                    b.startDate.localeCompare(a.startDate)
                  );
                target = started[0] || null;
              }
              if (target) {
                const tid = target.id;
                set(st => ({
                  subscriptions: st.subscriptions.map(s =>
                    s.id === tid ? { ...s, usedLessons: Math.max(0, s.usedLessons - 1) } : s
                  ),
                }));
              }
            }
          }
        }

        // Use passed penaltyAmount, default 0 for tutor or not specified
        const penaltyAmount = cancelledBy === 'student' ? (penaltyAmountParam || 0) : 0;

        const cancellation: LessonCancellation = {
          reason,
          cancelledBy,
          penaltyAmount,
          cancelledAt: new Date().toISOString(),
        };

        // Update lesson status
        const updatedLesson = { ...lesson, status: 'cancelled' as const, cancellation, balanceCharge: undefined };
        set({ schedule: state.schedule.map(l => l.id === id ? updatedLesson : l) });

        // Apply penalty if student's fault
        if (cancelledBy === 'student' && penaltyAmount > 0) {
          const targetStudentIds = lesson.studentIds || (lesson.studentId ? [lesson.studentId] : []);
          if (targetStudentIds.length > 0) {
            set(st => ({
              students: st.students.map(s =>
                targetStudentIds.includes(s.id) ? { ...s, balance: (s.balance || 0) - penaltyAmount } : s
              ),
            }));
            // Create finance entry for the penalty
            const newFin: FinanceEntry = {
              id: genId(),
              date: lesson.date,
              type: 'income',
              category: 'Штраф за отмену',
              amount: penaltyAmount,
              description: `Штраф за отмену урока (${reason}): ${lesson.student}`,
              lessonId: id,
            };
            set(st => ({ finance: [...st.finance, newFin] }));
          }
          get().addToast(`Урок отменён. Штраф: ${penaltyAmount.toLocaleString('ru-RU')} ₽`, 'error');
        } else if (cancelledBy === 'tutor') {
          get().addToast('Урок отменён по вашей вине. Штраф не начислен.', 'info');
        } else {
          get().addToast('Урок отменён', 'success');
        }
      },

      addFinance: (f) => set(state => ({ finance: [...state.finance, { ...f, id: genId() }] })),
      updateFinance: (id, f) => set(state => ({
        finance: state.finance.map(item => item.id === id ? { ...f, id } : item),
      })),
      deleteFinance: (id) => set(state => ({ finance: state.finance.filter(f => f.id !== id) })),

      adjustBalance: (studentId, amount, description) => {
        const state = get();
        const student = state.students.find(s => s.id === studentId);
        if (!student) return;
        const currentBal = student.balance || 0;
        const newBalance = currentBal + amount;
        set({
          students: state.students.map(s => s.id === studentId ? { ...s, balance: newBalance } : s),
        });
        // Create finance entry for the balance change
        const finEntry: FinanceEntry = {
          id: genId(),
          date: fmtDate(new Date()),
          type: amount > 0 ? 'income' : 'expense',
          category: amount > 0 ? 'Пополнение баланса' : 'Корректировка баланса',
          amount: Math.abs(amount),
          description: `${amount > 0 ? 'Пополнение' : 'Списание'} баланса: ${student.name}. ${description}`,
          balanceChange: true,
        };
        set(st => ({ finance: [...st.finance, finEntry] }));
        get().addToast(`Баланс ${student.name}: ${newBalance >= 0 ? '+' : ''}${newBalance.toLocaleString('ru-RU')} ₽`, amount > 0 ? 'success' : 'info');
      },

      /* ═══════════ АБОНЕМЕНТЫ ═══════════ */

      addSubscription: (input) => {
        const state = get();
        const student = state.students.find(s => s.id === input.studentId);
        if (!student) return { ok: false, message: 'Ученик не найден' };
        if (input.totalLessons < 1) return { ok: false, message: 'Количество занятий должно быть не менее 1' };
        if (!input.startDate || !input.endDate) return { ok: false, message: 'Укажите даты действия' };
        if (input.endDate < input.startDate) return { ok: false, message: 'Дата окончания не может быть раньше даты начала' };
        if (input.price <= 0) return { ok: false, message: 'Стоимость должна быть больше нуля' };

        // У ученика не может быть двух одновременно действующих абонементов:
        // запрещаем создание, если период пересекается с активным/замороженным/будущим.
        const overlap = findOverlappingSubscription(state.subscriptions, input.studentId, input.startDate, input.endDate);
        if (overlap) {
          return {
            ok: false,
            message: `Невозможно создать абонемент: новый период пересекается с текущим активным абонементом (${fmtDateDMY(overlap.startDate)} — ${fmtDateDMY(overlap.endDate)}).`,
          };
        }

        // Стоимость списывается с баланса независимо от его размера:
        // если средств не хватает — баланс уходит в минус, покупка не блокируется.
        const balance = student.balance || 0;

        const sub: Subscription = {
          id: genId(),
          studentId: input.studentId,
          totalLessons: Math.floor(input.totalLessons),
          usedLessons: 0,
          startDate: input.startDate,
          endDate: input.endDate,
          price: input.price,
          frozen: false,
          createdAt: new Date().toISOString(),
        };

        const newBalance = balance - input.price;

        // Предыдущие недействительные абонементы ученика автоматически уходят в архив
        const today = todayStr();
        const autoArchiveIds = state.subscriptions
          .filter(s => s.studentId === input.studentId && !s.archived && getSubStatus(s, today) === 'invalid')
          .map(s => s.id);

        set({
          subscriptions: [
            ...state.subscriptions.map(s => autoArchiveIds.includes(s.id) ? { ...s, archived: true } : s),
            sub,
          ],
          students: state.students.map(s => s.id === input.studentId ? { ...s, balance: newBalance } : s),
        });

        // Финансовая операция списания стоимости с баланса
        const finEntry: FinanceEntry = {
          id: genId(),
          date: fmtDate(new Date()),
          type: 'expense',
          category: 'Покупка абонемента',
          amount: input.price,
          description: `Абонемент на ${sub.totalLessons} занятий: ${student.name} (${fmtDateDMY(sub.startDate)} — ${fmtDateDMY(sub.endDate)})`,
          balanceChange: true,
        };
        set(st => ({ finance: [...st.finance, finEntry] }));

        const isFuture = sub.startDate > todayStr();
        get().addToast(
          isFuture
            ? `Будущий абонемент создан. Списано ${input.price.toLocaleString('ru-RU')} ₽`
            : `Абонемент создан. Списано ${input.price.toLocaleString('ru-RU')} ₽`,
          'success'
        );
        if (newBalance < 0) {
          get().addToast(`Баланс стал отрицательным: ${newBalance.toLocaleString('ru-RU')} ₽`, 'error');
        }
        if (autoArchiveIds.length > 0) {
          get().addToast(
            autoArchiveIds.length === 1
              ? 'Предыдущий недействительный абонемент отправлен в архив'
              : `Недействительных абонементов отправлено в архив: ${autoArchiveIds.length}`,
            'info'
          );
        }
        return { ok: true };
      },

      updateSubscription: (id, patch) => {
        const state = get();
        const sub = state.subscriptions.find(s => s.id === id);
        if (!sub) return { ok: false, message: 'Абонемент не найден' };

        const totalLessons = patch.totalLessons !== undefined ? Math.floor(patch.totalLessons) : sub.totalLessons;
        const startDate = patch.startDate !== undefined ? patch.startDate : sub.startDate;
        const endDate = patch.endDate !== undefined ? patch.endDate : sub.endDate;

        if (totalLessons < 1) return { ok: false, message: 'Количество занятий должно быть не менее 1' };
        if (totalLessons < sub.usedLessons) {
          return { ok: false, message: `Нельзя установить меньше ${sub.usedLessons} — столько занятий уже использовано` };
        }
        if (!startDate || !endDate) return { ok: false, message: 'Укажите даты действия' };
        if (endDate < startDate) return { ok: false, message: 'Дата окончания не может быть раньше даты начала' };

        // При редактировании период тоже не должен пересекаться с другим действующим абонементом
        const overlap = findOverlappingSubscription(state.subscriptions, sub.studentId, startDate, endDate, id);
        if (overlap) {
          return {
            ok: false,
            message: `Невозможно изменить абонемент: новый период пересекается с текущим активным абонементом (${fmtDateDMY(overlap.startDate)} — ${fmtDateDMY(overlap.endDate)}).`,
          };
        }

        set({
          subscriptions: state.subscriptions.map(s =>
            s.id === id ? { ...s, totalLessons, startDate, endDate } : s
          ),
        });
        get().addToast('Абонемент обновлён', 'success');
        return { ok: true };
      },

      toggleFreezeSubscription: (id) => {
        const state = get();
        const sub = state.subscriptions.find(s => s.id === id);
        if (!sub) return;
        const today = todayStr();
        // Заморозка не применяется к архивным абонементам
        if (sub.archived) {
          get().addToast('Абонемент находится в архиве', 'error');
          return;
        }
        // Заморозка имеет смысл только для действующих и будущих абонементов
        if (!sub.frozen && (sub.usedLessons >= sub.totalLessons || (sub.endDate < today && sub.startDate <= today))) {
          get().addToast('Нельзя заморозить недействительный абонемент', 'error');
          return;
        }
        set({
          subscriptions: state.subscriptions.map(s => s.id === id ? { ...s, frozen: !s.frozen } : s),
        });
        get().addToast(sub.frozen ? 'Абонемент разморожен' : 'Абонемент заморожен', sub.frozen ? 'success' : 'info');
      },

      archiveSubscription: (id) => {
        const state = get();
        const sub = state.subscriptions.find(s => s.id === id);
        if (!sub) return;
        if (sub.archived) {
          get().addToast('Абонемент уже в архиве', 'info');
          return;
        }
        set({
          subscriptions: state.subscriptions.map(s => s.id === id ? { ...s, archived: true } : s),
        });
        get().addToast('Абонемент отправлен в архив', 'info');
      },

      unarchiveSubscription: (id) => {
        const state = get();
        const sub = state.subscriptions.find(s => s.id === id);
        if (!sub) return;
        set({
          subscriptions: state.subscriptions.map(s => s.id === id ? { ...s, archived: false } : s),
        });
        get().addToast('Абонемент возвращён из архива', 'success');
      },

      deleteSubscription: (id) => {
        const state = get();
        const sub = state.subscriptions.find(s => s.id === id);
        if (!sub) return;
        const student = state.students.find(s => s.id === sub.studentId);

        // Возврат на баланс за неиспользованные занятия (пропорционально стоимости)
        const left = subLessonsLeft(sub);
        const refund = left > 0 ? Math.round((sub.price / sub.totalLessons) * left) : 0;

        set({
          subscriptions: state.subscriptions.filter(s => s.id !== id),
        });

        if (refund > 0 && student) {
          set(st => ({
            students: st.students.map(s => s.id === sub.studentId ? { ...s, balance: (s.balance || 0) + refund } : s),
          }));
          const finEntry: FinanceEntry = {
            id: genId(),
            date: fmtDate(new Date()),
            type: 'income',
            category: 'Возврат за абонемент',
            amount: refund,
            description: `Возврат за ${left} из ${sub.totalLessons} занятий: ${student.name}`,
            balanceChange: true,
          };
          set(st => ({ finance: [...st.finance, finEntry] }));
          get().addToast(`Абонемент удалён. Возврат на баланс: ${refund.toLocaleString('ru-RU')} ₽`, 'info');
        } else {
          get().addToast('Абонемент удалён', 'info');
        }
      },

      /** Поиск пересекающегося абонемента (для живого предупреждения в форме) */
      checkSubscriptionOverlap: (studentId, startDate, endDate, excludeId) =>
        findOverlappingSubscription(get().subscriptions, studentId, startDate, endDate, excludeId),

      updateCurrentUser: async (data) => {
        try {
          const res = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok) return { ok: false, error: json?.error || 'Не удалось обновить профиль' };
          const u = json?.user as { name: string; email: string; photo: string | null } | undefined;
          const cur = get().currentUser;
          if (cur && u) {
            set({ currentUser: { ...cur, name: u.name, email: u.email, photo: u.photo || undefined } });
          }
          return { ok: true };
        } catch {
          return { ok: false, error: 'Нет соединения с сервером' };
        }
      },
    }),
    {
      name: 'englishpro-store',
      // v2: student.socials перенесены в student.parent.socials (вкладка «Родитель»)
      // v1: авторизация и данные перенесены на сервер; локально остаются
      // только офлайн-кэш данных и тема устройства
      version: 2,
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<PersistedData> & Record<string, unknown>;
        delete p.currentUser;
        delete p.users;
        if (Array.isArray(p.students)) {
          p.students = normalizeStudentsParentFields(p.students as Student[]);
        }
        return p as PersistedData;
      },
      partialize: (state): PersistedData => ({
        students: state.students,
        classes: state.classes,
        schedule: state.schedule,
        finance: state.finance,
        subscriptions: state.subscriptions,
        theme: state.theme,
        settings: state.settings,
        dataOwnerId: state.dataOwnerId,
        activeCabinet: state.activeCabinet,
      }),
    }
  )
);
