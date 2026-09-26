import { Student, ClassGroup, Lesson, FinanceEntry, TOPICS, EXPENSE_CATEGORIES, MONTHS_GEN_RU, TRANSFER_FINANCE_CATEGORIES } from './ep-types';

export function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function parseDate(s: string | undefined | null): Date {
  if (!s) return new Date();
  const p = s.split('-');
  if (p.length !== 3) return new Date();
  return new Date(+p[0], +p[1] - 1, +p[2]);
}

export function fmtMoney(n: number): string {
  const num = Number(n);
  if (!num || isNaN(num) || !isFinite(num)) return '0 \u20bd';
  return Math.abs(num).toLocaleString('ru-RU', { minimumFractionDigits: 0 }) + ' \u20bd';
}

export function fmtDateRu(d: Date): string {
  return d.getDate() + ' ' + MONTHS_GEN_RU[d.getMonth()];
}

export function isToday(d: Date): boolean {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

export function isPastDate(d: Date): boolean {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c < t;
}

export function getMonday(d: Date): Date {
  const dt = new Date(d);
  const day = dt.getDay();
  dt.setDate(dt.getDate() - day + (day === 0 ? -6 : 1));
  dt.setHours(0, 0, 0, 0);
  return dt;
}

export function getWeekDays(offset: number): Date[] {
  const mon = getMonday(new Date());
  mon.setDate(mon.getDate() + offset * 7);
  const arr: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(d.getDate() + i);
    arr.push(d);
  }
  return arr;
}

export function timeToMinutes(t: string): number {
  const p = t.split(':');
  return parseInt(p[0]) * 60 + parseInt(p[1]);
}

export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
}

/**
 * Days until the next birthday from today.
 * Returns 0 if the birthday is today, 1 if tomorrow, etc.
 * Returns null if birthDate is missing/invalid.
 */
export function getDaysUntilBirthday(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const parts = birthDate.split('-');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (!month || !day) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // This year's birthday
  let next = new Date(today.getFullYear(), month - 1, day);
  next.setHours(0, 0, 0, 0);
  if (next < today) {
    // Already passed this year — use next year
    next = new Date(today.getFullYear() + 1, month - 1, day);
    next.setHours(0, 0, 0, 0);
  }

  const diffMs = next.getTime() - today.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/** True if today is the student's birthday */
export function isBirthdayToday(birthDate?: string | null): boolean {
  return getDaysUntilBirthday(birthDate) === 0;
}

export function generateDemoData(): {
  students: Student[];
  classes: ClassGroup[];
  schedule: Lesson[];
  finance: FinanceEntry[];
} {
  const students: Student[] = [
    { id: genId(), name: 'Анна Петрова', phone: '+7 916 123-45-67', email: 'anna@mail.ru', rate: 1500, notes: 'Подготовка к IELTS', balance: 4500 },
    { id: genId(), name: 'Дмитрий Козлов', phone: '+7 903 234-56-78', email: 'dima@mail.ru', rate: 1200, notes: 'Разговорный английский', balance: 0 },
    { id: genId(), name: 'Мария Иванова', phone: '+7 925 345-67-89', email: 'masha@mail.ru', rate: 1500, notes: 'Business English', balance: -1500 },
    { id: genId(), name: 'Алексей Смирнов', phone: '+7 977 456-78-90', email: 'alex@mail.ru', rate: 1000, notes: 'Начальный уровень (A1)', balance: 3000 },
    { id: genId(), name: 'Екатерина Волкова', phone: '+7 926 567-89-01', email: 'katya@mail.ru', rate: 1800, notes: 'Подготовка к FCE', balance: 5400 },
  ];

  const classes: ClassGroup[] = [
    { id: genId(), name: 'IELTS-Группа 1', description: 'Подготовка к международному экзамену', studentIds: [students[0].id, students[2].id, students[4].id], pricePerLesson: 3000 },
    { id: genId(), name: 'Beginners (A1)', description: 'Начинающие взрослые', studentIds: [students[3].id], pricePerLesson: 1000 },
  ];

  const times = ['09:00', '10:00', '11:30', '14:00', '15:30', '17:00', '18:30'];
  const durs = [60, 60, 90, 60, 60, 90, 60];
  const schedule: Lesson[] = [];
  const today = new Date();
  const mon = getMonday(today);

  for (let w = 0; w < 3; w++) {
    for (let d = 0; d < 5; d++) {
      const date = new Date(mon);
      date.setDate(date.getDate() + w * 7 + d);
      const ds = fmtDate(date);
      const cnt = Math.floor(Math.random() * 3) + 1;
      for (let l = 0; l < cnt; l++) {
        const isGroup = Math.random() > 0.7;
        const lesson: Lesson = {
          id: genId(), date: ds,
          time: times[Math.floor(Math.random() * times.length)],
          topic: TOPICS[Math.floor(Math.random() * TOPICS.length)],
          duration: durs[Math.floor(Math.random() * durs.length)],
          status: 'planned', isGroup, classId: null,
          studentIds: [], studentId: null, student: '',
          price: 0, recurringGroupId: null,
        };
        if (isGroup && classes[0]) {
          lesson.classId = classes[0].id;
          lesson.studentIds = classes[0].studentIds.slice();
          lesson.studentId = null;
          lesson.student = 'Группа: ' + classes[0].name;
          lesson.price = 3000;
        } else {
          const st = students[Math.floor(Math.random() * students.length)];
          lesson.studentId = st.id;
          lesson.studentIds = [st.id];
          lesson.student = st.name;
          lesson.price = st.rate;
        }
        if (w === 0 && isPastDate(date)) {
          lesson.status = Math.random() > 0.1 ? 'completed' : 'cancelled';
        }
        schedule.push(lesson);
      }
    }
  }
  schedule.sort((a, b) => a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date));

  const finance: FinanceEntry[] = [];
  for (let i = 45; i >= 0; i--) {
    const fd = new Date();
    fd.setDate(fd.getDate() - i);
    const fds = fmtDate(fd);
    const ic = Math.floor(Math.random() * 3);
    for (let j = 0; j < ic; j++) {
      const fst = students[Math.floor(Math.random() * students.length)];
      finance.push({ id: genId(), date: fds, type: 'income', category: 'Оплата за урок', amount: fst.rate, description: 'Урок с ' + fst.name });
    }
    if (Math.random() > 0.6) {
      const ec = EXPENSE_CATEGORIES.filter(c => c !== 'Другое');
      const cat = ec[Math.floor(Math.random() * ec.length)];
      const amts: Record<string, [number, number]> = {
        'Учебные материалы': [300, 800], 'Подписки и сервисы': [199, 599],
        'Транспорт': [100, 300], 'Реклама': [500, 2000], 'Аренда': [3000, 5000],
      };
      const r = amts[cat] || [100, 500];
      finance.push({ id: genId(), date: fds, type: 'expense', category: cat, amount: r[0] + Math.floor(Math.random() * (r[1] - r[0])), description: cat });
    }
  }
  return { students, classes, schedule, finance };
}

