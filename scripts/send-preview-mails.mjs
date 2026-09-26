/**
 * Превью-отправка трёх новых писем-напоминаний (ученику, родителю, педагогу)
 * на собственный адрес SMTP-аккаунта, чтобы владелец увидел тексты в ящике.
 * Тело письма — точь-в-точь производственное; в тему добавлен маркер [Проверка].
 */
import { buildStudentReminderMail, buildParentReminderMail, buildHourlyMail } from '../src/lib/ep-reminders.ts';
import { framedMailHtml, sendMail, isMailConfigured } from '../src/lib/mailer.ts';

if (!isMailConfigured()) {
  console.error('Почта не настроена (SMTP_USER/SMTP_PASS)');
  process.exit(1);
}
const TO = process.env.SMTP_USER;

const lessonStu = { id: 'preview', time: '21:40', studentNames: [], isGroup: false, topic: 'Present Perfect', duration: 60 };
const lessonPar = { id: 'preview', time: '21:40', studentNames: [], isGroup: false, topic: 'Conditionals', duration: 45 };
const lessonTea = { id: 'preview', time: '21:40', studentNames: ['Анна Тестовая'], isGroup: false, topic: 'Present Perfect', duration: 60, notes: 'Повторить неправильные глаголы' };

const mails = [
  ['ученику', buildStudentReminderMail({ studentName: 'Анна Тестовая', date: '2026-09-26', lesson: lessonStu })],
  ['родителю', buildParentReminderMail({ parentName: 'Ольга Сергеевна', studentName: 'Анна Тестовая', date: '2026-09-26', lesson: lessonPar })],
  ['педагогу', buildHourlyMail({ teacherName: 'Тимур', date: '2026-09-26', lesson: lessonTea })],
];

for (const [who, mail] of mails) {
  const res = await sendMail({
    to: TO,
    subject: `[Проверка] ${mail.subject}`,
    text: mail.text,
    html: framedMailHtml(mail.heading, mail.blocks),
  });
  console.log(`${who}: ${res.ok ? 'отправлено' : `ОШИБКА — ${res.error}`}  («${mail.subject}»)`);
}
