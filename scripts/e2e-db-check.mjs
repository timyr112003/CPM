// Проверка результатов E2E: данные учителя/админа + журнал аудита
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

try {
  const users = await db.user.findMany({
    select: { id: true, email: true, role: true, status: true, mustChangePassword: true },
  });
  for (const u of users) {
    const ud = await db.userData.findUnique({ where: { userId: u.id } });
    let students = [];
    if (ud) { try { students = JSON.parse(ud.data).students || []; } catch { /* */ } }
    console.log(`${u.email} [${u.role}/${u.status}${u.mustChangePassword ? '/TEMP-PWD' : ''}] → students: ${students.map(s => s.name).join(', ') || '∅'}`);
  }

  console.log('\n--- AuditLog (последние 12, новые сверху) ---');
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 12 });
  for (const l of logs) {
    console.log(`${l.createdAt.toISOString().slice(5, 16).replace('T', ' ')} | ${l.actorEmail} → ${l.action} → ${l.targetEmail ?? '-'} ${l.meta ?? ''}`);
  }
} finally {
  await db.$disconnect();
}
