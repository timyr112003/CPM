export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  photo?: string;
}

/* ═══════════ СОЦИАЛЬНЫЕ СЕТИ ═══════════ */

/** Поддерживаемые социальные сети в карточке ученика */
export type SocialNetwork = 'vk' | 'telegram' | 'max';

/** Ссылки на аккаунты социальных сетей ученика */
export interface StudentSocials {
  vk?: string;
  telegram?: string;
  max?: string;
}

export interface Student {
  id: string;
  name: string;
  phone: string;
  email: string;
  rate: number;
  notes: string;
  balance: number;
  photo?: string;
  birthDate?: string; // YYYY-MM-DD
  archived?: boolean;
  archivedAt?: string;
  /** Собственные соцсети ученика — добавляются на карточке ученика (соцсети родителя — в parent.socials) */
  socials?: StudentSocials;
  /** Личные настройки напоминаний о занятиях (шестерёнка «Настройки» на карточке); не задано — «как у всех» */
  notify?: StudentNotifySettings;
  /** Контактная информация родителя (вкладка «Родитель» в редакторе карточки) */
  parent?: StudentParent;
}

/** Контактные данные родителя ученика: имя, почта, телефон, заметки, соцсети */
export interface StudentParent {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  socials?: StudentSocials;
}

/**
 * Личные настройки уведомлений ученика (шестерёнка «Настройки» на карточке).
 *  - mode 'inherit' (или поле не задано) — действуют общие настройки аккаунта
 *    («Напоминание ученику» и «Напоминание родителю» в Настройках);
 *  - mode 'custom' — включённость для ученика/родителя и тайминг задаются
 *    индивидуально и полностью заменяют общие.
 */
export interface StudentNotifySettings {
  mode: 'inherit' | 'custom';
  /** Слать ученику напоминание перед занятием (только mode='custom') */
  toStudent?: boolean;
  /** Слать родителю напоминание перед занятием (только mode='custom') */
  toParent?: boolean;
  /** За сколько минут до занятия напоминать, 5–1440 (только mode='custom') */
  minutes?: number;
}

export interface ClassGroup {
  id: string;
  name: string;
  description: string;
  studentIds: string[];
  pricePerLesson: number;
}

export type CancellationParty = 'student' | 'tutor';

export interface LessonCancellation {
  reason: string;
  cancelledBy: CancellationParty;
  penaltyAmount: number;
  cancelledAt: string;
}

export interface LessonAttendance {
  studentId: string;
  present: boolean;
  penaltyAmount: number;
}

/* ═══════════ АБОНЕМЕНТЫ ═══════════ */

/** Статус абонемента (вычисляется по датам и остатку занятий) */
export type SubscriptionStatus = 'active' | 'scheduled' | 'frozen' | 'invalid' | 'archived';

export interface Subscription {
  id: string;
  studentId: string;
  /** Всего занятий в абонементе */
  totalLessons: number;
  /** Использовано занятий */
  usedLessons: number;
  /** Дата начала действия (YYYY-MM-DD) */
  startDate: string;
  /** Дата окончания действия (YYYY-MM-DD) */
  endDate: string;
  /** Стоимость (списывается с баланса при создании) */
  price: number;
  /** Заморожен */
  frozen: boolean;
  /** Отправлен в архив: не участвует в списании и не отображается на карточке */
  archived?: boolean;
  /** ISO-дата создания */
  createdAt: string;
}

export interface Lesson {
  id: string;
  date: string;
  time: string;
  topic: string;
  duration: number;
  price: number;
  status: 'planned' | 'completed' | 'cancelled';
  isGroup: boolean;
  classId: string | null;
  studentId: string | null;
  studentIds: string[];
  student: string;
  recurringGroupId: string | null;
  cancellation?: LessonCancellation;
  attendance?: LessonAttendance[];
  notes?: string;       // Заметки репетитора по уроку (что прошли, что задали)
  homework?: string;    // Домашнее задание
  materials?: string;   // Материалы урока (ссылки, учебник, страницы)
  /** Ученики, за которых занятие списано с абонемента (а не с баланса) */
  subscriptionDeductions?: string[];
  /** Сумма, фактически списанная с баланса при ручном списании (иначе списывается lesson.price) */
  balanceCharge?: number;
}

export interface FinanceEntry {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  lessonId?: string;
  balanceChange?: boolean;
}

