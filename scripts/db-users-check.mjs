// Проверка текущих пользователей в БД (read-only)
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

try {
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, createdAt: true, _count: { select: { sessions: true } } },
    orderBy: { createdAt: 'asc' },
  });
  console.log('Users:', JSON.stringify(users, null, 2));

  for (const u of users) {
    const ud = await db.userData.findUnique({ where: { userId: u.id }, select: { updatedAt: true, data: true } });
    if (ud) {
      let parsed = null;
      try { parsed = JSON.parse(ud.data); } catch { /* ignore */ }
      console.log(`- ${u.email}: userData updatedAt=${ud.updatedAt.toISOString()}, students=${parsed?.students?.length ?? '?'}, lessons=${parsed?.schedule?.length ?? '?'} bytes=${ud.data.length}`);
    } else {
      console.log(`- ${u.email}: НЕТ userData`);
    }
  }
} finally {
  await db.$disconnect();
}
