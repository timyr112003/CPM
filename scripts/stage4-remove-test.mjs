// Удаляет тестового учителя этапа 4 и все его следы (аудит, сессии, снапшот).
// Запуск: DATABASE_URL=file:/home/z/my-project/db/custom.db node scripts/stage4-remove-test.mjs
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const EMAIL = 'stage4@test.local';

try {
  const user = await db.user.findUnique({ where: { email: EMAIL } });
  if (user) {
    await db.auditLog.deleteMany({ where: { OR: [{ actorId: user.id }, { targetId: user.id }, { actorEmail: EMAIL }, { targetEmail: EMAIL }] } });
    await db.session.deleteMany({ where: { userId: user.id } });
    await db.userData.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    console.log('удалён:', EMAIL);
  } else {
    console.log('не найден — чисто');
  }
  const rest = await db.user.findMany({ select: { email: true, roles: true }, orderBy: { createdAt: 'asc' } });
  console.log('осталось аккаунтов:', rest.length, '→', rest.map(u => u.email).join(', '));
} finally {
  await db.$disconnect();
}
