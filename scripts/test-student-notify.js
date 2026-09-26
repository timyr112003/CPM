/**
 * Тест напоминаний ученику/родителю: ставим тестовому учителю снапшот с
 * занятиями «сегодня через N минут» и разными настройками, прогоняем dry=1.
 * Проверяем: письма педагогу/ученику/родителю, личные настройки ученика,
 * отсутствие email, дедуп-ключи. Реальные письма НЕ отправляются (dry=1).
 */
const { PrismaClient } = require('@prisma/client');
const { createHash, randomBytes, scryptSync } = require('crypto');
const p = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });

const EMAIL = 'ep-test-reset@yandex.ru';
const SECRET = '6daa27675c655dcde6a5bb3436f286a23705';
const pad2 = n => String(n).padStart(2, '0');
// Уникальные id учеников/занятий на прогон — иначе дедуп-маркеры прошлого
// прогона подавят письма в текущем (дедуп устроен по targetId|type|lessonId)
const RUN = Date.now().toString(36);
const hashPassword = (pw) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
};

/** Дата/время «сегодня» в Europe/Moscow (как их хранит приложение) */
function moscowToday() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const num = t => Number(parts.find(x => x.type === t)?.value ?? '0');
  return { date: `${num('year')}-${pad2(num('month'))}-${pad2(num('day'))}`, hour: num('hour') % 24, minute: num('minute') };
}

