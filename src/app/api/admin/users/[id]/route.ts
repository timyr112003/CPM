import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  audit,
  canManage,
  getEffectiveUser,
  hashPassword,
  isAdminRoles,
  parseRoles,
  publicUser,
  revokeUserSessions,
  ROLE_ADMIN,
  ROLE_MAIN_ADMIN,
  ROLE_TEACHER,
  STATUS_ACTIVE,
  STATUS_DISABLED,
} from '@/lib/ep-server-auth';

/**
 * Управление аккаунтом: добавление/снятие роли, архивация/восстановление,
 * сброс пароля. Один аккаунт — набор ролей: у «гибрида» (учитель + админ)
 * две этикетки и два кабинета при одном пароле.
 *   PATCH { action: 'addRole' | 'removeRole' | 'archive' | 'restore' | 'password', ... }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const eff = await getEffectiveUser();
  if (!eff) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!isAdminRoles(eff.actor.roles))
    return NextResponse.json({ error: 'Доступ только для администраторов' }, { status: 403 });

  const { id } = await params;
  const target = await db.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: 'Аккаунт не найден' }, { status: 404 });

  const actor = eff.actor;
  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? '');

  // Право управлять этим аккаунтом (админы друг друга не трогают; главный админ неприкосновенен)
  const targetRoles = parseRoles(target.roles);
  if (
    !canManage(
      { id: actor.id, roles: actor.roles },
      { id: target.id, roles: targetRoles }
    )
  )
    return NextResponse.json({ error: 'Нет прав на управление этим аккаунтом' }, { status: 403 });

  const actorRef = { id: actor.id, email: actor.email };
  const targetRef = { id: target.id, email: target.email };

  switch (action) {
    /* ─── Добавление роли (только главный админ): у учителя появляется
           вторая этикетка, кабинеты остаются оба ─── */
    case 'addRole':
    /* ─── Снятие роли (только главный админ) ─── */
    case 'removeRole': {
      if (actor.roles.includes(ROLE_MAIN_ADMIN) === false)
        return NextResponse.json(
          { error: 'Только главный администратор может менять роли' },
          { status: 403 }
        );
      if (targetRoles.includes(ROLE_MAIN_ADMIN))
        return NextResponse.json({ error: 'Роли главного администратора неизменяемы' }, { status: 400 });

      const role = String(body?.role ?? '');
      if (role !== ROLE_TEACHER && role !== ROLE_ADMIN)
        return NextResponse.json({ error: 'Недопустимая роль' }, { status: 400 });

      const has = targetRoles.includes(role);
      if (action === 'addRole' && has)
        return NextResponse.json({ error: 'Эта роль уже назначена' }, { status: 400 });
      if (action === 'removeRole' && !has)
        return NextResponse.json({ error: 'Этой роли и так нет' }, { status: 400 });

      const nextRoles =
        action === 'addRole'
          ? [...targetRoles, role]
          : targetRoles.filter(r => r !== role);
      if (nextRoles.length === 0)
        return NextResponse.json(
          { error: 'У аккаунта должна остаться хотя бы одна роль' },
          { status: 400 }
        );

      const updated = await db.user.update({
        where: { id: target.id },
        data: { roles: JSON.stringify(nextRoles) },
      });
      await audit(actorRef, action === 'addRole' ? 'ROLE_ADDED' : 'ROLE_REMOVED', targetRef, {
        role,
        roles: nextRoles,
      });
      return NextResponse.json({ user: publicUser(updated) });
    }

    /* ─── Архивация аккаунта (данные сохраняются, вход блокируется) ─── */
    case 'archive': {
      if (target.status === STATUS_DISABLED)
        return NextResponse.json({ error: 'Аккаунт уже архивирован' }, { status: 400 });

      await db.user.update({ where: { id: target.id }, data: { status: STATUS_DISABLED } });
      await revokeUserSessions(target.id); // мгновенно выкидываем активные сессии
      await audit(actorRef, 'USER_ARCHIVED', targetRef);
      return NextResponse.json({ ok: true });
    }

    /* ─── Восстановление архивированного аккаунта ─── */
    case 'restore': {
      if (target.status !== STATUS_DISABLED)
        return NextResponse.json({ error: 'Аккаунт не архивирован' }, { status: 400 });

      await db.user.update({ where: { id: target.id }, data: { status: STATUS_ACTIVE } });
      await audit(actorRef, 'USER_RESTORED', targetRef);
      return NextResponse.json({ ok: true });
    }

    /* ─── Сброс пароля: выдаём временный пароль, пользователь сменит его при входе ─── */
    case 'password': {
      const password = String(body?.password ?? '');
      if (password.length < 4)
        return NextResponse.json({ error: 'Пароль должен быть не менее 4 символов' }, { status: 400 });

      await db.user.update({
        where: { id: target.id },
        data: { passwordHash: hashPassword(password), mustChangePassword: true },
      });
      await revokeUserSessions(target.id); // заставляем войти заново с новым паролем
      await audit(actorRef, 'PASSWORD_RESET', targetRef);
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  }
}