/**
 * Категории-«переводы»: внутренние движения средств (баланс ученика ↔ абонемент).
 * Реальных денег tutoring не получает и не тратит, поэтому в доходы/расходы
 * они не включаются (участвуют только в истории операций и истории баланса).
 */
export const TRANSFER_FINANCE_CATEGORIES: readonly string[] = [
  'Покупка абонемента',
  'Возврат за абонемент',
];

export type PageType = 'dashboard' | 'calendar' | 'schedule' | 'students' | 'classes' | 'finance' | 'settings';

/* ═══════════ РОЛИ ПОЛЬЗОВАТЕЛЕЙ ═══════════ */

/** Роли аккаунта — НАБОР: у «гибрида» TEACHER + ADMIN одновременно (один пароль,
 *  два кабинета); MAIN_ADMIN — владелец, назначается только в БД */
export type UserRole = 'MAIN_ADMIN' | 'ADMIN' | 'TEACHER';

export const ROLE_LABELS: Record<UserRole, string> = {
  MAIN_ADMIN: 'Главный админ',
  ADMIN: 'Администратор',
  TEACHER: 'Учитель',
};

/** Есть ли в наборе админ-доступ (ADMIN или MAIN_ADMIN) — кабинет администратора */
export function isAdminRoles(roles: UserRole[] | undefined | null): boolean {
  return !!roles && (roles.includes('MAIN_ADMIN') || roles.includes('ADMIN'));
}

/** Есть ли учительская роль — учительский кабинет */
export function hasTeacherRole(roles: UserRole[] | undefined | null): boolean {
  return !!roles && roles.includes('TEACHER');
}

/** Гибрид: доступны оба кабинета — нужен экран выбора и переключатель */
export function isHybridRoles(roles: UserRole[] | undefined | null): boolean {
  return isAdminRoles(roles) && hasTeacherRole(roles);
}


export const INCOME_CATEGORIES = ['Оплата за урок', 'Оплата за курс', 'Пополнение баланса', 'Штраф за отмену', 'Другое'];
export const EXPENSE_CATEGORIES = ['Учебные материалы', 'Подписки и сервисы', 'Транспорт', 'Реклама', 'Аренда', 'Другое'];
export const TOPICS = [
  'Грамматика: Present Perfect', 'Разговорная практика', 'Аудирование',
  'Подготовка к экзамену', 'Чтение и обсуждение', 'Лексика: Business',
  'Письмо: эссе', 'Грамматика: Conditionals', 'Разговорный клуб', 'Произношение'
];

export const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
export const MONTHS_GEN_RU = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
export const DAYS_SHORT_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
export const DAYS_FULL_RU = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];

export interface AppSettings {
  penaltyEnabled: boolean;
  penaltyAmount: number;
  penaltyPercent: number;
  /** Уведомления педагогу (этап 3): дневная сводка (утро) — undefined = включено (совместимость со старыми снапшотами) */
  notifyDaily?: boolean;
  /** Напоминание «за час до занятия» — undefined = включено */
  notifyHourly?: boolean;
  /** Недельный план (понедельник) — undefined = включено */
  notifyWeekly?: boolean;
  /** Во сколько присылать сводку на день, 'HH:MM' (московское время) — undefined = 07:00 */
  notifyDailyTime?: string;
  /** За сколько минут до начала занятия присылать напоминание (5–1440) — undefined = 60 */
  notifyHourlyMinutes?: number;
  /** Во сколько присылать недельный план, 'HH:MM' — undefined = 07:00 */
  notifyWeeklyTime?: string;
  /** В какие дни присылать недельный план: 0=Пн…6=Вс; [] = не присылать — undefined = [0] (понедельник) */
  notifyWeeklyDays?: number[];
  /** Напоминание ученику перед занятием (по умолчанию выключено) — undefined = выключено */
  notifyStudentLesson?: boolean;
  /** За сколько минут до занятия напоминать ученику (5–1440) — undefined = 60 */
  notifyStudentLessonMinutes?: number;
  /** Напоминание родителю перед занятием (по умолчанию выключено) — undefined = выключено */
  notifyParentLesson?: boolean;
  /** За сколько минут до занятия напоминать родителю (5–1440) — undefined = 60 */
  notifyParentLessonMinutes?: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  penaltyEnabled: true,
  penaltyAmount: 0,
  penaltyPercent: 50,
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

export interface RecurringPattern {
  daysOfWeek: number[]; // 0=Пн, 1=Вт, ..., 6=Вс
  endDate: string; // YYYY-MM-DD
}
