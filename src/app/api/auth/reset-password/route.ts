import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { audit, hashPassword, revokeUserSessions, verifyPassword } from '@/lib/ep-server-auth';

/**
 * «Забыли пароль?» — шаг 2: установка нового пароля по токену из письма.
 *
 * Токен принимается, только если он существует, не использован и не истёк.
 * В БД хранится sha256-хеш, поэтому присылать нужно сам токен (как в ссылке).
 * После успешной смены:
 *  - токен помечается использованным (одноразовость);
 *  - все сессии аккаунта отзываются (если кто-то был залогинен — разлогинится);
 *  - флаг mustChangePassword снимается: пароль теперь знает сам человек.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const token = String(body?.token ?? '').trim();
    const newPassword = String(body?.newPassword ?? '');

    if (!token)
      return NextResponse.json({ error: 'Ссылка недействительна — запросите восстановление ещё раз' }, { status: 400 });
    if (newPassword.length < 4)
      return NextResponse.json({ error: 'Пароль должен быть не менее 4 символов' }, { status: 400 });

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await db.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'Ссылка недействительна или устарела — запросите восстановление ещё раз' },
        { status: 400 },
      );
    }
    if (record.user.status !== 'ACTIVE')
      return NextResponse.json({ error: 'Аккаунт заархивирован — восстановление невозможно' }, { status: 403 });

    if (verifyPassword(newPassword, record.user.passwordHash))
      return NextResponse.json({ error: 'Новый пароль совпадает с текущим — придумайте другой' }, { status: 400 });

    await db.$transaction([
      db.user.update({
        where: { id: record.userId },
        data: { passwordHash: hashPassword(newPassword), mustChangePassword: false },
      }),
      db.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Пароль изменён вне сессии — подстраховаться: разлогинить все устройства
    await revokeUserSessions(record.userId);

    await audit(null, 'PASSWORD_RESET_DONE', { id: record.user.id, email: record.user.email });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('reset-password error', e);
    return NextResponse.json({ error: 'Ошибка сервера, попробуйте ещё раз' }, { status: 500 });
  }
}
