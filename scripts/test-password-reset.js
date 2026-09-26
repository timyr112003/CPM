/**
 * Тестовый сценарий «Забыли пароль» + напоминания ученику/родителю.
 * Создаёт тестовый аккаунт, прогоняет forgot/reset API, проверяет dry=1 движка,
 * и удаляет за собой все тестовые данные (user → каскад UserData/токены).
 */
const { PrismaClient } = require('@prisma/client');
const { createHash, randomBytes, scryptSync } = require('crypto');
const p = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });

const EMAIL = 'ep-test-reset@yandex.ru';
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const hashPassword = (pw) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
};

async function main() {
  // ── 0. Уборка от прошлых запусков ──
  await p.user.deleteMany({ where: { email: EMAIL } });
  await p.auditLog.deleteMany({ where: { targetEmail: EMAIL } });
  await p.auditLog.deleteMany({ where: { action: { in: ['PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_DONE'] }, targetEmail: null, meta: { contains: EMAIL } } });

  // ── 1. Тестовый учитель ──
  const u = await p.user.create({
    data: {
      email: EMAIL,
      name: 'Тест ЗабылиПароль',
      passwordHash: hashPassword('old-pass-123'),
      roles: JSON.stringify(['TEACHER']),
      status: 'ACTIVE',
      mustChangePassword: false,
    },
  });
  console.log('1. Тестовый учитель создан:', u.id);

  // ── 2. forgot-password → токен в БД + аудит ──
  const r1 = await fetch('http://localhost:3000/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL.toUpperCase() }), // проверим нормализацию регистра
  }).then(r => r.json());
  console.log('2. forgot-password ответ:', JSON.stringify(r1));
  const tok1 = await p.passwordResetToken.findFirst({ where: { userId: u.id } });
  console.log('   токен создан:', !!tok1, '| expires через ~60 мин:', tok1 ? Math.round((tok1.expiresAt - new Date()) / 60000) + ' мин' : '—');
  const aud1 = await p.auditLog.findFirst({ where: { action: 'PASSWORD_RESET_REQUESTED', targetId: u.id }, orderBy: { createdAt: 'desc' } });
  console.log('   аудит REQUESTED:', !!aud1, '| письмо ok:', aud1 ? JSON.parse(aud1.meta).ok : '—');

  // ── 3. Повторный запрос аннулирует прежний токен ──
  await fetch('http://localhost:3000/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL }),
  });
  const live = await p.passwordResetToken.count({ where: { userId: u.id, usedAt: null } });
  console.log('3. После повторного запроса неиспользованных токенов:', live, '(1 — прежний аннулирован)');

  // ── 4. reset-password по «ссылке из письма» ──
  const fresh = await p.passwordResetToken.findFirst({ where: { userId: u.id, usedAt: null }, orderBy: { createdAt: 'desc' } });
  // В БД только хеш; для теста делаем СВОЙ токен и подменяем хеш — имитация открытия ссылки
  const myToken = randomBytes(32).toString('base64url');
  await p.passwordResetToken.update({ where: { id: fresh.id }, data: { tokenHash: sha256(myToken) } });

  const bad = await fetch('http://localhost:3000/api/auth/reset-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: myToken + 'x', newPassword: 'new-pass-456' }),
  }).then(r => r.json());
  console.log('4a. Неверный токен отклонён:', !!bad.error, '—', bad.error);

  const short = await fetch('http://localhost:3000/api/auth/reset-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: myToken, newPassword: 'abc' }),
  }).then(r => r.json());
  console.log('4b. Короткий пароль отклонён:', !!short.error, '—', short.error);

  const ok = await fetch('http://localhost:3000/api/auth/reset-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: myToken, newPassword: 'new-pass-456' }),
  }).then(r => r.json());
  console.log('4c. Смена пароля:', JSON.stringify(ok));

  const after = await p.user.findUnique({ where: { id: u.id } });
  const [, hashPart] = after.passwordHash.split(':');
  const checkOk = scryptSync('new-pass-456', after.passwordHash.split(':')[0], 64).toString('hex') === hashPart;
  const tokUsed = await p.passwordResetToken.findFirst({ where: { userId: u.id } });
  const aud2 = await p.auditLog.findFirst({ where: { action: 'PASSWORD_RESET_DONE', targetId: u.id } });
  console.log('   новый пароль действителен:', checkOk, '| mustChangePassword =', after.mustChangePassword);
  console.log('   токен помечен usedAt:', !!tokUsed.usedAt, '| аудит DONE:', !!aud2);

  // ── 5. Повторное использование токена отклоняется ──
  const reuse = await fetch('http://localhost:3000/api/auth/reset-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: myToken, newPassword: 'another-pass' }),
  }).then(r => r.json());
  console.log('5. Повторное использование токена отклонено:', !!reuse.error);

  // ── 6. Сессии отозваны (пусто и так), вход со старым паролем больше не работает ──
  const oldLogin = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: 'old-pass-123' }),
  }).then(r => r.json());
  console.log('6. Вход со старым паролем отклонён:', !!oldLogin.error);
  const newLogin = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: 'new-pass-456' }),
  }).then(r => r.status);
  console.log('   Вход с новым паролем:', newLogin === 200 ? 'ok' : 'fail ' + newLogin);

  await p.$disconnect();
}

main().catch(e => { console.error('FAIL:', e); process.exitCode = 1; });
