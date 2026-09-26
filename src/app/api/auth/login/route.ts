import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  audit,
  createSession,
  normalizeEmail,
  publicUser,
  verifyPassword,
  STATUS_DISABLED,
} from '@/lib/ep-server-auth';

/**
 * Вход в систему. Один аккаунт — один логин/пароль (почта уникальна).
 * Если у аккаунта несколько ролей (учитель + админ), выбор кабинета
 * происходит на клиенте ПОСЛЕ успешного входа — сервер всегда входишь
 * в единственный аккаунт этой почты.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = normalizeEmail(String(body?.email ?? ''));
    const password = String(body?.password ?? '');

    if (!email || !password)
      return NextResponse.json({ error: 'Введите email и пароль' }, { status: 400 });

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash))
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });

    if (user.status === STATUS_DISABLED)
      return NextResponse.json(
        { error: 'Аккаунт архивирован администратором. Обратитесь к администратору' },
        { status: 403 }
      );

    await createSession(user.id);
    await audit({ id: user.id, email: user.email }, 'LOGIN');
    return NextResponse.json({ user: publicUser(user) });
  } catch (e) {
    console.error('login error', e);
    return NextResponse.json({ error: 'Ошибка сервера, попробуйте ещё раз' }, { status: 500 });
  }
}
