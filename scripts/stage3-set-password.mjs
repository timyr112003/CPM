// Даёт тестовому учителю этапа 3 рабочий пароль (для E2E-входа в UI)
// и опционально переключает флаг уведомлений в его снапшоте.
// Запуск: DATABASE_URL=... node scripts/stage3-set-password.mjs [notifyHourly=true|false|skip]
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const db = new PrismaClient();
const EMAIL = 'stage3@test.local';
const PASSWORD = 'Test12345';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

try {
  await db.user.update({ where: { email: EMAIL }, data: { passwordHash: hashPassword(PASSWORD) } });
  console.log('пароль установлен:', EMAIL, '/', PASSWORD);

  const flag = process.argv[2];
  if (flag && flag !== 'skip') {
    const ud = await db.userData.findUnique({ where: { userId: (await db.user.findUnique({ where: { email: EMAIL } })).id } });
    const snap = JSON.parse(ud.data);
    snap.settings = { ...(snap.settings || {}), notifyHourly: flag === 'true' };
    await db.userData.update({ where: { userId: ud.userId }, data: { data: JSON.stringify(snap) } });
    console.log('notifyHourly =', flag === 'true');
  }
} finally {
  await db.$disconnect();
}
