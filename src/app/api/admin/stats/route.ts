import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getEffectiveUser, isAdminRoles, parseRoles, STATUS_ACTIVE } from '@/lib/ep-server-auth';
import { TRANSFER_FINANCE_CATEGORIES } from '@/lib/ep-types';

/**
 * Сводная статистика по учителям (только админы).
 * В разбивку по пользователям попадают только аккаунты с учительской ролью:
 * у главного администратора и администраторов без учительской роли своих
 * учеников/занятий нет, поэтому в окне статистики их не показываем.
 * Данные каждого учителя — JSON-снапшот: сервер разбирает его и считает агрегаты,
 * сырые персональные данные в браузер админа не отдаются.
 *
 * Параметры:
 *   ?period=month|quarter|year|all  — период агрегатов занятий/финансов (по умолчанию month)
 *
 * Внимание (attention): агрегаты «требует внимания» — истекающие абонементы
 * и ученики с долгом (отрицательный баланс), без персональных данных учеников.
 */

interface StatsUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
  studentsTotal: number;
  studentsActive: number;
  balanceTotal: number;
  subscriptionsActive: number;
  lessonsCompletedPeriod: number;
  lessonsPlannedPeriod: number;
  incomePeriod: number;
  expensePeriod: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export async function GET(req: Request) {
  const eff = await getEffectiveUser();
  if (!eff) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  if (!isAdminRoles(eff.actor.roles))
    return NextResponse.json({ error: 'Доступ только для администраторов' }, { status: 403 });

  const url = new URL(req.url);
  const period = ['month', 'quarter', 'year', 'all'].includes(url.searchParams.get('period') ?? '')
    ? (url.searchParams.get('period') as 'month' | 'quarter' | 'year' | 'all')
    : 'month';

  const now = new Date();
  const ym = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

  // Начало периода (включительно) для занятий и финансов
  let fromStr: string;
  if (period === 'all') {
    fromStr = '0000-01-01';
  } else {
    const monthsBack = period === 'quarter' ? 2 : period === 'year' ? 11 : 0;
    const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    fromStr = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
  }

  const allUsers = await db.user.findMany({
    where: { status: STATUS_ACTIVE },
    select: { id: true, name: true, email: true, roles: true, userData: { select: { data: true } } },
    orderBy: { createdAt: 'asc' },
  });

  // Только учителя (в т.ч. гибриды «админ+учитель»): главный админ и чистые
  // администраторы собственных данных не имеют и в статистике не нужны
  const users = allUsers.filter(u => parseRoles(u.roles).includes('TEACHER'));

  const result: StatsUser[] = [];
  const totals = {
    studentsTotal: 0,
    studentsActive: 0,
    balanceTotal: 0,
    subscriptionsActive: 0,
    lessonsCompletedPeriod: 0,
    incomePeriod: 0,
    expensePeriod: 0,
  };
  const attention = {
    expiringSubscriptions: 0, // активных абонементов истекает в течение 7 дней
    expiringTeachers: [] as string[],
    debtStudents: 0, // учеников с отрицательным балансом
    debtTotal: 0, // суммарный долг
    debtTeachers: [] as string[],
  };

  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in7DaysStr = `${in7Days.getFullYear()}-${pad2(in7Days.getMonth() + 1)}-${pad2(in7Days.getDate())}`;

  for (const u of users) {
    let parsed: Record<string, unknown> = {};
    if (u.userData?.data) {
      try {
        parsed = JSON.parse(u.userData.data) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
    }

    const students = Array.isArray(parsed.students) ? (parsed.students as Array<Record<string, unknown>>) : [];
    const subs = Array.isArray(parsed.subscriptions) ? (parsed.subscriptions as Array<Record<string, unknown>>) : [];
    const lessons = Array.isArray(parsed.schedule) ? (parsed.schedule as Array<Record<string, unknown>>) : [];
    const finance = Array.isArray(parsed.finance) ? (parsed.finance as Array<Record<string, unknown>>) : [];

    const activeStudents = students.filter(s => !s.archived);
    const studentsActive = activeStudents.length;
    const balanceTotal = activeStudents.reduce((sum, s) => sum + (Number(s.balance) || 0), 0);

    const subscriptionsActive = subs.filter(s => {
      if (s.archived || s.frozen) return false;
      const total = Number(s.totalLessons) || 0;
      const used = Number(s.usedLessons) || 0;
      if (used >= total) return false;
      const start = String(s.startDate ?? '');
      const end = String(s.endDate ?? '');
      return start <= today && end >= today;
    }).length;

    // Абонементы, истекающие в ближайшие 7 дней (активные, не замороженные)
    const expiring = subs.filter(s => {
      if (s.archived || s.frozen) return false;
      const end = String(s.endDate ?? '');
      return end >= today && end <= in7DaysStr;
    }).length;
    if (expiring > 0) {
      attention.expiringSubscriptions += expiring;
      attention.expiringTeachers.push(u.name);
    }

    // Долги учеников (отрицательный баланс) — только агрегаты, без имён учеников
    const debtCount = activeStudents.filter(s => (Number(s.balance) || 0) < 0).length;
    if (debtCount > 0) {
      attention.debtStudents += debtCount;
      attention.debtTotal += Math.abs(
        activeStudents.filter(s => (Number(s.balance) || 0) < 0).reduce((sum, s) => sum + (Number(s.balance) || 0), 0)
      );
      attention.debtTeachers.push(u.name);
    }

    let lessonsCompletedPeriod = 0;
    let lessonsPlannedPeriod = 0;
    for (const l of lessons) {
      const date = String(l.date ?? '');
      if (date < fromStr || date > today) continue;
      if (l.status === 'completed') lessonsCompletedPeriod++;
      else if (l.status === 'planned') lessonsPlannedPeriod++;
    }

    let incomePeriod = 0;
    let expensePeriod = 0;
    for (const f of finance) {
      const date = String(f.date ?? '');
      if (date < fromStr || date > today) continue;
      if (TRANSFER_FINANCE_CATEGORIES.includes(String(f.category ?? ''))) continue; // внутренние переводы
      const amount = Number(f.amount) || 0;
      if (f.type === 'income') incomePeriod += amount;
      else if (f.type === 'expense') expensePeriod += amount;
    }

    result.push({
      id: u.id,
      name: u.name,
      email: u.email,
      roles: parseRoles(u.roles),
      studentsTotal: students.length,
      studentsActive,
      balanceTotal,
      subscriptionsActive,
      lessonsCompletedPeriod,
      lessonsPlannedPeriod,
      incomePeriod,
      expensePeriod,
    });

    totals.studentsTotal += students.length;
    totals.studentsActive += studentsActive;
    totals.balanceTotal += balanceTotal;
    totals.subscriptionsActive += subscriptionsActive;
    totals.lessonsCompletedPeriod += lessonsCompletedPeriod;
    totals.incomePeriod += incomePeriod;
    totals.expensePeriod += expensePeriod;
  }

  return NextResponse.json({ period, from: fromStr, today, users: result, totals, attention });
}
