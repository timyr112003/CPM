/**
 * Разбор кейса: тик планировщика в 18:11 отправил письма тестовому учителю,
 * ученику Ивану и родителю Марии, но НЕ отправил родителю Анны (custom, 200 мин).
 * Смотрим: сырой снапшот тестового пользователя + все аудиты 18:09–18:14.
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });

const u = await p.user.findFirst({
  where: { email: 'ep-test-reset@yandex.ru' },
  select: { id: true, email: true, userData: { select: { data: true } } },
});
if (u) {
  const d = JSON.parse(u.userData.data);
  console.log('=== Снапшот тестового пользователя ===');
  console.log('settings.notifyParentLesson =', d.settings?.notifyParentLesson);
  for (const s of d.students) {
    console.log(`- ${s.id} ${s.name}: email=${JSON.stringify(s.email)}, parent=${JSON.stringify(s.parent ?? null)}, notify=${JSON.stringify(s.notify ?? null)}`);
  }
  for (const l of d.schedule) {
    console.log(`- ${l.id} ${l.date} ${l.time} ${l.status} studentIds=${JSON.stringify(l.studentIds)}`);
  }
} else {
  console.log('Тестовый пользователь не найден (уже удалён?)');
}

const from = new Date('2026-09-26T18:09:00Z');
const to = new Date('2026-09-26T18:14:00Z');
const audits = await p.auditLog.findMany({
  where: { createdAt: { gte: from, lte: to }, action: { startsWith: 'REMINDER' } },
  orderBy: { createdAt: 'asc' },
});
console.log('\n=== Аудиты REMINDER_* 18:09–18:14 UTC ===');
for (const a of audits) {
  let meta = {};
  try { meta = JSON.parse(a.meta || '{}'); } catch {}
  console.log(`${a.createdAt.toISOString()}  ${a.action}  to=${a.targetEmail}  targetId=${a.targetId}  type=${meta.type} lesson=${meta.lessonId ?? '-'} msgId=${(meta.messageId ?? '').slice(0, 30)}`);
}

await p.$disconnect();
