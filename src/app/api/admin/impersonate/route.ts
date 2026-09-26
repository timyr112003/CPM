import { NextResponse } from 'next/server';
import { audit, clearViewAs, getEffectiveUser } from '@/lib/ep-server-auth';

/** Выход из режима управления аккаунтом — возврат в свой аккаунт */
export async function DELETE() {
  const eff = await getEffectiveUser();
  if (!eff) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  if (eff.impersonating) {
    await audit(
      { id: eff.actor.id, email: eff.actor.email },
      'IMPERSONATE_END',
      { id: eff.user.id, email: eff.user.email }
    );
  }
  await clearViewAs();
  return NextResponse.json({ ok: true });
}
