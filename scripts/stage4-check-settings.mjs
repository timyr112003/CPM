/**
 * Проверка этапа 4: новые настройки времени уведомлений в parseSnapshot
 * и окно отправки inSendWindow. ep-reminders.ts автономен — Node 24
 * исполняет TS напрямую.
 *
 * Запуск: node scripts/stage4-check-settings.mjs
 */
import { parseSnapshot, inSendWindow, defaultNotifySettings } from '../src/lib/ep-reminders.ts';

let failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) console.log(`  ok  ${name} = ${a}`);
  else { failed++; console.error(`FAIL  ${name}: ожидалось ${e}, получено ${a}`); }
}

console.log('1) Старый снапшот (без новых полей) → дефолты:');
const oldSnap = parseSnapshot(JSON.stringify({ students: [], schedule: [], settings: { notifyDaily: true } }));
eq('notifyDailyTime', oldSnap.settings.notifyDailyTime, '07:00');
eq('notifyHourlyMinutes', oldSnap.settings.notifyHourlyMinutes, 60);
eq('notifyWeeklyTime', oldSnap.settings.notifyWeeklyTime, '07:00');
eq('notifyWeeklyDays', oldSnap.settings.notifyWeeklyDays, [0]);

console.log('2) Валидные значения применяются и нормализуются:');
const snap2 = parseSnapshot(JSON.stringify({
  settings: { notifyDailyTime: '9:05', notifyHourlyMinutes: 90, notifyWeeklyTime: '18:30', notifyWeeklyDays: [6, 2] },
}));
eq('notifyDailyTime ("9:05"→"09:05")', snap2.settings.notifyDailyTime, '09:05');
eq('notifyHourlyMinutes', snap2.settings.notifyHourlyMinutes, 90);
eq('notifyWeeklyTime', snap2.settings.notifyWeeklyTime, '18:30');
eq('notifyWeeklyDays (сортировка)', snap2.settings.notifyWeeklyDays, [2, 6]);

console.log('3) Мусор отфильтровывается:');
const snap3 = parseSnapshot(JSON.stringify({
  settings: { notifyDailyTime: '25:99', notifyHourlyMinutes: 3, notifyWeeklyTime: 'abc', notifyWeeklyDays: [9, -1, 'x'] },
}));
eq('время невалидно → дефолт', snap3.settings.notifyDailyTime, '07:00');
eq('минуты < 5 → 60', snap3.settings.notifyHourlyMinutes, 60);
eq('время недели невалидно → дефолт', snap3.settings.notifyWeeklyTime, '07:00');
eq('дни вне 0–6 → пусто', snap3.settings.notifyWeeklyDays, []);

console.log('4) Граничные значения минут:');
eq('5000 → 1440 (максимум)', parseSnapshot(JSON.stringify({ settings: { notifyHourlyMinutes: 5000 } })).settings.notifyHourlyMinutes, 1440);
eq('45.6 → 46 (округление)', parseSnapshot(JSON.stringify({ settings: { notifyHourlyMinutes: 45.6 } })).settings.notifyHourlyMinutes, 46);
eq('строка "120" → 120', parseSnapshot(JSON.stringify({ settings: { notifyHourlyMinutes: '120' } })).settings.notifyHourlyMinutes, 120);

console.log('5) Дни: [] = выключено, undefined = понедельник:');
eq('[] → []', parseSnapshot(JSON.stringify({ settings: { notifyWeeklyDays: [] } })).settings.notifyWeeklyDays, []);
eq('undefined → [0]', parseSnapshot(JSON.stringify({ settings: { notifyHourlyMinutes: 60 } })).settings.notifyWeeklyDays, [0]);
eq('битый JSON → дефолты', parseSnapshot('{oops').settings, defaultNotifySettings());

console.log('6) inSendWindow (окно 180 мин):');
eq('ровно старт (420,420) → да', inSendWindow(420, 420), true);
eq('за минуту до (419,420) → нет', inSendWindow(419, 420), false);
eq('внутри (590,420) → да', inSendWindow(590, 420), true);
eq('конец окна исключён (600,420,180) → нет', inSendWindow(600, 420, 180), false);
eq('минута до конца (599,420,180) → да', inSendWindow(599, 420, 180), true);
console.log('   Переход через полночь: старт 23:30 (1410):');
eq('23:50 → да', inSendWindow(1430, 1410), true);
eq('01:40 (100) → да', inSendWindow(100, 1410), true);
eq('03:20 (200) → нет', inSendWindow(200, 1410), false);

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
process.exit(failed ? 1 : 0);
