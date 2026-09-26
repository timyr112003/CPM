// Патчит settings в снапшоте тестового учителя этапа 4 (для негативных сценариев
// движка и восстановления). JSON передаётся первым аргументом.
// Пример: DATABASE_URL=... node scripts/stage4-set-settings.mjs '{"notifyHourlyMinutes":30}'
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const EMAIL = 'stage4@test.local';

try {
  const patch = JSON.parse(process.argv[2] || '{}');
  const user = await db.user.findUnique({ where: { email: EMAIL } });
  if (!user) throw new Error('тестовый учитель не найден');
  const ud = await db.userData.findUnique({ where: { userId: user.id } });
  const snap = JSON.parse(ud.data);
  snap.settings = { ...(snap.settings || {}), ...patch };
  await db.userData.update({ where: { userId: ud.userId }, data: { data: JSON.stringify(snap) } });
  console.log('settings обновлены:', JSON.stringify(patch));
} finally {
  await db.$disconnect();
}
