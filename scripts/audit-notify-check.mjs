/**
 * Проверка здоровья уведомлений по AuditLog:
 *  - REMINDER_SENT по типам за 14 дней;
 *  - REMINDER_ERROR за 14 дней (с расшифровкой ошибок);
 *  - дубли дедуп-ключей (один и тот же ключ отправлен дважды);
 *  - активные учителя: настройки уведомлений + наличие email у учеников.
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } });

const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

const sent = await p.auditLog.findMany({
  where: { action: 'REMINDER_SENT', createdAt: { gte: since } },
  orderBy: { createdAt: 'asc' },
});
const errs = await p.auditLog.findMany({
  where: { action: 'REMINDER_ERROR', createdAt: { gte: since } },
  orderBy: { createdAt: 'asc' },
});

// ── Отправки по типам ──
const byType = {};
for (const s of sent) {
  let meta = {};
  try { meta = JSON.parse(s.meta || '{}'); } catch {}
  const t = meta.type ?? '?';
  byType[t] = (byType[t] ?? 0) + 1;
}
console.log('=== REMINDER_SENT за 14 дней, по типам ===');
for (const [t, n] of Object.entries(byType)) console.log(`  ${t}: ${n}`);
if (!sent.length) console.log('  (нет отправок)');

// ── Последние 12 отправок ──
console.log('\n=== Последние 12 отправок ===');
for (const s of sent.slice(-12)) {
  let meta = {};
  try { meta = JSON.parse(s.meta || '{}'); } catch {}
  console.log(`  ${s.createdAt.toISOString().slice(0, 16).replace('T', ' ')}Z  ${s.targetEmail ?? s.targetId}  [${meta.type}]${meta.lessonId ? ' lesson=' + meta.lessonId.slice(0, 10) : ''}`);
}

// ── Ошибки ──
console.log('\n=== REMINDER_ERROR за 14 дней ===');
if (!errs.length) console.log('  ошибок нет ✓');
for (const e of errs) {
  let meta = {};
  try { meta = JSON.parse(e.meta || '{}'); } catch {}
  console.log(`  ${e.createdAt.toISOString().slice(0, 16).replace('T', ' ')}Z  ${e.targetEmail ?? e.targetId}  ${meta.type ?? ''} → ${meta.error ?? '?'}`);
}

// ── Дубли дедуп-ключей ──
const keys = new Map();
for (const s of sent) {
  let meta = {};
  try { meta = JSON.parse(s.meta || '{}'); } catch {}
  const t = meta.type ?? '';
  let key;
  if (s.targetId && meta.lessonId && ['hourly', 'student-hourly', 'parent-hourly'].includes(t)) key = `${s.targetId}|${t}|${meta.lessonId}`;
  else if (t && meta.date && s.targetId) key = `${s.targetId}|${t}|${meta.date}`;
  if (key) keys.set(key, (keys.get(key) ?? 0) + 1);
}
const dupes = [...keys.entries()].filter(([, n]) => n > 1);
console.log('\n=== Дубли дедуп-ключей (одно письмо дважды) ===');
if (!dupes.length) console.log('  дублей нет ✓');
for (const [k, n] of dupes) console.log(`  ×${n}  ${k}`);

// ── Активные учителя: настройки + email-покрытие учеников ──
// Дефолты зеркалят parseSnapshot (ep-reminders.ts): поле не задано →
// daily/hourly/weekly ВКЛЮЧЕНЫ, ученик/родитель ВЫКЛЮЧЕНЫ, минуты 60.
const boolDef = (v, def) => (v === undefined ? def : v === true);
const minutesDef = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 5 ? Math.min(n, 1440) : 60; };
const hm = (m) => (m >= 60 ? `${Math.floor(m / 60)} ч${m % 60 ? ` ${m % 60} мин` : ''}` : `${m} мин`);

console.log('\n=== Активные учителя: настройки напоминаний (как трактует движок) ===');
const users = await p.user.findMany({
  where: { status: 'ACTIVE' },
  select: { id: true, name: true, email: true, roles: true, userData: { select: { data: true } } },
});
for (const u of users) {
  const roles = (() => { try { return JSON.parse(u.roles || '[]'); } catch { return []; } })();
  if (!roles.includes('TEACHER') || !u.userData?.data) continue;
  let d = {};
  try { d = JSON.parse(u.userData.data); } catch {}
  const st = d.settings ?? {};
  const students = d.students ?? [];
  const withEmail = students.filter(s => !s.archived && String(s.email ?? '').trim()).length;
  const withParentEmail = students.filter(s => !s.archived && String(s?.parent?.email ?? '').trim()).length;
  const live = students.filter(s => !s.archived).length;
  const custom = students.filter(s => s.notify?.mode === 'custom').length;
  const on = 'вкл', off = 'выкл';
  console.log(`  ${u.name} <${u.email}>`);
  console.log(`    педагогу: daily=${boolDef(st.notifyDaily, true) ? on + ' ' + (st.notifyDailyTime ?? '07:00') : off}, hourly=${boolDef(st.notifyHourly, true) ? on + ' за ' + hm(minutesDef(st.notifyHourlyMinutes)) : off}, weekly=${boolDef(st.notifyWeekly, true) ? on : off}`);
  console.log(`    ученику: ${boolDef(st.notifyStudentLesson, false) ? on + ' за ' + hm(minutesDef(st.notifyStudentLessonMinutes)) : off}, родителю: ${boolDef(st.notifyParentLesson, false) ? on + ' за ' + hm(minutesDef(st.notifyParentLessonMinutes)) : off}`);
  console.log(`    ученики: живых ${live}, с email ${withEmail}, с email родителя ${withParentEmail}, личных настроек (custom) ${custom}`);
}

await p.$disconnect();
