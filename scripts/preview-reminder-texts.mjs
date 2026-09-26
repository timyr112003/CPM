/**
 * Превью утверждённых писем-напоминаний (ученику и родителю):
 * печатаются тема, текстовая версия и HTML-блоки. Реальные письма не шлются.
 */
import { buildStudentReminderMail, buildParentReminderMail } from '../src/lib/ep-reminders.ts';

const lesson = { id: 'preview', time: '21:40', studentNames: [], isGroup: false, topic: 'Present Perfect', duration: 60 };
const lesson2 = { id: 'preview2', time: '21:40', studentNames: [], isGroup: false, topic: 'Conditionals', duration: 45 };

const st = buildStudentReminderMail({ studentName: 'Анна Тестовая', date: '2026-09-26', lesson });
const par = buildParentReminderMail({ parentName: 'Ольга Сергеевна', studentName: 'Анна Тестовая', date: '2026-09-26', lesson: lesson2 });

console.log('════ УЧЕНИКУ ════');
console.log('Тема:', st.subject);
console.log(st.text);
console.log('\n════ РОДИТЕЛЮ ════');
console.log('Тема:', par.subject);
console.log(par.text);

// Краевые случаи: без темы, без имени родителя, групповое
const st3 = buildStudentReminderMail({ studentName: 'Иван', date: '2026-09-26', lesson: { ...lesson, topic: '', isGroup: true } });
const par3 = buildParentReminderMail({ studentName: 'Иван', date: '2026-09-26', lesson: { ...lesson2, topic: '', isGroup: true } });
console.log('\n════ КРАЕВЫЕ: ученик без темы + группа ════');
console.log(st3.text);
console.log('\n════ КРАЕВЫЕ: родитель без имени, без темы, группа ════');
console.log(par3.text);
