'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { fmtMoney, fmtDateRu, fmtDate, parseDate, isToday, getDaysUntilBirthday, isTransferFinance } from '@/lib/ep-utils';

export function EpDashboard() {
  const schedule = useAppStore(s => s.schedule);
  const finance = useAppStore(s => s.finance);
  const students = useAppStore(s => s.students);
  const currentUser = useAppStore(s => s.currentUser);
  const navigate = useAppStore(s => s.navigate);
  const openModal = useAppStore(s => s.openModal);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = fmtDate(now);
    const todayLessons = schedule.filter(l => l.date === todayStr && l.status !== 'cancelled');
    const todayIncome = todayLessons.filter(l => l.status === 'completed').reduce((s, l) => s + l.price, 0);
    const mp = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const mf = finance.filter(f => f.date.startsWith(mp));
    // Покупка/возврат абонемента — внутренний перевод, в доходы/расходы не входит
    const mInc = mf.filter(f => f.type === 'income' && !isTransferFinance(f)).reduce((s, f) => s + f.amount, 0);
    const mExp = mf.filter(f => f.type === 'expense' && !isTransferFinance(f)).reduce((s, f) => s + f.amount, 0);
    const activeStudents = students.filter(s => !s.archived);
    const debtStudents = activeStudents.filter(s => s.balance < 0);
    const totalDebt = debtStudents.reduce((s, st) => s + Math.abs(st.balance), 0);
    return { todayLessons: todayLessons.length, todayCompleted: todayLessons.filter(l => l.status === 'completed').length, todayIncome, mInc, mExp, activeStudents: activeStudents.length, debtStudents, totalDebt };
  }, [schedule, finance, students]);
  type DashEvent = {
    id: string;
    date: string;
    kind: 'lesson' | 'birthday';
    // lesson fields
    time?: string;
    duration?: number;
    student?: string;
    topic?: string;
    isGroup?: boolean;
    // birthday fields
    studentId?: string;
    days?: number;
  };

  const events = useMemo<DashEvent[]>(() => {
    const todayStr = fmtDate(new Date());

    // Upcoming lessons (next 5)
    const lessons: DashEvent[] = schedule
      .filter(l => l.status === 'planned' && l.date >= todayStr)
      .sort((a, b) => a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date))
      .slice(0, 5)
      .map(l => ({
        id: l.id,
        date: l.date,
        kind: 'lesson' as const,
        time: l.time,
        duration: l.duration,
        student: l.student,
        topic: l.topic,
        isGroup: l.isGroup,
      }));

    // Birthday reminders (today, +1 day, +3 days) for non-archived students
    const birthdays: DashEvent[] = students
      .filter(s => !s.archived && s.birthDate)
      .map(s => {
        const days = getDaysUntilBirthday(s.birthDate);
        // Compute the actual calendar date for the upcoming birthday
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [_, bm, bd] = (s.birthDate as string).split('-').map(Number);
        let bday = new Date(today.getFullYear(), bm - 1, bd);
        if (bday < today) bday = new Date(today.getFullYear() + 1, bm - 1, bd);
        return { student: s, days, date: fmtDate(bday) };
      })
      .filter(x => x.days !== null && x.days! <= 3)
      .map(x => ({
        id: 'bday-' + x.student.id,
        date: x.date,
        kind: 'birthday' as const,
        student: x.student.name,
        studentId: x.student.id,
        days: x.days!,
      }));

    // Merge and sort by date, then by kind (lessons first when same date)
    return [...lessons, ...birthdays]
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        // Same date: birthday today gets priority, otherwise lessons first
        if (a.kind === 'birthday' && a.days === 0) return -1;
        if (b.kind === 'birthday' && b.days === 0) return 1;
        return a.kind === 'lesson' ? -1 : 1;
      })
      .slice(0, 8);
  }, [schedule, students]);

  const bal = stats.mInc - stats.mExp;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="ep-fade-in">
        <h3 className="text-2xl font-bold mb-1">Добрый день, {currentUser?.name}!</h3>
        <p className="ep-muted">Вот сводка по вашим занятиям и финансам</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="УРОКИ СЕГОДНЯ" value={String(stats.todayLessons)} sub={`Проведено: ${stats.todayCompleted}`} icon="fa-book-open" iconBg="rgba(96,165,250,0.12)" iconColor="#60a5fa" delay={0.05} />
        <StatCard label="ДОХОД ЗА МЕСЯЦ" value={fmtMoney(stats.mInc)} sub={`Сегодня: ${fmtMoney(stats.todayIncome)}`} icon="fa-arrow-trend-up" iconBg="rgba(0,229,160,0.12)" iconColor="var(--ep-accent)" delay={0.1} valueColor="var(--ep-accent)" />
        <StatCard label="РАСХОДЫ / БАЛАНС" value={fmtMoney(stats.mExp)} sub={`Баланс: ${fmtMoney(bal)}`} icon="fa-arrow-trend-down" iconBg="rgba(255,92,92,0.12)" iconColor="var(--ep-danger)" delay={0.2} valueColor="var(--ep-danger)" subColor={bal >= 0 ? 'var(--ep-accent)' : 'var(--ep-danger)'} />
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming events (lessons + birthday reminders) */}
        <div className="ep-card-static p-5 ep-fade-in" style={{ animationDelay: '0.25s' }}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-sm">Ближайшие события</h4>
            <button onClick={() => navigate('calendar')} className="text-xs font-semibold ep-accent-color">
              Календарь <i className="fa-solid fa-arrow-right ml-1" />
            </button>
          </div>
          <div className="space-y-3">
            {events.length === 0 ? (
              <p className="text-sm ep-muted">Нет ближайших событий</p>
            ) : events.map(ev => ev.kind === 'lesson' ? (
              <div key={ev.id} className="flex items-center gap-3 p-3 rounded-lg ep-bg-base">
                <div className="text-center min-w-[44px]">
                  <div className="text-xs font-bold ep-accent-color">{ev.time}</div>
                  <div className="text-xs ep-muted">{ev.duration} мин</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {ev.isGroup && <i className="fa-solid fa-users text-xs mr-1" style={{ color: '#a78bfa' }} />}
                    {ev.student}
                  </div>
                  <div className="text-xs truncate ep-muted">{ev.topic}</div>
                </div>
                <div className="text-xs font-semibold ep-muted">
                  {isToday(parseDate(ev.date)) ? 'Сегодня' : fmtDateRu(parseDate(ev.date))}
                </div>
              </div>
            ) : (
              <div
                key={ev.id}
                className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all"
                style={{
                  background: ev.days === 0 ? 'rgba(255,170,200,0.10)' : 'rgba(255,200,80,0.08)',
                  border: `1px solid ${ev.days === 0 ? 'rgba(255,120,180,0.25)' : 'rgba(255,200,80,0.18)'}`,
                }}
                onClick={() => openModal('student', ev.studentId)}
                title="Открыть карточку ученика"
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: 'rgba(255,170,200,0.18)' }}>
                  <i className="fa-solid fa-cake-candles" style={{ color: '#ff6fae' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{ev.student}</div>
                  <div className="text-xs truncate" style={{ color: ev.days === 0 ? '#ff6fae' : 'var(--ep-text-muted)' }}>
                    {ev.days === 0 ? 'День рождения сегодня!' : ev.days === 1 ? 'День рождения завтра' : `День рождения через ${ev.days} дн.`}
                  </div>
                </div>
                <div className="text-xs font-semibold whitespace-nowrap" style={{ color: ev.days === 0 ? '#ff6fae' : '#e9a83a' }}>
                  {ev.days === 0 ? 'Сегодня' : fmtDateRu(parseDate(ev.date))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Debt alerts */}
        {stats.debtStudents.length > 0 && (
            <div className="ep-card-static p-5 ep-fade-in" style={{ animationDelay: '0.35s' }}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-sm" style={{ color: 'var(--ep-danger)' }}>
                  <i className="fa-solid fa-triangle-exclamation mr-1" />Задолженности ({stats.debtStudents.length})
                </h4>
                <button onClick={() => navigate('students')} className="text-xs font-semibold" style={{ color: 'var(--ep-danger)' }}>
                  Все ученики <i className="fa-solid fa-arrow-right ml-1" />
                </button>
              </div>
              <div className="text-xs font-semibold mb-3" style={{ color: 'var(--ep-danger)' }}>
                Общая сумма долга: {fmtMoney(stats.totalDebt)}
              </div>
              <div className="space-y-2">
                {stats.debtStudents.slice(0, 5).map(s => {
                  const initials = s.name.split(' ').map(n => n[0] || '').join('').slice(0, 2);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all"
                      style={{ background: 'rgba(255,92,92,0.06)', border: '1px solid rgba(255,92,92,0.12)' }}
                      onClick={() => openModal('balance', s.id)}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(255,92,92,0.12)', color: 'var(--ep-danger)' }}>
                          {initials}
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{s.name}</div>
                          <div className="text-xs ep-muted">{s.phone || ''}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: 'var(--ep-danger)' }}>
                          {fmtMoney(s.balance)}
                        </span>
                        <i className="fa-solid fa-wallet text-xs" style={{ color: 'var(--ep-muted)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon, iconBg, iconColor, delay, valueColor, subColor }: {
  label: string; value: string; sub: string; icon: string; iconBg: string; iconColor: string;
  delay: number; valueColor?: string; subColor?: string;
}) {
  return (
    <div className="stat-card ep-fade-in" style={{ animationDelay: delay + 's' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold ep-muted">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: iconBg }}>
          <i className={`fa-solid ${icon} text-xs`} style={{ color: iconColor }} />
        </div>
      </div>
      <div className="text-2xl font-bold" style={valueColor ? { color: valueColor } : {}}>{value}</div>
      <div className="text-xs mt-1" style={subColor ? { color: subColor } : {}} >{sub}</div>
    </div>
  );
}
