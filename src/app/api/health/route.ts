import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Health-check для мониторинга (uptime-роботы, Docker healthcheck, балансировщики).
 * Проверяет доступность БД. Секретов не отдаёт.
 */
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      db: 'up',
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: 'error', db: 'down', time: new Date().toISOString() },
      { status: 503 }
    );
  }
}
