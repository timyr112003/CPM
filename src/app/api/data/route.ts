import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { getEffectiveUser } from '@/lib/ep-server-auth';

/**
 * Данные приложения (снапшот JSON на пользователя).
 *  GET  → { data: object | null, updatedAt }
 *  PUT  → { data } — сохраняет снапшот (autosave клиентского sync-движка)
 *
 * В режиме управления аккаунтом (impersonation) операции применяются
 * к аккаунту учителя. Если кука просмотра стала невалидной (аккаунт
 * архивирован, права отозваны) — запись ОТКЛОНЯЕТСЯ, а не тихо уходит
 * в аккаунт администратора: так чужие данные не затирают свои.
 */

const MAX_JSON_LENGTH = 12 * 1024 * 1024; // 12 МБ
const VIEW_COOKIE = 'ep_view_as';

export async function GET() {
  const eff = await getEffectiveUser();
  if (!eff) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const row = await db.userData.findUnique({ where: { userId: eff.user.id } });
  if (!row) return NextResponse.json({ data: null, updatedAt: null });

  try {
    return NextResponse.json({ data: JSON.parse(row.data), updatedAt: row.updatedAt });
  } catch {
    return NextResponse.json({ data: null, updatedAt: null });
  }
}

export async function PUT(req: Request) {
  const eff = await getEffectiveUser();
  if (!eff) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  // Кука просмотра есть, но недействительна — не записываем никуда
  const jar = await cookies();
  if (jar.get(VIEW_COOKIE)?.value && !eff.impersonating) {
    return NextResponse.json(
      { error: 'Сессия управления аккаунтом недействительна. Выйдите из режима управления и войдите заново' },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  const data = body?.data;
  if (!data || typeof data !== 'object')
    return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 });

  const json = JSON.stringify(data);
  if (json.length > MAX_JSON_LENGTH)
    return NextResponse.json({ error: 'Слишком большой объём данных' }, { status: 413 });

  await db.userData.upsert({
    where: { userId: eff.user.id },
    create: { userId: eff.user.id, data: json },
    update: { data: json },
  });

  return NextResponse.json({ ok: true, updatedAt: new Date().toISOString() });
}
