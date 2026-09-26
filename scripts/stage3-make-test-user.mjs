// Создаёт тестового учителя этапа 3 с UserData: занятия сегодня (+50 мин),
// сегодня утром (для сводки), завтра/+2/+6 (для недельного плана) и одно
// отменённое (должно молча пропуститься).
// Запуск: DATABASE_URL=file:/home/z/my-project/db/custom.db node scripts/stage3-make-test-user.mjs
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const EMAIL = 'stage3@test.local';
const TZ = 'Europe/Moscow';

const pad2 = n => String(n).padStart(2, '0');
// Дата/время в Москве через сдвиг epoch + форматирование в поясе
function msk(date = new Date()) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const g = t => p.find(x => x.type === t)?.value ?? '0';
  return {
    date: `${g('year')}-${g('month')}-${g('day')}`,
    time: `${pad2(Number(g('hour')) % 24)}:${g('minute')}`,
  };
}
function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

try {
  // пересоздание, если остался от прошлого прогона
  const old = await db.user.findUnique({ where: { email: EMAIL } });
  if (old) {
    await db.auditLog.deleteMany({ where: { OR: [{ actorId: old.id }, { targetId: old.id }] } });
    await db.userData.deleteMany({ where: { userId: old.id } });
    await db.user.delete({ where: { id: old.id } });
    console.log('старый тестовый удалён');
  }

  const user = await db.user.create({
    data: {
      email: EMAIL,
      name: 'Тест Этапа 3',
      passwordHash: 'test-not-for-login',
      roles: '["TEACHER"]',
      status: 'ACTIVE',
    },
  });

  const soon = msk(new Date(Date.now() + 50 * 60 * 1000)); // +50 минут по Москве
  const today = msk().date;
  const S = [
    { id: 'st-anna', name: 'Анна Смирнова' },
    { id: 'st-boris', name: 'Борис Круглов' },
    { id: 'st-vera', name: 'Вера Ли' },
    { id: 'st-old', name: 'Архивный Ученик', archived: true },
  ];
  const L = [
    { id: 'ls-soon', date: soon.date, time: soon.time, topic: 'Разговорная практика', duration: 60, status: 'planned', isGroup: false, studentId: 'st-anna', studentIds: ['st-anna'], student: 'Анна Смирнова', notes: 'Повторить Present Perfect' },
    { id: 'ls-morning', date: today, time: '09:00', topic: 'Грамматика: Conditionals', duration: 45, status: 'planned', isGroup: false, studentId: 'st-boris', studentIds: ['st-boris'], student: 'Борис Круглов' },
    { id: 'ls-cancelled', date: today, time: '12:00', topic: 'Отменённое занятие', duration: 60, status: 'cancelled', isGroup: false, studentId: 'st-boris', studentIds: ['st-boris'], student: 'Борис Круглов' },
    { id: 'ls-tomorrow', date: addDays(today, 1), time: '10:00', topic: 'Аудирование', duration: 60, status: 'planned', isGroup: false, studentId: 'st-anna', studentIds: ['st-anna'], student: 'Анна Смирнова' },
    { id: 'ls-plus2', date: addDays(today, 2), time: '15:00', topic: 'Подготовка к экзамену', duration: 90, status: 'planned', isGroup: true, studentId: null, studentIds: ['st-anna', 'st-boris', 'st-old'], student: 'Группа В1' },
    { id: 'ls-plus6', date: addDays(today, 6), time: '12:30', topic: 'Лексика: Business', duration: 60, status: 'planned', isGroup: false, studentId: 'st-vera', studentIds: ['st-vera'], student: 'Вера Ли' },
  ];
  const snapshot = {
    students: S,
    schedule: L,
    classes: [],
    finance: [],
    subscriptions: [],
    settings: { penaltyEnabled: true, penaltyAmount: 0, penaltyPercent: 50 },
  };

  await db.userData.create({
    data: { userId: user.id, data: JSON.stringify(snapshot) },
  });

  console.log('создан:', EMAIL, user.id);
  console.log('занятие «за час»:', soon.date, soon.time, '(сейчас в Москве:', msk().time + ')');
} finally {
  await db.$disconnect();
}
