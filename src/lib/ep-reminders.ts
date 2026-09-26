/**
 * Напоминания о занятиях педагогу (этап 3).
 *
 * Модуль самостоятельный: без импортов из других файлов проекта, чтобы его
 * можно было использовать и вне Next.js (скрипты проверки и превью писем,
 * будущие cron-скрипты; Node 24+ читает его прямо из исходника).
 *
 * Источник данных — JSON-снапшот UserData.data (те же ключи, что разбирает
 * статистика админа в /api/admin/stats): students[] и schedule[] (массив
 * Lesson, ключ «schedule»). Повторяющиеся занятия уже материализованы
 * отдельными записями, поэтому отбор «по дате» не требует логики паттернов.
 *
 * Время: все вычисления («сегодня», «7:00», «за час») делаются в поясе
 * REMINDER_TIMEZONE (по умолчанию Europe/Moscow) через Intl — сервер в
 * контейнере может жить в UTC, это не должно влиять на расписание педагога.
 */

/* ── Русские названия (локальные копии из ep-types — модуль вне Next) ── */

const MONTHS_GEN_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const DAYS_FULL_RU = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

/* ── Время в поясе напоминаний ── */

export interface ZoneNow {
  /** Дата «сейчас» в поясе напоминаний: YYYY-MM-DD */
  date: string;
  /** Минут с начала суток (0–1439) */
  minutes: number;
  /** День недели: 0 = понедельник … 6 = воскресенье */
  weekday: number;
}

export function reminderZone(): string {
  return process.env.REMINDER_TIMEZONE || 'Europe/Moscow';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Текущие дата/время в заданном поясе (по умолчанию — в поясе напоминаний) */
export function zoneNow(tz: string = reminderZone()): ZoneNow {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const num = (t: string) => Number(parts.find(p => p.type === t)?.value ?? '0');
  const year = num('year');
  const month = num('month');
  const day = num('day');
  const hour = num('hour') % 24; // некоторые платформы дают «24» в полночь
  const minute = num('minute');
  return {
    date: `${year}-${pad2(month)}-${pad2(day)}`,
    minutes: hour * 60 + minute,
    weekday: weekdayOf(`${year}-${pad2(month)}-${pad2(day)}`),
  };
}

/** День недели даты YYYY-MM-DD: 0 = понедельник … 6 = воскресенье */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Дата YYYY-MM-DD + n дней (арифметика в UTC на датах без времени — безопасна) */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** «26 сентября» — для заголовков и тем писем */
export function fmtHumanDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS_GEN_RU[m - 1] ?? ''}`;
}

/** «Понедельник, 26 сентября» — для недельного плана */
export function fmtDayTitle(date: string): string {
  return `${DAYS_FULL_RU[weekdayOf(date)]}, ${fmtHumanDate(date)}`;
}

/** Время 'HH:MM' → минуты с начала суток (терпимо к 'H:MM' и 'HH:MM:SS') */
export function lessonStartMinutes(time: string): number {
  const [h, m] = String(time).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/** 90 → «1 ч 30 мин», 60 → «1 ч», 45 → «45 мин», 0 → «—» */
export function durationLabel(min: number): string {
  if (!min || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} ч`);
  if (m) parts.push(`${m} мин`);
  return parts.join(' ');
}

/** Русские склонения: plural(3, 'занятие', 'занятия', 'занятий') — экспорт для меток в логах роута */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Экранирование пользовательских данных для HTML (имена, темы, заметки) */
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── Разбор JSON-снапшота UserData ── */

export interface ReminderStudent {
  id: string;
  name: string;
  archived?: boolean;
  /** Email ученика — для напоминания перед занятием */
  email?: string;
  /** Email родителя (из student.parent.email) */
  parentEmail?: string;
  /** Имя родителя (для обращения в письме) */
  parentName?: string;
  /** Личные настройки напоминаний; не задано/inherit — «как у всех» */
  notify?: {
    mode: 'inherit' | 'custom';
    toStudent?: boolean;
    toParent?: boolean;
    minutes?: number;
  };
}

