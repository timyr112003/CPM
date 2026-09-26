import { db } from '@/lib/db';
import { audit, parseRoles, STATUS_ACTIVE } from '@/lib/ep-server-auth';
import { isMailConfigured, framedMailHtml, sendMail } from '@/lib/mailer';
import {
  reminderZone,
  zoneNow,
  addDays,
  parseSnapshot,
  lessonsOnDay,
  lessonStartMinutes,
  inSendWindow,
  buildDailyMail,
  buildHourlyMail,
  buildWeeklyMail,
  buildStudentReminderMail,
  buildParentReminderMail,
  plural,
  type ReminderMail,
  type DayLesson,
  type SnapshotLesson,
} from '@/lib/ep-reminders';

/**
 * Движок напоминаний (этап 3): общая логика обхода учителей и отправки писем.
 * Используется двумя способами:
 *  - HTTP-роут /api/cron/reminders (внешний крон / ручной вызов с секретом);
 *  - встроенный планировщик src/lib/ep-scheduler.ts (тик каждые 10 минут).
 *
 * Дедупликация — маркеры в AuditLog (REMINDER_SENT): письмо не уйдёт дважды,
 * сколько бы раз ни запускался обход. Сбой письма не ломает обход: пишем
 * REMINDER_ERROR, маркер не ставим — следующий запуск повторит попытку.
 *
 * У каждого педагога свои настройки (снапшот аккаунта, редактируются по
 * шестерёнке в карточке «Уведомления»):
 *  - включённость каждого типа (notifyDaily / notifyHourly / notifyWeekly);
 *  - за сколько минут до занятия напоминать (notifyHourlyMinutes, 5–1440);
 *  - во сколько присылать сводку на день (notifyDailyTime, 'HH:MM');
 *  - время и дни недельного плана (notifyWeeklyTime, notifyWeeklyDays);
 *  - напоминания ученику и родителю (notifyStudentLesson / notifyParentLesson,
 *    по умолчанию выключены) — с личным перекрытием на карточке ученика
 *    (student.notify: mode custom → свои тумблеры и тайминг).
 *
 * Движок сам решает, «пора ли»: сводка уходит в окне 3 часа после назначенного
 * времени (первый же тик планировщика внутри окна), повторные тики внутри
 * окна гасятся дедупликацией — поэтому окно и тик не зависят друг от друга.
 */

export type ReminderType = 'daily' | 'hourly' | 'weekly';

export interface ReminderRunResult {
  type: ReminderType;
  date: string;
  timezone: string;
  /** Сколько учителей с данными найдено */
  teachers: number;
  sent: number;
  skipped: number;
  errors: number;
  details: string[];
}

