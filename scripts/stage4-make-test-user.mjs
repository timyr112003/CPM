// Создаёт тестового учителя этапа 4 с настраиваемым временем уведомлений:
// settings.notifyHourlyMinutes=90, notifyDailyTime=«сейчас−2 мин»,
// notifyWeeklyTime=«сейчас−1 мин», notifyWeeklyDays=[сегодня] — все три типа
// попадают в окно отправки прямо сейчас (для dry-run движка).
// Занятия: сегодня +50 мин (в окне 90), сегодня +95 мин (вне окна 90),
// сегодня 09:00 (прошло), завтра/+2/+6 (недельный план).
// Запуск: DATABASE_URL=file:/home/z/my-project/db/custom.db node scripts/stage4-make-test-user.mjs
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const db = new PrismaClient();
const EMAIL = 'stage4@test.local';
const PASSWORD = 'Test12345';
const TZ = 'Europe/Moscow';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

const pad2 = n => String(n).padStart(2, '0');
function msk(date = new Date()) {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const g = t => p.find(x => x.type === t)?.value ?? '0';
  return {
    date: `${g('year')}-${g('month')}-${g('day')}`,
    time: `${pad2(Number(g('hour')) % 24)}:${g('minute')}`,
    minutes: (Number(g('hour')) % 24) * 60 + Number(g('minute')),
  };
}
// Минуты суток → 'HH:MM' (для времени сводок «сейчас − N мин»)
const minToTime = m => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;
function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

try {
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
      name: 'Тест Этапа 4',
      passwordHash: hashPassword(PASSWORD),
      roles: '["TEACHER"]',
      status: 'ACTIVE',
    },
  });

  const now = msk();
  const soon = msk(new Date(Date.now() + 50 * 60 * 1000));   // +50 мин — в окне 90
  const later = msk(new Date(Date.now() + 95 * 60 * 1000));  // +95 мин — ВНЕ окна 90
  const today = now.date;
  const [yy, mm, dd] = today.split('-').map(Number);
  const weekday = (new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay() + 6) % 7; // 0=Пн

  const S = [
    { id: 'st-anna', name: 'Анна Смирнова' },
    { id: 'st-boris', name: 'Борис Круглов' },
    { id: 'st-vera', name: 'Вера Ли' },
  ];
  const L = [
    { id: 'ls-soon', date: soon.date, time: soon.time, topic: 'Разговорная практика', duration: 60, status: 'planned', isGroup: false, studentId: 'st-anna', studentIds: ['st-anna'], student: 'Анна Смирнова', notes: 'Повторить Present Perfect' },
    { id: 'ls-later', date: later.date, time: later.time, topic: 'Лексика: вне окна', duration: 45, status: 'planned', isGroup: false, studentId: 'st-boris', studentIds: ['st-boris'], student: 'Борис Круглов' },
    { id: 'ls-morning', date: today, time: '09:00', topic: 'Грамматика: Conditionals', duration: 45, status: 'planned', isGroup: false, studentId: 'st-boris', studentIds: ['st-boris'], student: 'Борис Круглов' },
    { id: 'ls-tomorrow', date: addDays(today, 1), time: '10:00', topic: 'Аудирование', duration: 60, status: 'planned', isGroup: false, studentId: 'st-anna', studentIds: ['st-anna'], student: 'Анна Смирнова' },
    { id: 'ls-plus2', date: addDays(today, 2), time: '15:00', topic: 'Подготовка к экзамену', duration: 90, status: 'planned', isGroup: true, studentId: null, studentIds: ['st-anna', 'st-boris'], student: 'Группа B1' },
    { id: 'ls-plus6', date: addDays(today, 6), time: '12:30', topic: 'Лексика: Business', duration: 60, status: 'planned', isGroup: false, studentId: 'st-vera', studentIds: ['st-vera'], student: 'Вера Ли' },
  ];
  const snapshot = {
    students: S,
    schedule: L,
    classes: [],
    finance: [],
    subscriptions: [],
    settings: {
      penaltyEnabled: true, penaltyAmount: 0, penaltyPercent: 50,
      notifyDaily: true, notifyHourly: true, notifyWeekly: true,
      notifyHourlyMinutes: 90,
      notifyDailyTime: minToTime(now.minutes - 2),
      notifyWeeklyTime: minToTime(now.minutes - 1),
      notifyWeeklyDays: [weekday],
    },
  };

  await db.userData.create({ data: { userId: user.id, data: JSON.stringify(snapshot) } });

  console.log('создан:', EMAIL, '/', PASSWORD, user.id);
  console.log(`сейчас в Москве: ${now.time}, weekday=${weekday}`);
  console.log(`занятие «в окне»: ${soon.time} (+50 мин), «вне окна»: ${later.time} (+95 мин, лимит 90)`);
  console.log(`сводки: daily=${snapshot.settings.notifyDailyTime}, weekly=${snapshot.settings.notifyWeeklyTime}, дни=[${weekday}]`);
} finally {
  await db.$disconnect();
}
