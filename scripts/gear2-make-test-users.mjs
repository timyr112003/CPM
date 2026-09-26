// Создаёт двух тестовых учителей для проверки индивидуальных настроек уведомлений:
//  - stage6a@test.local — снапшот со старым форматом settings (без notify-полей,
//    как у реальных аккаунтов до этапа 4) + ученики и занятия;
//  - stage6b@test.local — БЕЗ снапшота вовсе (как thomfvdasage@yandex.ru) —
//    именно на таких аккаунтах раньше «протекали» настройки предыдущего.
// Запуск: DATABASE_URL=file:/home/z/my-project/db/custom.db node scripts/gear2-make-test-users.mjs
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const db = new PrismaClient();
const PASSWORD = 'Test12345';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

const pad2 = n => String(n).padStart(2, '0');
function mskDate(offsetDays = 0) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const g = t => p.find(x => x.type === t)?.value ?? '0';
  const date = `${g('year')}-${g('month')}-${g('day')}`;
  return offsetDays ? addDays(date, offsetDays) : date;
}
function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

async function makeUser(email, name, withSnapshot) {
  const old = await db.user.findUnique({ where: { email } });
  if (old) {
    await db.auditLog.deleteMany({ where: { OR: [{ actorId: old.id }, { targetId: old.id }, { actorEmail: email }, { targetEmail: email }] } });
    await db.session.deleteMany({ where: { userId: old.id } });
    await db.userData.deleteMany({ where: { userId: old.id } });
    await db.user.delete({ where: { id: old.id } });
    console.log('старый удалён:', email);
  }
  const u = await db.user.create({
    data: {
      email, name,
      passwordHash: hashPassword(PASSWORD),
      roles: '["TEACHER"]',
      status: 'ACTIVE',
    },
  });
  if (withSnapshot) {
    const today = mskDate(0);
    const snap = {
      format: 2,
      students: [
        { id: 'st-a1', name: 'Анна Тест', phone: '', email: '', rate: 1000, notes: '', balance: 0 },
        { id: 'st-a2', name: 'Борис Тест', phone: '', email: '', rate: 1200, notes: '', balance: 0 },
      ],
      classes: [],
      schedule: [
        { id: 'ls-a1', date: today, time: '12:00', topic: 'Грамматика', duration: 60, price: 1000, status: 'planned', isGroup: false, classId: null, studentId: 'st-a1', studentIds: [], student: 'Анна Тест', recurringGroupId: null },
        { id: 'ls-a2', date: addDays(today, 1), time: '15:30', topic: 'Лексика', duration: 90, price: 1200, status: 'planned', isGroup: false, classId: null, studentId: 'st-a2', studentIds: [], student: 'Борис Тест', recurringGroupId: null },
      ],
      finance: [],
      subscriptions: [],
      // Старый формат: только штрафы, notify-полей НЕТ (дефолты подставит UI/движок)
      settings: { penaltyEnabled: true, penaltyAmount: 0, penaltyPercent: 50 },
    };
    await db.userData.create({ data: { userId: u.id, data: JSON.stringify(snap) } });
  }
  console.log('создан:', email, withSnapshot ? '(со снапшотом, settings без notify-полей)' : '(БЕЗ снапшота)');
}

try {
  await makeUser('stage6a@test.local', 'Тест Учитель А', true);
  await makeUser('stage6b@test.local', 'Тест Учитель Б', false);
  const rest = await db.user.findMany({ select: { email: true }, orderBy: { createdAt: 'asc' } });
  console.log('всего аккаунтов:', rest.length);
} finally {
  await db.$disconnect();
}