export interface SnapshotLesson {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (время педагога) */
  time: string;
  status: string;
  isGroup: boolean;
  /** Имя ученика для одиночных занятий (как показывается в приложении) */
  student: string;
  /** Ученик одиночного занятия (на случай пустого studentIds в старых снапшотах) */
  studentId?: string;
  /** Идентификаторы учеников (для групповых занятий) */
  studentIds: string[];
  topic: string;
  duration: number;
  notes?: string;
}

export interface SnapshotSettings {
  /** Дневная сводка (undefined-поле в снапшоте = включено) */
  notifyDaily: boolean;
  /** Напоминание «за час» */
  notifyHourly: boolean;
  /** Недельный план */
  notifyWeekly: boolean;
  /** Во сколько присылать сводку на день, 'HH:MM' (по умолчанию 07:00) */
  notifyDailyTime: string;
  /** За сколько минут до занятия напоминать (5–1440, по умолчанию 60) */
  notifyHourlyMinutes: number;
  /** Во сколько присылать недельный план, 'HH:MM' (по умолчанию 07:00) */
  notifyWeeklyTime: string;
  /** В какие дни присылать недельный план: 0=Пн…6=Вс; [] = не присылать (по умолчанию [0]) */
  notifyWeeklyDays: number[];
  /** Напоминание ученику перед занятием (по умолчанию ВЫКЛЮЧЕНО) */
  notifyStudentLesson: boolean;
  /** За сколько минут напоминать ученику (5–1440, по умолчанию 60) */
  notifyStudentLessonMinutes: number;
  /** Напоминание родителю перед занятием (по умолчанию ВЫКЛЮЧЕНО) */
  notifyParentLesson: boolean;
  /** За сколько минут напоминать родителю (5–1440, по умолчанию 60) */
  notifyParentLessonMinutes: number;
}

/** Дефолтные настройки уведомлений — для снапшотов старой версии и битого JSON */
export function defaultNotifySettings(): SnapshotSettings {
  return {
    notifyDaily: true,
    notifyHourly: true,
    notifyWeekly: true,
    notifyDailyTime: '07:00',
    notifyHourlyMinutes: 60,
    notifyWeeklyTime: '07:00',
    notifyWeeklyDays: [0],
    notifyStudentLesson: false,
    notifyStudentLessonMinutes: 60,
    notifyParentLesson: false,
    notifyParentLessonMinutes: 60,
  };
}

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** 'HH:MM' с нормализацией ('7:05' → '07:05'); невалидное → значение по умолчанию */
function readTimeSetting(v: unknown, def: string): string {
  const s = String(v ?? '').trim();
  if (!TIME_RE.test(s)) return def;
  const [h, m] = s.split(':');
  return `${h.padStart(2, '0')}:${m}`;
}

/** За сколько минут напоминать: целое 5–1440, остальное → 60 */
function readMinutesSetting(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 5) return 60;
  return Math.min(n, 1440);
}

/** Дни недельного плана: уникальные 0–6 по возрастанию; поле не задано → [0] */
function readDaysSetting(v: unknown): number[] {
  if (v === undefined) return [0];
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b);
}

/**
 * Попадает ли текущая минута суток в окно отправки [start, start + window).
 * Окно шире самого тика (10 мин), чтобы письмо ушло при первом тике после
 * назначенного времени и не потерялось, если сервер был перезапущен;
 * повторные тики внутри окна гасятся дедупликацией. Окно умеет переходить
 * через полночь (например 23:30 + 3 ч).
 */
export function inSendWindow(nowMinutes: number, startMinutes: number, windowMinutes = 180): boolean {
  const end = startMinutes + windowMinutes;
  if (end <= 1440) return nowMinutes >= startMinutes && nowMinutes < end;
  return nowMinutes >= startMinutes || nowMinutes < end - 1440;
}

