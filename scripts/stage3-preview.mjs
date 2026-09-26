// Превью писем этапа 3: собирает дневную сводку и напоминание «за час»
// на примере занятий и отправляет их владельцу на реальный ящик, чтобы он
// увидел оформление. Также сохраняет scripts/stage3-preview.html.
// Запуск: node --env-file=.env scripts/stage3-preview.mjs
import { writeFileSync } from 'node:fs';
import { buildDailyMail, buildHourlyMail } from '../src/lib/ep-reminders.ts';
import { framedMailHtml, sendMail } from '../src/lib/mailer.ts';

const TO = 'thomasage@yandex.ru';
const date = '2026-09-26';

const dayLessons = [
  { id: 'd1', time: '10:00', studentNames: ['Анна Смирнова'], isGroup: false, topic: 'Грамматика: Present Perfect', duration: 60, notes: 'Проверить домашнее задание' },
  { id: 'd2', time: '15:00', studentNames: ['Борис Круглов'], isGroup: false, topic: 'Разговорная практика', duration: 45 },
  { id: 'd3', time: '18:30', studentNames: ['Вера Ли', 'Марат Гусев'], isGroup: true, topic: 'Подготовка к экзамену', duration: 90 },
];

const daily = buildDailyMail({ teacherName: 'Александр', date, lessons: dayLessons });
const hourly = buildHourlyMail({
  teacherName: 'Александр', date,
  lesson: { id: 'h1', time: '15:00', studentNames: ['Борис Круглов'], isGroup: false, topic: 'Разговорная практика', duration: 45 },
});

const dailyHtml = framedMailHtml(daily.heading, daily.blocks);
const hourlyHtml = framedMailHtml(hourly.heading, hourly.blocks);
writeFileSync('/home/z/my-project/scripts/stage3-preview.html',
  `<!doctype html><meta charset="utf-8"><body style="background:#f3f4f6;padding:16px">\n` +
  `<div style="max-width:520px;margin:0 auto 24px"><h3 style="font-family:Arial">Дневная сводка</h3>${dailyHtml}</div>\n` +
  `<div style="max-width:520px;margin:0 auto"><h3 style="font-family:Arial">Напоминание «за час»</h3>${hourlyHtml}</div>\n</body>`);

const r1 = await sendMail({ to: TO, subject: daily.subject, text: daily.text, html: dailyHtml });
const r2 = await sendMail({ to: TO, subject: hourly.subject, text: hourly.text, html: hourlyHtml });
console.log('daily:', r1.ok ? `ok ${r1.messageId}` : `ошибка: ${r1.error}`);
console.log('hourly:', r2.ok ? `ok ${r2.messageId}` : `ошибка: ${r2.error}`);
