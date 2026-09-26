// Создаёт временный тестовый гибрид-аккаунт (учитель + админ) для e2e-проверки UI.
// Удаляется скриптом e2e-remove-hybrid.mjs. Не трогает реальные аккаунты.
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

const db = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const EMAIL = 'ui-fix-hybrid@test.local';

try {
  const existing = await db.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    await db.user.delete({ where: { email: EMAIL } }).catch(() => {});
  }
  const u = await db.user.create({
    data: {
      name: 'Тест Кабинеты',
      email: EMAIL,
      passwordHash: hashPassword('Test1234!'),
      roles: JSON.stringify(['TEACHER', 'ADMIN']),
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  });
  console.log('created hybrid:', u.id, u.email);
} finally {
  await db.$disconnect();
}