export interface SnapshotData {
  students: ReminderStudent[];
  lessons: SnapshotLesson[];
  settings: SnapshotSettings;
}

/** Безопасно разобрать снапшот: битый JSON или чужая структура → пустые списки */
export function parseSnapshot(raw: string): SnapshotData {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { students: [], lessons: [], settings: defaultNotifySettings() };
  }
  const students: ReminderStudent[] = Array.isArray(parsed.students)
    ? (parsed.students as Array<Record<string, unknown>>)
      .filter(s => s && typeof s.id === 'string')
      .map(s => {
        const parent = s.parent && typeof s.parent === 'object' ? (s.parent as Record<string, unknown>) : null;
        const notifyRaw = s.notify && typeof s.notify === 'object' ? (s.notify as Record<string, unknown>) : null;
        const email = String(s.email ?? '').trim();
        return {
          id: String(s.id),
          name: String(s.name ?? ''),
          archived: Boolean(s.archived),
          email: email || undefined,
          parentEmail: parent ? String(parent.email ?? '').trim() || undefined : undefined,
          parentName: parent ? String(parent.name ?? '').trim() || undefined : undefined,
          notify:
            notifyRaw && notifyRaw.mode === 'custom'
              ? {
                  mode: 'custom' as const,
                  toStudent: notifyRaw.toStudent === true,
                  toParent: notifyRaw.toParent === true,
                  minutes: readMinutesSetting(notifyRaw.minutes),
                }
              : undefined,
        };
      })
    : [];
  const lessons: SnapshotLesson[] = Array.isArray(parsed.schedule)
    ? (parsed.schedule as Array<Record<string, unknown>>)
      .filter(l => l && typeof l.id === 'string' && typeof l.date === 'string')
      .map(l => ({
        id: String(l.id),
        date: String(l.date),
        time: String(l.time ?? '00:00'),
        status: String(l.status ?? 'planned'),
        isGroup: Boolean(l.isGroup),
        student: String(l.student ?? ''),
        studentId: typeof l.studentId === 'string' && l.studentId ? l.studentId : undefined,
        studentIds: Array.isArray(l.studentIds) ? (l.studentIds as unknown[]).map(String) : [],
        topic: String(l.topic ?? ''),
        duration: Number(l.duration) || 0,
        notes: typeof l.notes === 'string' ? l.notes : undefined,
      }))
    : [];
  const st = parsed.settings && typeof parsed.settings === 'object'
    ? (parsed.settings as Record<string, unknown>)
    : {};
  const settings: SnapshotSettings = {
    notifyDaily: st.notifyDaily !== false,
    notifyHourly: st.notifyHourly !== false,
    notifyWeekly: st.notifyWeekly !== false,
    notifyDailyTime: readTimeSetting(st.notifyDailyTime, '07:00'),
    notifyHourlyMinutes: readMinutesSetting(st.notifyHourlyMinutes),
    notifyWeeklyTime: readTimeSetting(st.notifyWeeklyTime, '07:00'),
    notifyWeeklyDays: readDaysSetting(st.notifyWeeklyDays),
    // Напоминания ученику/родителю: по умолчанию выключены — включаются осознанно
    notifyStudentLesson: st.notifyStudentLesson === true,
    notifyStudentLessonMinutes: readMinutesSetting(st.notifyStudentLessonMinutes),
    notifyParentLesson: st.notifyParentLesson === true,
    notifyParentLessonMinutes: readMinutesSetting(st.notifyParentLessonMinutes),
  };
  return { students, lessons, settings };
}

/* ── Отбор занятий ── */

export interface DayLesson {
  id: string;
  time: string;
  /** Имена учеников (группы развёрнуты по studentIds, архивники не показываются) */
  studentNames: string[];
  isGroup: boolean;
  topic: string;
  duration: number;
  notes?: string;
}

