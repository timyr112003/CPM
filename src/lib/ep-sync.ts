import { create } from 'zustand';
import { useAppStore } from './ep-store';
import { DEFAULT_SETTINGS, type AppSettings, type ClassGroup, type FinanceEntry, type Lesson, type Student, type Subscription } from './ep-types';
import { normalizeStudentsParentFields } from './ep-utils';

/**
 * Sync-движок EnglishPro.
 *
 * Сервер (Next.js API + Prisma/SQLite) — источник истины для данных приложения.
 *  - При входе/загрузке данные забираются с сервера (pullData).
 *  - Любое изменение в store автоматически отправляется на сервер (autosave, дебаунс 700 мс).
 *  - localStorage остаётся офлайн-кэшем (zustand persist) для мгновенной загрузки.
 *  - При возврате на вкладку (visibilitychange) данные подтягиваются с сервера,
 *    если нет несохранённых локальных изменений — так телефон и компьютер
 *    видят одинаковые данные.
 */

export interface AppData {
  /** Маркер формата снапшота: 2 = student.socials — собственные соцсети ученика (миграция к родителю не нужна) */
  format?: number;
  students: Student[];
  classes: ClassGroup[];
  schedule: Lesson[];
  finance: FinanceEntry[];
  subscriptions: Subscription[];
  settings: AppSettings;
}

/** Актуальный формат снапшотов данных (сервер, экспорт, резервные копии) */
export const DATA_FORMAT = 2;

export type SyncStatus = 'idle' | 'saving' | 'synced' | 'error';

interface SyncState {
  status: SyncStatus;
  lastSyncAt: number | null;
  error: string | null;
  online: boolean;
}

export const useSyncStore = create<SyncState>(() => ({
  status: 'idle',
  lastSyncAt: null,
  error: null,
  online: true,
}));

const LEGACY_BACKUP_KEY = 'englishpro-legacy-backup';

/* ═══════════ Утилиты ═══════════ */

export function collectData(): AppData {
  const s = useAppStore.getState();
  return {
    format: DATA_FORMAT,
    students: s.students,
    classes: s.classes,
    schedule: s.schedule,
    finance: s.finance,
    subscriptions: s.subscriptions,
    settings: s.settings,
  };
}

function extractData(source: Record<string, unknown>): AppData {
  // Снапшоты без маркера format 2 — старые: student.socials в них означали
  // соцсети родителя и переносятся в parent.socials (разовая миграция)
  const needsMigration = source.format !== DATA_FORMAT;
  const rawStudents = Array.isArray(source.students) ? (source.students as Student[]) : [];
  return {
    students: needsMigration ? normalizeStudentsParentFields(rawStudents) : rawStudents,
    classes: Array.isArray(source.classes) ? (source.classes as ClassGroup[]) : [],
    schedule: Array.isArray(source.schedule) ? (source.schedule as Lesson[]) : [],
    finance: Array.isArray(source.finance) ? (source.finance as FinanceEntry[]) : [],
    subscriptions: Array.isArray(source.subscriptions) ? (source.subscriptions as Subscription[]) : [],
    // ВАЖНО: если в снапшоте нет settings (старый снапшот или его нет вовсе) —
    // подставляем ДЕФОЛТЫ, а не текущее содержимое store: иначе настройки
    // предыдущего аккаунта «протекают» в этот и сохраняются при первом автосейве.
    settings: (source.settings as AppSettings) ?? { ...DEFAULT_SETTINGS },
  };
}

export function isEmptyData(d: Partial<AppData> | null | undefined): boolean {
  return (
    !d ||
    (d.students?.length === 0 &&
      d.classes?.length === 0 &&
      d.schedule?.length === 0 &&
      d.finance?.length === 0 &&
      d.subscriptions?.length === 0)
  );
}

/* ═══════════ Прижение данных с сервера в store ═══════════ */

let suppressPush = false;
let suppressTimer: ReturnType<typeof setTimeout> | null = null;

function beginSuppress() {
  suppressPush = true;
  if (suppressTimer) clearTimeout(suppressTimer);
  suppressTimer = setTimeout(() => {
    suppressPush = false;
    suppressTimer = null;
  }, 50);
}

export function applyData(data: Partial<AppData> | null | undefined) {
  if (!data) return;
  beginSuppress();
  useAppStore.setState(extractData(data as Record<string, unknown>));
}

/** Очистить локальные данные (новый аккаунт), сохранив резервную копию */
export function clearLocalDataWithBackup() {
  const snapshot = collectData();
  if (!isEmptyData(snapshot)) {
    try {
      localStorage.setItem(
        LEGACY_BACKUP_KEY,
        JSON.stringify({ version: DATA_FORMAT, exportedAt: new Date().toISOString(), data: snapshot })
      );
    } catch {
      /* нет места — игнорируем */
    }
  }
  beginSuppress();
  useAppStore.setState({ students: [], classes: [], schedule: [], finance: [], subscriptions: [], settings: { ...DEFAULT_SETTINGS } });
}

/**
 * Сбросить локальные данные БЕЗ резервной копии — при переключении на данные
 * другого пользователя (режим управления аккаунтом): они остаются на сервере
 * в аккаунте владельца, а в localStorage чужие данные смешивать нельзя.
 * Настройки (включая уведомления) тоже сбрасываются к дефолту — у каждого
 * аккаунта они свои; далее подтянутся из снапшота этого аккаунта (pullData).
 */
export function resetLocalData() {
  beginSuppress();
  useAppStore.setState({
    students: [],
    classes: [],
    schedule: [],
    finance: [],
    subscriptions: [],
    settings: { ...DEFAULT_SETTINGS },
    dataOwnerId: undefined,
  });
}