export async function runReminders(
  type: ReminderType,
  opts?: { dryRun?: boolean },
): Promise<ReminderRunResult> {
  const dryRun = Boolean(opts?.dryRun);
  const tz = reminderZone();
  const now = zoneNow(tz);

  // Все активные учителя с данными (у чистых админов своих занятий нет)
  const users = await db.user.findMany({
    where: { status: STATUS_ACTIVE },
    select: {
      id: true, name: true, email: true, roles: true,
      userData: { select: { data: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const teachers = users.filter(u => parseRoles(u.roles).includes('TEACHER') && u.userData?.data);

  // Дедупликация: маркеры «уже отправлено» за последние 8 дней
  const since = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  const prev = await db.auditLog.findMany({
    where: { action: 'REMINDER_SENT', createdAt: { gte: since } },
    select: { targetId: true, meta: true },
  });
  const done = new Set<string>();
  for (const p of prev) {
    let meta: Record<string, unknown> = {};
    try { meta = p.meta ? JSON.parse(p.meta) : {}; } catch { continue; }
    const t = String(meta.type ?? '');
    const d = String(meta.date ?? '');
    // Типы с привязкой к занятию: hourly (педагогу), student-hourly (ученику),
    // parent-hourly (родителю) — ключ включает id урока
    if (p.targetId && meta.lessonId && ['hourly', 'student-hourly', 'parent-hourly'].includes(t)) {
      done.add(`${p.targetId}|${t}|${String(meta.lessonId)}`);
    } else if (t && d && p.targetId) {
      done.add(`${p.targetId}|${t}|${d}`);
    }
  }

  const out: ReminderRunResult = {
    type,
    date: now.date,
    timezone: tz,
    teachers: teachers.length,
    sent: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  const deliver = async (
    u: { id: string; email: string },
    mail: ReminderMail,
    dedupKey: string,
    metaForAudit: Record<string, unknown>,
    label: string,
  ) => {
    if (done.has(dedupKey)) {
      out.skipped++;
      out.details.push(`${u.email}: уже отправлено (${label})`);
      return;
    }
    if (dryRun) {
      out.details.push(`${u.email}: dry-run, ушло бы письмо «${mail.subject}»`);
      return;
    }
    const res = await sendMail({
      to: u.email,
      subject: mail.subject,
      text: mail.text,
      html: framedMailHtml(mail.heading, mail.blocks),
    });
    if (res.ok) {
      out.sent++;
      done.add(dedupKey); // защита от дубля внутри одного запуска
      await audit(null, 'REMINDER_SENT', { id: u.id, email: u.email }, { ...metaForAudit, messageId: res.messageId });
      out.details.push(`${u.email}: отправлено (${label})`);
    } else {
      out.errors++;
      await audit(null, 'REMINDER_ERROR', { id: u.id, email: u.email }, { ...metaForAudit, error: res.error });
      out.details.push(`${u.email}: ошибка — ${res.error}`);
    }
  };

  for (const u of teachers) {
    const { students, lessons, settings } = parseSnapshot(u.userData?.data ?? '');

    if (type === 'daily') {
      if (!settings.notifyDaily) {
        out.skipped++;
        out.details.push(`${u.email}: отключено в настройках аккаунта`);
        continue;
      }
      if (!inSendWindow(now.minutes, lessonStartMinutes(settings.notifyDailyTime))) {
        out.skipped++;
        out.details.push(`${u.email}: сводка на день приходит в ${settings.notifyDailyTime} — сейчас не время`);
        continue;
      }
      const day = lessonsOnDay(lessons, students, now.date);
      if (!day.length) {
        out.skipped++;
        out.details.push(`${u.email}: на сегодня занятий нет — письмо не отправляем`);
        continue;
      }
      const mail = buildDailyMail({ teacherName: u.name, date: now.date, lessons: day });
      await deliver(u, mail, `${u.id}|daily|${now.date}`, { type: 'daily', date: now.date, count: day.length }, `${day.length} ${plural(day.length, 'занятие', 'занятия', 'занятий')}`);
      continue;
    }

    if (type === 'hourly') {
      const byId = new Map(students.map(s => [s.id, s]));
      const day = lessonsOnDay(lessons, students, now.date);

      // ── 1. Письмо педагогу — по его собственным настройкам ──
      if (!settings.notifyHourly) {
        out.skipped++;
        out.details.push(`${u.email}: напоминание педагогу отключено в настройках аккаунта`);
      } else {
        const ahead = settings.notifyHourlyMinutes;
        const upcoming = day
          .map(l => ({ lesson: l, inMinutes: lessonStartMinutes(l.time) - now.minutes }))
          .filter(x => x.inMinutes > 0 && x.inMinutes <= ahead);
        if (!upcoming.length) {
          out.skipped++;
          out.details.push(`${u.email}: в ближайшие ${ahead} ${plural(ahead, 'минуту', 'минуты', 'минут')} занятий нет`);
        }
        for (const { lesson } of upcoming) {
          const mail = buildHourlyMail({ teacherName: u.name, date: now.date, lesson });
          await deliver(
            u, mail,
            `${u.id}|hourly|${lesson.id}`,
            { type: 'hourly', date: now.date, lessonId: lesson.id, time: lesson.time },
            `занятие в ${lesson.time}`,
          );
        }
      }

      // ── 2. Письма ученикам и родителям — независимо от письма педагогу.
      // ГЛАВНЫЙ ВЫКЛЮЧАТЕЛЬ: если общее уведомление выключено — письма этого
      // типа не уходят никому, даже ученикам со «Своими настройками»;
      // личные настройки работают только при включённом общем ползунке.
      if (!settings.notifyStudentLesson && !settings.notifyParentLesson) {
        out.details.push(`${u.email}: напоминания ученикам и родителям отключены в общих настройках`);
      }
      const todayRaw = lessons.filter(l => l.date === now.date && l.status === 'planned');
      for (const l of todayRaw) {
        const inMinutes = lessonStartMinutes(l.time) - now.minutes;
        if (inMinutes <= 0) continue; // занятие уже началось/прошло
        for (const pid of lessonParticipantIds(l)) {
          const st = byId.get(pid);
          if (!st || st.archived) continue;
          const ntf = st.notify?.mode === 'custom' ? st.notify : null;

          // Письмо ученику
          const wantStudent = settings.notifyStudentLesson && (ntf ? ntf.toStudent === true : true);
          if (wantStudent) {
            const min = ntf ? (ntf.minutes ?? settings.notifyStudentLessonMinutes) : settings.notifyStudentLessonMinutes;
            if (inMinutes <= min) {
              if (st.email) {
                const mail = buildStudentReminderMail({ studentName: st.name, date: now.date, lesson: toDayLesson(l) });
                await deliver(
                  { id: st.id, email: st.email }, mail,
                  `${st.id}|student-hourly|${l.id}`,
                  { type: 'student-hourly', date: now.date, studentId: st.id, lessonId: l.id, time: l.time },
                  `ученику ${st.name} — занятие в ${l.time}`,
                );
              } else {
                out.skipped++;
                out.details.push(`ученик ${st.name}: нет email в карточке — напоминание не отправлено`);
              }
            }
          }

          // Письмо родителю
          const wantParent = settings.notifyParentLesson && (ntf ? ntf.toParent === true : true);
          if (wantParent) {
            const min = ntf ? (ntf.minutes ?? settings.notifyParentLessonMinutes) : settings.notifyParentLessonMinutes;
            if (inMinutes <= min) {
              if (st.parentEmail) {
                const mail = buildParentReminderMail({ parentName: st.parentName, studentName: st.name, date: now.date, lesson: toDayLesson(l) });
                await deliver(
                  { id: st.id, email: st.parentEmail }, mail,
                  `${st.id}|parent-hourly|${l.id}`,
                  { type: 'parent-hourly', date: now.date, studentId: st.id, lessonId: l.id, time: l.time },
                  `родителю (${st.name}) — занятие в ${l.time}`,
                );
              } else {
                out.skipped++;
                out.details.push(`родитель ученика ${st.name}: email не указан — напоминание не отправлено`);
              }
            }
          }
        }
      }
      continue;
    }

    // weekly
    if (!settings.notifyWeekly) {
      out.skipped++;
      out.details.push(`${u.email}: отключено в настройках аккаунта`);
      continue;
    }
    if (!settings.notifyWeeklyDays.includes(now.weekday)) {
      out.skipped++;
      out.details.push(`${u.email}: сегодня (${now.weekday + 1}-й день недели) не входит в дни недельного плана`);
      continue;
    }
    if (!inSendWindow(now.minutes, lessonStartMinutes(settings.notifyWeeklyTime))) {
      out.skipped++;
      out.details.push(`${u.email}: недельный план приходит в ${settings.notifyWeeklyTime} — сейчас не время`);
      continue;
    }
    const days: Array<{ date: string; lessons: DayLesson[] }> = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(now.date, i);
      const day = lessonsOnDay(lessons, students, d);
      if (day.length) days.push({ date: d, lessons: day });
    }
    if (!days.length) {
      out.skipped++;
      out.details.push(`${u.email}: на ближайшую неделю занятий нет`);
      continue;
    }
    const mail = buildWeeklyMail({
      teacherName: u.name,
      startDate: now.date,
      endDate: addDays(now.date, 6),
      days,
    });
    await deliver(u, mail, `${u.id}|weekly|${now.date}`, { type: 'weekly', date: now.date, days: days.length }, `${days.length} дн. с занятиями`);
  }

  if (!teachers.length) out.details.push('Активные учителя с данными не найдены — отправлять некому');
  return out;
}

/** Короткая строка для логов: daily: sent=1 skipped=2 errors=0 */
export function runSummary(r: ReminderRunResult): string {
  return `${r.type}: sent=${r.sent} skipped=${r.skipped} errors=${r.errors}`;
}

/** Участники занятия по снапшоту: группа — все studentIds; личное — studentIds или studentId */
function lessonParticipantIds(l: SnapshotLesson): string[] {
  if (l.isGroup) return l.studentIds;
  if (l.studentIds.length) return l.studentIds;
  return l.studentId ? [l.studentId] : [];
}

/** Снапшот-урок → DayLesson для сборщиков писем (без заметок педагога) */
function toDayLesson(l: SnapshotLesson): DayLesson {
  return {
    id: l.id,
    time: l.time,
    studentNames: [], // в письмах ученику/родителю имена не нужны — там обращение персональное
    isGroup: l.isGroup,
    topic: l.topic,
    duration: l.duration,
  };
}