/**
 * Запланированные (planned) занятия на дату, отсортированные по времени.
 * Отменённые и проведённые не попадают; архивные ученики из групп скрыты,
 * но если в группе не осталось ни одного «живого» имени — занятие всё равно
 * показывается (fallback на строку student).
 */
export function lessonsOnDay(lessons: SnapshotLesson[], students: ReminderStudent[], date: string): DayLesson[] {
  const byId = new Map(students.map(s => [s.id, s]));
  const result: DayLesson[] = [];
  for (const l of lessons) {
    if (l.date !== date || l.status !== 'planned') continue;
    let names: string[];
    if (l.isGroup && l.studentIds.length) {
      names = l.studentIds
        .map(id => byId.get(id))
        .filter((s): s is ReminderStudent => !!s && !s.archived)
        .map(s => s.name);
      if (!names.length) names = l.student ? [l.student] : [];
    } else {
      names = l.student ? [l.student] : [];
    }
    result.push({
      id: l.id,
      time: l.time,
      studentNames: names,
      isGroup: l.isGroup,
      topic: l.topic,
      duration: l.duration,
      notes: l.notes,
    });
  }
  result.sort((a, b) => lessonStartMinutes(a.time) - lessonStartMinutes(b.time));
  return result;
}

/* ── Письма ── */

export interface ReminderMail {
  subject: string;
  /** Простая текстовая версия (клиенты без HTML) */
  text: string;
  /** Заголовок внутри каркаса письма (уже экранированный) */
  heading: string;
  /**
   * Блоки HTML для framedMailHtml — каждый блок сам отвечает за разметку
   * (<p>, <table>); пользовательские данные внутри уже экранированы.
   */
  blocks: string[];
}

/** Таблица занятий — общий блок для дневной сводки и недельного плана */
function lessonsTable(lessons: DayLesson[]): string {
  const th = 'text-align:left;padding:6px 8px;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:12px;font-weight:600';
  const td = 'padding:8px;border-bottom:1px solid #f3f4f6;vertical-align:top';
  const rows = lessons.map(l => {
    const who = l.studentNames.length ? esc(l.studentNames.join(', ')) : '<span style="color:#9ca3af">—</span>';
    const topic = l.topic ? esc(l.topic) : '<span style="color:#9ca3af">—</span>';
    const notes = l.notes
      ? `<div style="color:#6b7280;font-size:12px;margin-top:2px">${esc(l.notes)}</div>`
      : '';
    const group = l.isGroup ? ' <span style="color:#5b6cf0;font-size:11px">группа</span>' : '';
    return `\
<tr>
  <td style="${td};white-space:nowrap"><b>${esc(l.time)}</b></td>
  <td style="${td}">${who}${group}</td>
  <td style="${td};white-space:nowrap">${durationLabel(l.duration)}</td>
  <td style="${td}">${topic}${notes}</td>
</tr>`;
  }).join('\n');
  return `\
<table style="width:100%;border-collapse:collapse;font-size:14px;margin:4px 0 12px">
<thead><tr>
  <th style="${th}">Время</th><th style="${th}">Ученики</th><th style="${th}">Длительность</th><th style="${th}">Тема</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>`;
}

const P = 'margin:0 0 12px;line-height:1.5';

/** Дневная сводка: «сегодня N занятий» + таблица */
export function buildDailyMail(opts: {
  teacherName: string;
  date: string;
  lessons: DayLesson[];
}): ReminderMail {
  const { teacherName, date, lessons } = opts;
  const total = lessons.reduce((s, l) => s + (l.duration || 0), 0);
  const summary = `${lessons.length} ${plural(lessons.length, 'занятие', 'занятия', 'занятий')}` +
    (total > 0 ? ` (${durationLabel(total)})` : '');
  return {
    subject: `EnglishPro: занятия на сегодня, ${fmtHumanDate(date)}`,
    text: [
      `Здравствуйте, ${teacherName}!`,
      `На сегодня, ${fmtHumanDate(date)}, запланировано ${summary}:`,
      ...lessons.map(l => `${l.time} — ${l.studentNames.join(', ') || '—'} (${durationLabel(l.duration)})${l.topic ? ` — ${l.topic}` : ''}`),
    ].join('\n'),
    heading: `Здравствуйте, ${esc(teacherName)}!`,
    blocks: [
      `<p style="${P}">На сегодня, <b>${fmtHumanDate(date)}</b>, запланировано ${summary}.</p>`,
      lessonsTable(lessons),
      `<p style="${P}">Хорошего дня и продуктивных занятий!</p>`,
    ],
  };
}

