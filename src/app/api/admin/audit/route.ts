import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getEffectiveUser, isAdminRoles } from '@/lib/ep-server-auth';

/** Журнал аудита: последние 200 записей, новые сверху (только админы) */
export async function GET() {
  const eff = await getEffectiveUser();
  if (!eff) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!isAdminRoles(eff.actor.roles))
    return NextResponse.json({ error: 'Доступ только для администраторов' }, { status: 403 });

  const entries = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({ entries });
}
