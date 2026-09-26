/**
 * E2E-пользователь для проверки настроек уведомлений:
 * учитель с двумя учениками (email + родитель), общие напоминания
 * ученику/родителю ВЫКЛЮЧЕНЫ (для проверки предупреждения в модалке).
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';
const p = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });

const EMAIL = 'e2e-notify@test.local';
await p.user.deleteMany({ where: { email: EMAIL } });

const salt = randomBytes(16).toString('hex');
const u = await p.user.create({
  data: {
    email: EMAIL,
    name: 'Е2Е Настройки',
    passwordHash: `${salt}:${scryptSync('test-1234', salt, 64).toString('hex')}`,
    roles: JSON.stringify(['TEACHER']),
    status: 'ACTIVE',
  },
});

const pad2 = n => String(n).padStart(2, '0');
const now = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
const num = t => Number(now.find(x => x.type === t).value);
const date = `${num('year')}-${pad2(num('month'))}-${pad2(num('day'))}`;

const data = {
  format: 2,
  students: [
    { id: 'st-e2e-anna', name: 'Анна Е2Е', email: 'anna-e2e@example.com', rate: 1000, balance: 0, notes: '', phone: '',
      parent: { name: 'Ольга Е2Е', email: 'olga-e2e@example.com' },
      notify: { mode: 'custom', toStudent: true, toParent: true, minutes: 45 } },
    { id: 'st-e2e-ivan', name: 'Иван Е2Е', email: 'ivan-e2e@example.com', rate: 1000, balance: 0, notes: '', phone: '',
      parent: { name: 'Мария Е2Е', email: 'maria-e2e@example.com' } },
  ],
  classes: [],
  schedule: [
    { id: 'les-e2e-1', date, time: '18:00', status: 'planned', isGroup: false, student: 'Анна Е2Е', studentId: 'st-e2e-anna', studentIds: ['st-e2e-anna'], topic: 'Тест', duration: 60 },
  ],
  finance: [],
  subscriptions: [],
  settings: {
    penaltyEnabled: true, penaltyAmount: 0, penaltyPercent: 50,
    notifyDaily: false, notifyHourly: false, notifyWeekly: false,
    notifyDailyTime: '07:00', notifyHourlyMinutes: 60, notifyWeeklyTime: '07:00', notifyWeeklyDays: [0],
    notifyStudentLesson: false, notifyStudentLessonMinutes: 60,
    notifyParentLesson: false, notifyParentLessonMinutes: 60,
  },
};
await p.userData.create({ data: { userId: u.id, data: JSON.stringify(data) } });
console.log('E2E-пользователь готов:', EMAIL, '/ test-1234');
await p.$disconnect();