/** Точечное напоминание педагогу: точное время занятия в письме, без «через N минут» */
export function buildHourlyMail(opts: {
  teacherName: string;
  date: string;
  lesson: DayLesson;
}): ReminderMail {
  const { teacherName, date, lesson } = opts;
  const who = lesson.studentNames.join(', ');
  const lines = [
    `Здравствуйте, ${teacherName}!`,
    `Сегодня, ${fmtHumanDate(date)}, в ${lesson.time} занятие${who ? ` — ${who}` : ''}${lesson.isGroup ? ' (групповое занятие)' : ''}.`,
    `Длительность: ${durationLabel(lesson.duration)}.${lesson.topic ? ` Тема: ${lesson.topic}.` : ''}`,
  ];
  if (lesson.notes) lines.push(`Заметки: ${lesson.notes}`);
  return {
    subject: `EnglishPro: в ${lesson.time} занятие${who ? ` — ${who}` : ''}`,
    text: lines.join('\n'),
    heading: `Здравствуйте, ${esc(teacherName)}!`,
    blocks: [
      `<p style="${P}">Сегодня, ${fmtHumanDate(date)}, в <b>${esc(lesson.time)}</b> занятие${who ? ` — <b>${esc(who)}</b>` : ''}${lesson.isGroup ? ' (групповое занятие)' : ''}.</p>`,
      `<p style="${P}">Длительность: ${durationLabel(lesson.duration)}.${lesson.topic ? ` Тема: <b>${esc(lesson.topic)}</b>.` : ''}</p>`,
      ...(lesson.notes ? [`<p style="${P}">Заметки: ${esc(lesson.notes)}</p>`] : []),
      `<p style="${P}">Успешного занятия!</p>`,
    ],
  };
}

/** Недельный план: дни с занятиями (пустые дни не включаются) */
export function buildWeeklyMail(opts: {
  teacherName: string;
  startDate: string;
  endDate: string;
  days: Array<{ date: string; lessons: DayLesson[] }>;
}): ReminderMail {
  const { teacherName, startDate, endDate, days } = opts;
  const all = days.flatMap(d => d.lessons);
  const count = all.length;
  const total = all.reduce((s, l) => s + (l.duration || 0), 0);
  const textDays = days.map(d =>
    `${fmtDayTitle(d.date)} — ${d.lessons.length} ${plural(d.lessons.length, 'занятие', 'занятия', 'занятий')}:\n` +
    d.lessons.map(l => `  ${l.time} — ${l.studentNames.join(', ') || '—'} (${durationLabel(l.duration)})${l.topic ? ` — ${l.topic}` : ''}`).join('\n')
  );
  return {
    subject: `EnglishPro: план на неделю (с ${fmtHumanDate(startDate)})`,
    text: [
      `Здравствуйте, ${teacherName}!`,
      `План занятий с ${fmtHumanDate(startDate)} по ${fmtHumanDate(endDate)}: ${count} ${plural(count, 'занятие', 'занятия', 'занятий')}${total > 0 ? `, ${durationLabel(total)}` : ''}.`,
      '',
      ...textDays,
    ].join('\n'),
    heading: `Здравствуйте, ${esc(teacherName)}!`,
    blocks: [
      `<p style="${P}">План занятий с <b>${fmtHumanDate(startDate)}</b> по <b>${fmtHumanDate(endDate)}</b>: ${count} ${plural(count, 'занятие', 'занятия', 'занятий')}${total > 0 ? `, ${durationLabel(total)}` : ''}.</p>`,
      ...days.flatMap(d => [
        `<p style="margin:14px 0 4px;font-weight:bold">${fmtDayTitle(d.date)} — ${d.lessons.length} ${plural(d.lessons.length, 'занятие', 'занятия', 'занятий')}</p>`,
        lessonsTable(d.lessons),
      ]),
    ],
  };
}