async function hourlyDry() {
  const res = await fetch(`http://localhost:3000/api/cron/reminders?secret=${SECRET}&type=hourly&dry=1`);
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function main() {
  // ── 0. Уборка от прошлых прогонов: аккаунт + аудиты дедупа с фиксированными id учеников
  await p.user.deleteMany({ where: { email: EMAIL } });
  await p.auditLog.deleteMany({ where: { targetEmail: EMAIL, action: 'REMINDER_SENT' } });
  await p.auditLog.deleteMany({ where: { action: 'REMINDER_SENT', targetId: { in: ['st-ivan', 'st-anna', 'st-olga'] } } });
  const u = await p.user.create({
    data: {
      email: EMAIL,
      name: 'Тест Напоминаний',
      passwordHash: hashPassword('pass-1234'),
      roles: JSON.stringify(['TEACHER']),
      status: 'ACTIVE',
    },
  });
  console.log('1. Тестовый учитель создан (run', RUN + ')');

  const { date, hour, minute } = moscowToday();
  const hm = hour * 60 + minute;
  const t = m => `${pad2(Math.floor(((hm + m) % 1440) / 60))}:${pad2((hm + m) % 60)}`;

  // ── 2. Снапшот: ученики + занятия + настройки ──
  const students = [
    {
      id: 'st-ivan', name: 'Иван Тестовый', email: 'ivan@example.com', rate: 1000, balance: 0, notes: '', phone: '',
      // «Как у всех» → общие настройки (ученику и родителю включены)
      parent: { name: 'Мария Петровна', email: 'maria@example.com' },
    },
    {
      id: 'st-anna', name: 'Анна Тестовая', email: 'anna@example.com', rate: 1200, balance: 0, notes: '', phone: '',
      // «Свои настройки»: только родителю, за 200 минут
      parent: { name: 'Ольга Сергеевна', email: 'anna-parent@example.com' },
      notify: { mode: 'custom', toStudent: false, toParent: true, minutes: 200 },
    },
    {
      id: 'st-olga', name: 'Ольга БезПочты', rate: 900, balance: 0, notes: '', phone: '',
      // «Свои настройки»: ученику включено, но email пуст → пропуск с пояснением
      notify: { mode: 'custom', toStudent: true, toParent: false, minutes: 45 },
    },
  ];
  const lessons = [
    { id: `les-1-${RUN}`, date, time: t(30), status: 'planned', isGroup: false, student: 'Иван Тестовый', studentId: 'st-ivan', studentIds: ['st-ivan'], topic: 'Present Perfect', duration: 60 },
    { id: `les-2-${RUN}`, date, time: t(30), status: 'planned', isGroup: false, student: 'Анна Тестовая', studentId: 'st-anna', studentIds: ['st-anna'], topic: 'Conditionals', duration: 45 },
    { id: `les-3-${RUN}`, date, time: t(20), status: 'planned', isGroup: false, student: 'Ольга БезПочты', studentId: 'st-olga', studentIds: ['st-olga'], topic: 'Аудирование', duration: 60 },
    { id: `les-4-${RUN}`, date, time: t(400), status: 'planned', isGroup: false, student: 'Иван Тестовый', studentId: 'st-ivan', studentIds: ['st-ivan'], topic: 'Далеко — в окно не попадёт', duration: 60 },
    { id: `les-5-${RUN}`, date, time: t(25), status: 'cancelled', isGroup: false, student: 'Иван Тестовый', studentId: 'st-ivan', studentIds: ['st-ivan'], topic: 'Отменён — не напоминаем', duration: 60 },
  ];
  const data = {
    format: 2,
    students,
    classes: [],
    schedule: lessons,
    finance: [],
    subscriptions: [],
    settings: {
      penaltyEnabled: true, penaltyAmount: 0, penaltyPercent: 50,
      notifyDaily: true, notifyHourly: true, notifyWeekly: true,
      notifyDailyTime: '07:00', notifyHourlyMinutes: 60, notifyWeeklyTime: '07:00', notifyWeeklyDays: [0],
      // Общие напоминания ученику/родителю: ВКЛЮЧЕНЫ
      notifyStudentLesson: true, notifyStudentLessonMinutes: 60,
      notifyParentLesson: true, notifyParentLessonMinutes: 60,
    },
  };
  await p.userData.create({ data: { userId: u.id, data: JSON.stringify(data) } });
  console.log(`2. Снапшот готов: сегодня ${date}, сейчас ${t(0)}; занятия через 30/30/20/400 мин + отменённое через 25`);

  // ── 3. dry=1 прогон ──
  const { status, json } = await hourlyDry();
  console.log(`\n3. dry=1 type=hourly → HTTP ${status}`);
  console.log('   sent/skipped/errors:', json.sent, json.skipped, json.errors);
  for (const d of json.details) console.log('   •', d);

  // В dry-строке показываются только адрес и тема письма:
  //  педагогу — «в HH:MM занятие — Имя», ученику — «твоё занятие сегодня»,
  //  родителю — «занятие Имя сегодня»
  const s = JSON.stringify(json.details);
  const checks = [
    ['педагогу: письмо по своему занятию les-1 (Иван, 20:xx)', s.includes(`EnglishPro: в ${t(30)} занятие — Иван Тестовый`)],
    ['ученику Иван (как у всех, окно 60, через 30)', s.includes('ivan@example.com') && s.includes('твоё занятие сегодня')],
    ['родителю Иван (как у всех, окно 60)', s.includes('maria@example.com') && s.includes('Иван Тестовый — занятие сегодня')],
    ['Анна: свои настройки — родителю за 200', s.includes('anna-parent@example.com')],
    ['Анна: ученику НЕ шлём (toStudent=false)', !s.includes('anna@example.com')],
    ['Ольга: email не указан → пояснение', s.includes('Ольга БезПочты: нет email')],
    ['les-4 (через 400 мин) не попал в окна', !s.includes('Далеко')],
    ['отменённый les-5 не напоминается', !s.includes('не напоминаем')],
  ];
  console.log('\n4. Проверки:');
  let allOk = true;
  for (const [name, ok] of checks) { console.log(`   ${ok ? '✓' : '✗'} ${name}`); if (!ok) allOk = false; }

  console.log(allOk ? '\n4. ИТОГ: все проверки пройдены' : '\n4. ИТОГ: ЕСТЬ ПРОВАЛЫ');

  // ── 4б. Главный выключатель: общие ученик/родитель OFF → личные не работают ──
  // Даже «Свои настройки» Анны (родителю включён) не должны отправлять письма.
  const dataOff = { ...data, settings: { ...data.settings, notifyStudentLesson: false, notifyParentLesson: false } };
  await p.userData.updateMany({ where: { userId: u.id }, data: { data: JSON.stringify(dataOff) } });
  const r2 = await hourlyDry();
  const s2 = JSON.stringify(r2.json.details);
  console.log('\n4б. Главный выключатель (общие ученик/родитель OFF):');
  const checks2 = [
    ['педагогу письма остаются', s2.includes(`EnglishPro: в ${t(30)} занятие — Иван Тестовый`)],
    ['ученику не шлём (даже «как у всех»)', !s2.includes('ivan@example.com')],
    ['родителю не шлём (включая custom Анны)', !s2.includes('anna-parent@example.com') && !s2.includes('maria@example.com')],
    ['пояснение про отключение в общих настройках', s2.includes('напоминания ученикам и родителям отключены в общих настройках')],
  ];
  let allOk2 = true;
  for (const [name, ok] of checks2) { console.log(`   ${ok ? '✓' : '✗'} ${name}`); if (!ok) allOk2 = false; }
  console.log(allOk2 ? '   ИТОГ 4б: все проверки пройдены' : '   ИТОГ 4б: ЕСТЬ ПРОВАЛЫ');
  if (!allOk || !allOk2) process.exitCode = 1;

  // ── 5. Самоочистка сразу после прогона ──
  // Тестовый учитель с фейковыми занятиями не должен оставаться в БД:
  // встроенный планировщик (тик каждые 5 минут) иначе отправит НАСТОЯЩИЕ
  // письма на фейковые адреса. Сначала удаляем пользователя (тик его больше
  // не видит), потом чистим аудиты-маркеры дедупа этого прогона.
  await p.user.deleteMany({ where: { email: EMAIL } });
  await p.auditLog.deleteMany({ where: { OR: [
    { targetEmail: EMAIL, action: 'REMINDER_SENT' },
    { action: 'REMINDER_SENT', targetId: { in: ['st-ivan', 'st-anna', 'st-olga'] } },
  ] } });
  console.log('5. Самоочистка: тестовый учитель и его дедуп-маркеры удалены');

  await p.$disconnect();
}

main().catch(e => { console.error('FAIL:', e); process.exitCode = 1; });