export function readLegacyBackup(): { version: number; data: AppData } | null {
  try {
    const raw = localStorage.getItem(LEGACY_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const data = parsed?.data;
    if (isEmptyData(data)) return null;
    return { version: Number(parsed.version) || 1, data: data as AppData };
  } catch {
    return null;
  }
}

export function dropLegacyBackup() {
  try {
    localStorage.removeItem(LEGACY_BACKUP_KEY);
  } catch {
    /* ignore */
  }
}

/* ═══════════ Миграция данных старой (локальной) версии ═══════════ */

let legacyCache: { emails: string[]; data: AppData | null } | null = null;

/** Чтение raw localStorage старой версии (users[] с email + данные) */
function readLegacyRaw(): { emails: string[]; data: AppData | null } {
  let emails: string[] = [];
  let data: AppData | null = null;
  try {
    const raw = localStorage.getItem('englishpro-store');
    if (raw) {
      const parsed = JSON.parse(raw);
      const st = parsed?.state ?? parsed;
      if (Array.isArray(st?.users)) {
        emails = st.users
          .map((u: { email?: string }) => String(u?.email ?? '').trim().toLowerCase())
          .filter(Boolean);
      }
      const candidate = extractData(st ?? {});
      if (!isEmptyData(candidate)) data = candidate;
    }
  } catch {
    /* ignore */
  }
  return { emails, data };
}

/**
 * Ранний захват данных старой версии — вызывается на уровне модуля ep-store
 * ДО создания store: zustand persist при гидрации сразу перезаписывает
 * хранилище в формат v1 (без users[]), поэтому позже emails уже не прочитать.
 */
export function captureLegacyEarly(): { emails: string[]; data: AppData | null } {
  if (legacyCache) return legacyCache;
  legacyCache = typeof window === 'undefined' ? { emails: [], data: null } : readLegacyRaw();
  return legacyCache;
}

/**
 * Снимок локальных данных СТАРОЙ версии приложения (до сервера).
 * Возвращает кэш, заполненный captureLegacyEarly() при загрузке модуля;
 * при первом вызове позднее дополняет снимком из памяти.
 */
export function captureLegacy(): { emails: string[]; data: AppData | null } {
  if (legacyCache) {
    if (!legacyCache.data && typeof window !== 'undefined') {
      // fallback: in-memory состояние (может быть ещё не выгружено)
      const mem = extractData(useAppStore.getState() as unknown as Record<string, unknown>);
      if (!isEmptyData(mem)) legacyCache = { ...legacyCache, data: mem };
    }
    return legacyCache;
  }
  return captureLegacyEarly();
}

export function resetLegacyCache() {
  legacyCache = null;
}

/* ═══════════ Pull / Push ═══════════ */

export async function pullData(): Promise<AppData | null> {
  try {
    const res = await fetch('/api/data', { cache: 'no-store' });
    if (res.status === 401) {
      useSyncStore.setState({ status: 'error', error: 'Требуется вход', online: true });
      return null;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    applyData(json?.data ?? null);
    useSyncStore.setState({ status: 'synced', lastSyncAt: Date.now(), error: null, online: true });
    return (json?.data ?? null) as AppData | null;
  } catch {
    useSyncStore.setState({ online: false, error: 'Нет соединения с сервером' });
    return null;
  }
}

export async function pushData(): Promise<boolean> {
  if (!useAppStore.getState().currentUser) return false;
  if (pushInFlight) {
    pendingAfterFlight = true;
    return true;
  }
  pushInFlight = true;
  useSyncStore.setState({ status: 'saving', error: null });
  try {
    const res = await fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: collectData() }),
    });
    if (res.status === 401) {
      useSyncStore.setState({ status: 'error', error: 'Требуется вход', online: true });
      return false;
    }
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      useSyncStore.setState({ status: 'error', error: j?.error || `Ошибка ${res.status}`, online: true });
      return false;
    }
    useSyncStore.setState({ status: 'synced', lastSyncAt: Date.now(), error: null, online: true });
    return true;
  } catch {
    useSyncStore.setState({ status: 'error', error: 'Нет соединения с сервером', online: false });
    return false;
  } finally {
    pushInFlight = false;
    if (pendingAfterFlight) {
      pendingAfterFlight = false;
      schedulePush(300);
    }
  }
}

let pushInFlight = false;
let pendingAfterFlight = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePush(delay = 700) {
  if (suppressPush) return;
  if (!useAppStore.getState().currentUser) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushData();
  }, delay);
}

/* ═══════════ Инициализация подписок ═══════════ */

let subscribed = false;

export function initSync() {
  if (subscribed || typeof window === 'undefined') return;
  subscribed = true;

  // Автосохранение: следим только за данными приложения (не UI)
  useAppStore.subscribe((state, prev) => {
    if (
      state.students !== prev.students ||
      state.classes !== prev.classes ||
      state.schedule !== prev.schedule ||
      state.finance !== prev.finance ||
      state.subscriptions !== prev.subscriptions ||
      state.settings !== prev.settings
    ) {
      schedulePush();
    }
  });

  // Возврат на вкладку: подтянуть изменения, сделанные на другом устройстве
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (!useAppStore.getState().currentUser) return;
    if (pushInFlight || pushTimer) return; // есть несохранённые изменения — сначала push
    void pullData();
  });

  // Восстановление соединения
  window.addEventListener('online', () => {
    useSyncStore.setState({ online: true, error: null });
    if (useAppStore.getState().currentUser) void pushData();
  });
  window.addEventListener('offline', () => {
    useSyncStore.setState({ online: false });
  });
}
