// Удаляет тестовых учителей gear2 (stage6a/stage6b) и все их следы.
// Запуск: DATABASE_URL=file:/home/z/my-project/db/custom.db node scripts/gear2-remove-test.mjs
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const EMAILS = ['stage6a@test.local', 'stage6b@test.local'];

try {
  for (const email of EMAILS) {
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      await db.auditLog.deleteMany({ where: { OR: [{ actorId: user.id }, { targetId: user.id }, { actorEmail: email }, { targetEmail: email }] } });
      await db.session.deleteMany({ where: { userId: user.id } });
      await db.userData.deleteMany({ where: { userId: user.id } });
      await db.user.delete({ where: { id: user.id } });
      console.log('удалён:', email);
    } else {
      console.log('не найден:', email);
    }
  }
  // REMINDER-маркеры тестовых аккаунтов на всякий случай
  const del = await db.auditLog.deleteMany({ where: { action: 'REMINDER_SENT', targetEmail: { in: EMAILS } } });
  if (del.count) console.log('REMINDER-маркеров удалено:', del.count);
  const rest = await db.user.findMany({ select: { email: true, roles: true }, orderBy: { createdAt: 'asc' } });
  console.log('осталось аккаунтов:', rest.length, '→', rest.map(u => u.email).join(', '));
} finally {
  await db.$disconnect();
}
