import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  audit,
  canManage,
  getEffectiveUser,
  isAdminRoles,
  parseRoles,
  publicUser,
  setViewAs,
  STATUS_ACTIVE,
} from '@/lib/ep-server-auth';

/**
 * Вход в аккаунт пользователя в режиме управления (impersonation).
 * Права редактирования сохраняются — все изменения уходят в аккаунт учителя.
 * Каждое включение режима фиксируется в журнале аудита.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const eff = await getEffectiveUser();
  if (!eff) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!isAdminRoles(eff.actor.roles))
    return NextResponse.json({ error: 'Доступ только для администраторов' }, { status: 403 });

  const { id } = await params;
  const target = await db.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'Аккаунт не найден' }, { status: 404 });

  const targetRoles = parseRoles(target.roles);
  if (
    !canManage(
      { id: eff.actor.id, roles: eff.actor.roles },
      { id: target.id, roles: targetRoles }
    )
  )
    return NextResponse.json({ error: 'Нет прав на вход в этот аккаунт' }, { status: 403 });

  // Режим управления открывает учительский стол — у цели должна быть учительская роль
  if (!targetRoles.includes('TEACHER'))
    return NextResponse.json(
      { error: 'У этого аккаунта нет учительского кабинета' },
      { status: 400 }
    );

  if (target.status !== STATUS_ACTIVE)
    return NextResponse.json(
      { error: 'Аккаунт архивирован — сначала восстановите его' },
      { status: 400 }
    );

  await setViewAs(target.id);
  await audit(
    { id: eff.actor.id, email: eff.actor.email },
    'IMPERSONATE_START',
    { id: target.id, email: target.email }
  );

  return NextResponse.json({ ok: true, user: publicUser(target) });
}
