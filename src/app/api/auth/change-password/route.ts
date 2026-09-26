import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { audit, getSessionUser, hashPassword, verifyPassword } from '@/lib/ep-server-auth';

/** Смена собственного пароля (по текущему паролю). Работает только для своей сессии. */
export async function POST(req: Request) {
  try {
    const current = await getSessionUser();
    if (!current) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const body = await req.json().catch(() => null);
    const currentPassword = String(body?.currentPassword ?? '');
    const newPassword = String(body?.newPassword ?? '');

    if (newPassword.length < 4)
      return NextResponse.json({ error: 'Новый пароль должен быть не менее 4 символов' }, { status: 400 });

    const user = await db.user.findUnique({ where: { id: current.id } });
    if (!user || !verifyPassword(currentPassword, user.passwordHash))
      return NextResponse.json({ error: 'Неверный текущий пароль' }, { status: 400 });

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(newPassword), mustChangePassword: false },
    });
    await audit({ id: user.id, email: user.email }, 'PASSWORD_CHANGED');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('change-password error', e);
    return NextResponse.json({ error: 'Ошибка сервера, попробуйте ещё раз' }, { status: 500 });
  }
}
