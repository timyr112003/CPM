/**
 * Одноразовая настройка главного администратора EnglishPro.
 *
 * Запуск:
 *   EP_ADMIN_EMAIL="..." EP_ADMIN_PASSWORD="..." EP_ADMIN_NAME="..." \
 *     DATABASE_URL="file:/home/z/my-project/db/custom.db" node scripts/setup-main-admin.mjs
 *
 * Что делает:
 *  - создаёт (или обновляет) аккаунт главного администратора с указанным email/паролем;
 *  - назначает ему набор ролей ["MAIN_ADMIN"] (роль главного нельзя получить/снять через UI);
 *  - пишет запись в журнал аудита.
 *
 * Пароль передаётся только через переменную окружения и не сохраняется нигде в открытом виде.
 */
import { randomBytes, scryptSync } from 'crypto';
import { PrismaClient } from '@prisma/client';

const email = String(process.env.EP_ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.EP_ADMIN_PASSWORD || '');
const name = String(process.env.EP_ADMIN_NAME || 'Администратор').trim() || 'Администратор';

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Ошибка: EP_ADMIN_EMAIL не задан или некорректен');
  process.exit(1);
}
if (password.length < 4) {
  console.error('Ошибка: EP_ADMIN_PASSWORD не задан (минимум 4 символа)');
  process.exit(1);
}

function hashPassword(p) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(p, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const db = new PrismaClient();

try {
  const existing = await db.user.findUnique({ where: { email } });
  let admin;

  if (existing) {
    admin = await db.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: hashPassword(password),
        roles: JSON.stringify(['MAIN_ADMIN']),
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });
    console.log(`Аккаунт обновлён: ${admin.email} (id=${admin.id}) → роли ["MAIN_ADMIN"]`);
  } else {
    admin = await db.user.create({
      data: {
        email,
        name,
        passwordHash: hashPassword(password),
        roles: JSON.stringify(['MAIN_ADMIN']),
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });
    console.log(`Аккаунт создан: ${admin.email} (id=${admin.id}) → роли ["MAIN_ADMIN"]`);
  }

  // Запись в журнал аудита
  await db.auditLog.create({
    data: {
      actorId: null,
      actorEmail: 'system',
      action: 'BOOTSTRAP_MAIN_ADMIN',
      targetId: admin.id,
      targetEmail: admin.email,
      meta: JSON.stringify({ note: 'Настройка главного администратора скриптом setup-main-admin.mjs' }),
    },
  });

  // Итоговый список пользователей
  const users = await db.user.findMany({
    select: { email: true, name: true, roles: true, status: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log('\nТекущие пользователи:');
  for (const u of users) {
    console.log(`  - ${u.email} (${u.name}) — ${u.roles}, ${u.status}`);
  }
} finally {
  await db.$disconnect();
}
