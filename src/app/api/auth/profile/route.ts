import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { audit, getEffectiveUser, isValidEmail, normalizeEmail, publicUser } from '@/lib/ep-server-auth';

/**
 * Обновление профиля: имя, email, фото (base64).
 * В режиме управления аккаунтом профиль обновляется у того, чей аккаунт открыт.
 */
export async function PUT(req: Request) {
  try {
    const eff = await getEffectiveUser();
    if (!eff) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object')
      return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });

    const data: { name?: string; email?: string; photo?: string | null } = {};

    if (body.name !== undefined) {
      const name = String(body.name ?? '').trim();
      if (!name) return NextResponse.json({ error: 'Имя не может быть пустым' }, { status: 400 });
      data.name = name;
    }

    if (body.email !== undefined) {
      const email = normalizeEmail(String(body.email ?? ''));
      if (!isValidEmail(email))
        return NextResponse.json({ error: 'Введите корректный email' }, { status: 400 });
      // Почта — логин и она уникальна: нельзя занять чужую
      const taken = await db.user.findFirst({ where: { email, id: { not: eff.user.id } } });
      if (taken)
        return NextResponse.json(
          { error: 'Эта почта уже используется другим аккаунтом' },
          { status: 409 }
        );
      data.email = email;
    }

    if (body.photo !== undefined) {
      const photo = String(body.photo ?? '');
      // Пустая строка = удалить фото; иначе ожидаем data:image/... (base64)
      if (photo && !photo.startsWith('data:image/'))
        return NextResponse.json({ error: 'Некорректный формат фото' }, { status: 400 });
      if (photo.length > 3 * 1024 * 1024)
        return NextResponse.json({ error: 'Фото слишком большое (максимум 3 МБ)' }, { status: 413 });
      data.photo = photo || null;
    }

    const user = await db.user.update({ where: { id: eff.user.id }, data });

    if (eff.impersonating) {
      await audit(
        { id: eff.actor.id, email: eff.actor.email },
        'PROFILE_UPDATED_BY_ADMIN',
        { id: eff.user.id, email: eff.user.email },
        { fields: Object.keys(data) }
      );
    }

    return NextResponse.json({ user: publicUser(user) });
  } catch (e) {
    console.error('profile error', e);
    return NextResponse.json({ error: 'Ошибка сервера, попробуйте ещё раз' }, { status: 500 });
  }
}
