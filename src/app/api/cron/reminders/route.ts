import { NextResponse } from 'next/server';
import { isMailConfigured } from '@/lib/mailer';
import { runReminders, type ReminderType } from '@/lib/ep-reminder-engine';

/**
 * Планировщик напоминаний о занятиях (этап 3).
 *
 * Два способа запуска:
 *  1. Встроенный планировщик (по умолчанию включён, см. src/lib/ep-scheduler.ts)
 *     — сам вызывает движок каждые 5 минут, отдельная настройка крона не нужна.
 *  2. Внешний крон — GET-запросы с секретом (REMINDER_BUILTIN=0, чтобы отключить
 *     встроенный):
 *
 *     GET /api/cron/reminders?secret=CRON_SECRET&type=daily
 *       type: daily   — сводка занятий на сегодня (план: ~7:00 по REMINDER_TIMEZONE)
 *             hourly  — напоминания «за час» (крон каждые 5 минут, окно от 5 минут)
 *             weekly  — план на 7 дней вперёд (план: понедельник утром)
 *       dry=1   — без отправки: только посчитать и вернуть, что ушло бы
 *
 * Защита: 401 без/с неверным секретом; секрет никогда не логируется.
 * Логика отправки — в src/lib/ep-reminder-engine.ts (дедупликация по аудиту,
 * учёт настроек уведомлений аккаунта, сбои SMTP не ломают обход).
 */

export const dynamic = 'force-dynamic';

const TYPES = ['daily', 'hourly', 'weekly'] as const;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') ?? req.headers.get('x-cron-secret') ?? '';
  const expected = process.env.CRON_SECRET || '';
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Неверный секрет планировщика (CRON_SECRET)' }, { status: 401 });
  }

  const type = (url.searchParams.get('type') ?? 'daily') as ReminderType;
  if (!TYPES.includes(type)) {
    return NextResponse.json({ error: `Неизвестный тип: поддерживаются ${TYPES.join(', ')}` }, { status: 400 });
  }
  const dryRun = url.searchParams.get('dry') === '1';

  if (!isMailConfigured() && !dryRun) {
    return NextResponse.json(
      { error: 'Почта не настроена — заполните SMTP_USER и SMTP_PASS в .env' },
      { status: 400 },
    );
  }

  const result = await runReminders(type, { dryRun });
  return NextResponse.json(result);
}
