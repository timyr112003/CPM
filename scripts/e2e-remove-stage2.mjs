// Удаляет тестовые аккаунты этапа 2 и все их следы (сессии, данные, журнал).
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const EMAILS = [
  'mail-stage1@test.local',
  'stage2-invite@test.local',
  'stage2-manual@test.local',
  'stage2-fallback@test.local',
  'stage2-e2e@test.local',
];

try {
  for (const EMAIL of EMAILS) {
    const u = await db.user.findUnique({ where: { email: EMAIL } });
    if (!u) {
      console.log('нет', EMAIL);
      continue;
    }
    await db.auditLog.deleteMany({
      where: { OR: [{ actorId: u.id }, { targetId: u.id }, { actorEmail: EMAIL }, { targetEmail: EMAIL }] },
    });
    await db.session.deleteMany({ where: { userId: u.id } });
    await db.userData.deleteMany({ where: { userId: u.id } });
    await db.user.delete({ where: { id: u.id } });
    console.log('удалён', EMAIL, u.id);
  }
} finally {
  await db.$disconnect();
}
