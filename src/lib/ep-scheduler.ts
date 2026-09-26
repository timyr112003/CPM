import { runReminders, runSummary } from '@/lib/ep-reminder-engine';
import { isMailConfigured } from '@/lib/mailer';
import { reminderZone } from '@/lib/ep-reminders';

/**
 * Встроенный планировщик напоминаний (этап 3).
 *
 * Запускается из src/instrumentation.ts при старте сервера и каждые 5 минут
 * вызывает движок напоминаний для всех трёх типов. Благодаря дедупликации
 * по аудиту повторы безопасны — письмо уйдёт один раз.
 *
 * Когда что отправлять, решает сам движок по настройкам каждого педагога
 * (шестерёнка в карточке «Уведомления»): напоминание «за N минут до занятия»
 * ловится 5-минутным тиком — минимальное окно напоминания тоже 5 минут,
 * поэтому окно не может быть пропущено между тиками; дневная сводка и
 * недельный план уходят в окне 3 часа после назначенного времени в выбранные
 * дни — первый же тик внутри окна отправляет письмо, остальные гасятся
 * дедупликацией. Если сервер был перезапущен, письма всё равно уйдут, как
 * только он поднимется в окне.
 *
 * Отключается переменной REMINDER_BUILTIN=0 (тогда письма по расписанию
 * отправляет только внешний крон, см. PROJECT-README.md).
 */

// Тик 5 минут: минимальное окно напоминания «за N минут» — тоже 5 минут,
// значит любой интервал между тиками не длиннее самого короткого окна и
// напоминание гарантированно уходит до начала занятия.
const TICK_MS = 5 * 60 * 1000;

async function tick(): Promise<void> {
  if (!isMailConfigured()) return; // почта не настроена — тихо пропускаем
  try {
    // hourly первым — он самый срочный (занятие вот-вот начнётся)
    for (const type of ['hourly', 'daily', 'weekly'] as const) {
      const r = await runReminders(type);
      console.log(`[reminders] ${runSummary(r)}`);
    }
  } catch (e) {
    console.error('[reminders] сбой тика планировщика:', e);
  }
}

/** Запустить планировщик (идемпотентно: повторный вызов ничего не меняет) */
export function startReminderScheduler(): void {
  if (process.env.REMINDER_BUILTIN === '0') {
    console.log('[reminders] встроенный планировщик отключён (REMINDER_BUILTIN=0)');
    return;
  }
  const g = globalThis as unknown as { __epReminderTimer?: NodeJS.Timeout };
  if (g.__epReminderTimer) return;
  // первый тик через 20 секунд после старта: письмо «за N минут» уходит даже
  // если сервер поднялся незадолго до занятия; дальше — раз в 5 минут
  setTimeout(() => { void tick(); }, 20_000);
  g.__epReminderTimer = setInterval(() => { void tick(); }, TICK_MS);
  console.log(`[reminders] встроенный планировщик запущен (тик 20 c, затем каждые 5 мин, пояс ${reminderZone()})`);
}
