import { Subscription, SubscriptionStatus } from './ep-types';

/* ═══════════ ХЕЛПЕРЫ АБОНЕМЕНТОВ ═══════════ */

/** Текущая дата в формате YYYY-MM-DD */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Разница в целых днях: to - from (оба YYYY-MM-DD) */
export function diffDays(from: string, to: string): number {
  const a = new Date(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = new Date(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Статус абонемента на дату:
 * - archived  — отправлен в архив вручную (или авто-архивом); не участвует в списании
 * - frozen    — заморожен владельцем
 * - scheduled — будущий (дата начала ещё не наступила)
 * - invalid   — недействителен: занятия закончились или срок истёк
 * - active    — действует сейчас
 */
export function getSubStatus(sub: Subscription, today: string): SubscriptionStatus {
  if (sub.archived) return 'archived';
  if (sub.frozen) return 'frozen';
  if (sub.startDate > today) return 'scheduled';
  if (sub.usedLessons >= sub.totalLessons || sub.endDate < today) return 'invalid';
  return 'active';
}

/** Человекочитаемая метка статуса */
export const SUB_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Активен',
  scheduled: 'Будущий',
  frozen: 'Заморожен',
  invalid: 'Недействителен',
  archived: 'Архив',
};

/**
 * Абонемент, с которого списывается занятие сегодня:
 * действует по датам, не заморожен, есть остаток занятий.
 * Если несколько — берём тот, что закончится раньше.
 */
export function getActiveSubscription(
  subs: Subscription[],
  studentId: string,
  today: string
): Subscription | null {
  const candidates = subs
    .filter(s =>
      s.studentId === studentId &&
      !s.archived &&
      !s.frozen &&
      s.startDate <= today &&
      s.endDate >= today &&
      s.usedLessons < s.totalLessons
    )
    .sort((a, b) =>
      a.endDate.localeCompare(b.endDate) || a.startDate.localeCompare(b.startDate)
    );
  return candidates[0] || null;
}

/**
 * Абонемент для отображения на карточке ученика (только один):
 * 1) текущий активный (по датам, не заморожен, есть остаток);
 * 2) если его нет — действующий по датам, но замороженный;
 * 3) иначе — последний начавшийся (недействителен: занятия кончились или срок истёк).
 * Будущие абонементы (дата начала не наступила) на карточке НЕ отображаются.
 */
export function getDisplaySubscription(
  subs: Subscription[],
  studentId: string,
  today: string
): Subscription | null {
  const started = subs.filter(s => s.studentId === studentId && !s.archived && s.startDate <= today);
  if (started.length === 0) return null;

  const active = started
    .filter(s => !s.frozen && s.usedLessons < s.totalLessons && s.endDate >= today)
    .sort((a, b) =>
      a.endDate.localeCompare(b.endDate) || a.startDate.localeCompare(b.startDate)
    );
  if (active.length > 0) return active[0];

  const frozenInRange = started
    .filter(s => s.frozen && s.endDate >= today && s.usedLessons < s.totalLessons)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  if (frozenInRange.length > 0) return frozenInRange[0];

  return started.sort((a, b) =>
    b.startDate.localeCompare(a.startDate) || b.endDate.localeCompare(a.endDate)
  )[0];
}

/**
 * Поиск абонемента, период действия которого пересекается с [startDate, endDate].
 * У ученика не может быть двух одновременно действующих абонементов, поэтому
 * пересечение с «живым» абонементом запрещено.
 * Учитываются только:
 *  - активные (действуют сейчас),
 *  - замороженные (в пределах срока),
 *  - будущие (ещё не начались, но начнут действовать).
 * НЕ учитываются: архивные, недействительные (занятия кончились / срок истёк).
 * Пересечение периодов: existingStart <= newEnd && newStart <= existingEnd
 * (включительно: последний день одного и первый день другого — уже пересечение).
 * excludeId — id редактируемого абонемента (сам с собой не сравнивается).
 */
export function findOverlappingSubscription(
  subs: Subscription[],
  studentId: string,
  startDate: string,
  endDate: string,
  excludeId?: string
): Subscription | null {
  const today = todayStr();
  return (
    subs.find(s =>
      s.studentId === studentId &&
      s.id !== excludeId &&
      !s.archived &&
      s.usedLessons < s.totalLessons && // не исчерпан
      s.endDate >= today &&             // срок не истёк
      s.startDate <= endDate &&         // пересечение периодов
      startDate <= s.endDate
    ) || null
  );
}

/** Остаток занятий */
export function subLessonsLeft(sub: Subscription): number {
  return Math.max(0, sub.totalLessons - sub.usedLessons);
}

/** Всего дней в периоде (по примеру ТЗ: 01.09–01.10 = 30 дней) */
export function subDaysTotal(sub: Subscription): number {
  return Math.max(1, diffDays(sub.startDate, sub.endDate));
}

/** Сколько дней осталось до конца периода (0 — в последний день) */
export function subDaysLeft(sub: Subscription, today: string): number {
  return Math.max(0, Math.min(diffDays(today, sub.endDate), subDaysTotal(sub)));
}

/** Цвет шкалы в зависимости от доли оставшихся занятий */
export function subScaleColor(sub: Subscription): string {
  const left = subLessonsLeft(sub);
  if (left === 0) return '#ff5c5c'; // красный — занятия закончились
  const frac = left / sub.totalLessons;
  if (frac > 0.5) return '#00e5a0';   // зелёный — больше половины
  if (frac > 0.25) return '#facc15';  // жёлтый — меньше половины
  return '#ff9f43';                   // оранжевый — на исходе
}

/** Формат DD.MM.YYYY */
export function fmtDateDMY(s: string): string {
  if (!s || s.length < 10) return s || '';
  return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`;
}

/** Сортировка абонементов для списка в модалке: активные → замороженные → будущие → недействительные → архивные */
export function sortSubsForList(subs: Subscription[], today: string): Subscription[] {
  const order: Record<SubscriptionStatus, number> = { active: 0, frozen: 1, scheduled: 2, invalid: 3, archived: 4 };
  return [...subs].sort((a, b) => {
    const oa = order[getSubStatus(a, today)];
    const ob = order[getSubStatus(b, today)];
    if (oa !== ob) return oa - ob;
    return b.createdAt.localeCompare(a.createdAt);
  });
}