/* ═══════════ ФИНАНСЫ: СОРТИРОВКА И КАТЕГОРИИ-ПЕРЕВОДЫ ═══════════ */

/**
 * Сортировка финансовых операций: новые сверху.
 * 1) По дате — убывание.
 * 2) Внутри одной даты — позднее созданные выше: новые записи всегда
 *    добавляются в конец массива, поэтому индекс в исходном массиве
 *    отражает порядок создания (edit/delete позицию не меняют).
 */
export function sortFinanceNewestFirst<T>(finance: T[]): T[] {
  return finance
    .map((f, idx) => ({ f, idx }))
    .sort((a, b) => {
      const fa = a.f as { date: string };
      const fb = b.f as { date: string };
      if (fa.date !== fb.date) return fb.date.localeCompare(fa.date);
      return b.idx - a.idx;
    })
    .map(x => x.f);
}

/** Операция — внутренний перевод (покупка/возврат абонемента), не реальный доход/расход */
export function isTransferFinance(f: Pick<FinanceEntry, 'category'>): boolean {
  return TRANSFER_FINANCE_CATEGORIES.includes(f.category);
}

/* ═══════════ МИГРАЦИЯ: СОЦСЕТИ УЧЕНИКА → РОДИТЕЛЮ ═══════════ */

/**
 * Разовая миграция снапшотов БЕЗ маркера format 2 (данные до появления
 * собственных соцсетей ученика): там student.socials означали соцсети
 * родителя и переносятся в student.parent.socials.
 * В снапшотах format 2 не применяется: student.socials — это уже собственные
 * соцсети ученика (добавляются на карточке), трогать их нельзя.
 * Применяется при чтении данных из старых источников: localStorage
 * (persist migrate), сервер (/api/data), импорт/восстановление копий.
 */
export function normalizeStudentsParentFields(students: Student[]): Student[] {
  return students.map(s => {
    // parent появляется только в формате 2 — его наличие означает новые данные
    if (!s.socials || s.parent) return s;
    const { socials, ...rest } = s;
    return { ...rest, parent: { socials } };
  });
}
