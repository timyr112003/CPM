import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/ep-server-auth';

export async function POST() {
  try {
    await destroySession();
  } catch (e) {
    console.error('logout error', e);
  }
  return NextResponse.json({ ok: true });
}
