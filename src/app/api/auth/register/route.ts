import { NextResponse } from 'next/server';

/**
 * Самостоятельная регистрация отключена.
 * Аккаунты создаёт администратор: POST /api/admin/users.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Самостоятельная регистрация отключена. Аккаунт создаёт администратор' },
    { status: 403 }
  );
}