/* ── Письма ученику и родителю ──
 *
 * Утверждённый формат (согласован с пользователем): без «через сколько минут» —
 * точное время занятия указано в самом письме. Заметки педагога (lesson.notes)
 * в этих письмах НЕ показываются — это личные рабочие записи. Общие параметры
 * урока (предмет/тема, время, длительность) — можно.
 */

/** Точечное напоминание ученику */
export function buildStudentReminderMail(opts: {
  studentName: string;
  date: string;
  lesson: DayLesson;
}): ReminderMail {
  const { studentName, date, lesson } = opts;
  const firstName = studentName.split(' ')[0] || studentName;
  const group = lesson.isGroup ? ' (групповое занятие)' : '';
  return {
    subject: `EnglishPro: твоё занятие сегодня в ${lesson.time}`,
    text: [
      `Привет, ${firstName}!`,
      `Сегодня, ${fmtHumanDate(date)}, состоится занятие по английскому языку в ${lesson.time}${group}.`,
      `Длительность: ${durationLabel(lesson.duration)}.${lesson.topic ? ` Тема: ${lesson.topic}.` : ''}`,
      'Хорошего занятия!',
    ].join('\n'),
    heading: `Привет, ${esc(firstName)}!`,
    blocks: [
      `<p style="${P}">Сегодня, <b>${fmtHumanDate(date)}</b>, состоится занятие по английскому языку в <b>${esc(lesson.time)}</b>${group}.</p>`,
      `<p style="${P}">Длительность: ${durationLabel(lesson.duration)}.${lesson.topic ? ` Тема: <b>${esc(lesson.topic)}</b>.` : ''}</p>`,
      `<p style="${P}">Хорошего занятия!</p>`,
    ],
  };
}

/** Точечное напоминание родителю: имя ребёнка — в именительном (строка «Ученик: …»), без склонений */
export function buildParentReminderMail(opts: {
  parentName?: string;
  studentName: string;
  date: string;
  lesson: DayLesson;
}): ReminderMail {
  const { parentName, studentName, date, lesson } = opts;
  const greeting = parentName ? `Здравствуйте, ${parentName}!` : 'Здравствуйте!';
  const group = lesson.isGroup ? ' (групповое занятие)' : '';
  return {
    subject: `EnglishPro: ${studentName} — занятие сегодня в ${lesson.time}`,
    text: [
      greeting,
      `Напоминаем, что сегодня, ${fmtHumanDate(date)}, состоится занятие по английскому языку.`,
      `Ученик: ${studentName}${group}`,
      `Длительность: ${durationLabel(lesson.duration)}.`,
      ...(lesson.topic ? [`Тема: ${lesson.topic}.`] : []),
      'Хорошего занятия!',
    ].join('\n'),
    heading: esc(greeting),
    blocks: [
      `<p style="${P}">Напоминаем, что сегодня, <b>${fmtHumanDate(date)}</b>, состоится занятие по английскому языку.</p>`,
      `<p style="${P}">Ученик: <b>${esc(studentName)}</b>${group}</p>`,
      `<p style="${P}">Длительность: ${durationLabel(lesson.duration)}.</p>`,
      ...(lesson.topic ? [`<p style="${P}">Тема: <b>${esc(lesson.topic)}</b>.</p>`] : []),
      `<p style="${P}">Хорошего занятия!</p>`,
    ],
  };
}
