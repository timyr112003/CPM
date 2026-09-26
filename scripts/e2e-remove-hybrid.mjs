// Удаляет временный тестовый гибрид-аккаунт и все его следы (сессии, данные, журнал).
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const EMAIL = 'ui-fix-hybrid@test.local';

try {
  const u = await db.user.findUnique({ where: { email: EMAIL } });
  if (!u) {
    console.log('no test user, nothing to do');
  } else {
    await db.auditLog.deleteMany({
      where: { OR: [{ actorId: u.id }, { targetId: u.id }, { actorEmail: EMAIL }, { targetEmail: EMAIL }] },
    });
    await db.session.deleteMany({ where: { userId: u.id } });
    await db.userData.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } });
    console.log('removed test hybrid + traces:', u.id);
  }
} finally {
  await db.$disconnect();
}
