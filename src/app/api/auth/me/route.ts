import { NextResponse } from 'next/server';
import { getEffectiveUser } from '@/lib/ep-server-auth';

/**
 * Текущая сессия: user — кто вошёл (актор),
 * impersonating — чей аккаунт открыт в режиме управления (если включён).
 */
export async function GET() {
  const eff = await getEffectiveUser();
  if (!eff) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  return NextResponse.json({
    user: eff.actor,
    impersonating: eff.impersonating
      ? { id: eff.user.id, name: eff.user.name, email: eff.user.email }
      : null,
  });
}
