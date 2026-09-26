/**
 * Инструментация Next.js: вызывается один раз при старте сервера.
 * Здесь запускается встроенный планировщик напоминаний (этап 3).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startReminderScheduler } = await import('./lib/ep-scheduler');
    startReminderScheduler();
  }
}
