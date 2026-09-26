/** Уборка тестового учителя ep-test-reset@yandex.ru и его дедуп-маркеров. */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });

const u = await p.user.deleteMany({ where: { email: 'ep-test-reset@yandex.ru' } });
const a1 = await p.auditLog.deleteMany({ where: { targetEmail: 'ep-test-reset@yandex.ru', action: 'REMINDER_SENT' } });
const a2 = await p.auditLog.deleteMany({ where: { action: 'REMINDER_SENT', targetId: { in: ['st-ivan', 'st-anna', 'st-olga'] } } });
console.log(`удалено: пользователей=${u.count}, аудитов(почта)=${a1.count}, аудитов(маркеры)=${a2.count}`);
await p.$disconnect();
