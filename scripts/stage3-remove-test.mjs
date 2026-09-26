// Удаляет тестовый аккаунт этапа 3 и все его следы (данные, аудит, сессии).
// Запуск: DATABASE_URL=file:/home/z/my-project/db/custom.db node scripts/stage3-remove-test.mjs
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const EMAIL = 'stage3@test.local';

try {
  const u = await db.user.findUnique({ where: { email: EMAIL } });
  if (!u) {
    console.log('нет', EMAIL);
  } else {
    await db.auditLog.deleteMany({
      where: { OR: [{ actorId: u.id }, { targetId: u.id }, { actorEmail: EMAIL }, { targetEmail: EMAIL }] },
    });
    await db.session.deleteMany({ where: { userId: u.id } });
    await db.userData.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } });
    console.log('удалён', EMAIL, u.id);
  }
  // контроль: в БД остались только реальные аккаунты
  const left = await db.user.findMany({ select: { email: true }, orderBy: { createdAt: 'asc' } });
  console.log('остались:', left.map(x => x.email).join(', '));
} finally {
  await db.$disconnect();
}
