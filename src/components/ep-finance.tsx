'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/ep-store';
import { fmtMoney, fmtDateRu, fmtDate, parseDate, getMonday, sortFinanceNewestFirst, isTransferFinance } from '@/lib/ep-utils';
import { MONTHS_RU, MONTHS_GEN_RU, DAYS_SHORT_RU, FinanceEntry } from '@/lib/ep-types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

const PIE_COLORS = ['#ff5c5c', '#ffb347', '#60a5fa', '#a78bfa', '#f472b6', '#34d399', '#fbbf24'];

type FinView = 'week' | 'month' | 'year';

export function EpFinance() {
  const finance = useAppStore(s => s.finance);
  const finMonth = useAppStore(s => s.finMonth);
  const finYear = useAppStore(s => s.finYear);
  const setFinMonth = useAppStore(s => s.setFinMonth);
  const setFinYear = useAppStore(s => s.setFinYear);
  const weekOffset = useAppStore(s => s.weekOffset);
  const setWeekOffset = useAppStore(s => s.setWeekOffset);
  const deleteFinance = useAppStore(s => s.deleteFinance);
  const addToast = useAppStore(s => s.addToast);
  const openConfirm = useAppStore(s => s.openConfirm);
  const openModal = useAppStore(s => s.openModal);
  const theme = useAppStore(s => s.theme);

  const [view, setView] = useState<FinView>('month');
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Navigation helpers ───
  const prevMonth = () => {
    if (finMonth === 0) { setFinMonth(11); setFinYear(finYear - 1); }
    else setFinMonth(finMonth - 1);
  };
  const nextMonth = () => {
    if (finMonth === 11) { setFinMonth(0); setFinYear(finYear + 1); }
    else setFinMonth(finMonth + 1);
  };
  const goCurrentMonth = () => { setFinMonth(new Date().getMonth()); setFinYear(new Date().getFullYear()); };
  const prevWeek = () => setWeekOffset(weekOffset - 1);
  const nextWeek = () => setWeekOffset(weekOffset + 1);
  const goCurrentWeek = () => setWeekOffset(0);
  const prevYear = () => setFinYear(finYear - 1);
  const nextYear = () => setFinYear(finYear + 1);
  const goCurrentYear = () => setFinYear(new Date().getFullYear());

  // ─── Week dates ───
  const weekDates = useMemo(() => {
    const mon = getMonday(new Date());
    mon.setDate(mon.getDate() + weekOffset * 7);
    const arr: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(d.getDate() + i);
      arr.push(fmtDate(d));
    }
    return arr;
  }, [weekOffset]);

  // ─── Filtered finance data ───
  const filteredFinance = useMemo(() => {
    if (view === 'week') return finance.filter(f => weekDates.includes(f.date));
    if (view === 'year') return finance.filter(f => f.date.startsWith(String(finYear)));
    const mp = finYear + '-' + String(finMonth + 1).padStart(2, '0');
    return finance.filter(f => f.date.startsWith(mp));
  }, [finance, view, finMonth, finYear, weekDates]);

  // Покупка/возврат абонемента — внутренний перевод, в доходы/расходы не входит
  const realIncome = (f: FinanceEntry) => f.type === 'income' && !isTransferFinance(f);
  const realExpense = (f: FinanceEntry) => f.type === 'expense' && !isTransferFinance(f);

  const tInc = filteredFinance.filter(realIncome).reduce((s, f) => s + f.amount, 0);
  const tExp = filteredFinance.filter(realExpense).reduce((s, f) => s + f.amount, 0);
  const bal = tInc - tExp;

  // ─── Chart data ───
  const chartData = useMemo(() => {
    if (view === 'week') {
      return weekDates.map((ds, i) => {
        const dayFin = filteredFinance.filter(f => f.date === ds);
        const di = dayFin.filter(realIncome).reduce((s, f) => s + f.amount, 0);
        const de = dayFin.filter(realExpense).reduce((s, f) => s + f.amount, 0);
        return { label: DAYS_SHORT_RU[i], income: di, expense: de };
      });
    }
    if (view === 'year') {
      const data: { label: string; income: number; expense: number }[] = [];
      for (let m = 0; m < 12; m++) {
        const mp = finYear + '-' + String(m + 1).padStart(2, '0');
        const mFin = filteredFinance.filter(f => f.date.startsWith(mp));
        const di = mFin.filter(realIncome).reduce((s, f) => s + f.amount, 0);
        const de = mFin.filter(realExpense).reduce((s, f) => s + f.amount, 0);
        data.push({ label: MONTHS_RU[m].substring(0, 3), income: di, expense: de });
      }
      return data;
    }
    // month view
    const mp = finYear + '-' + String(finMonth + 1).padStart(2, '0');
    const dim = new Date(finYear, finMonth + 1, 0).getDate();
    const data: { label: string; income: number; expense: number }[] = [];
    for (let d = 1; d <= dim; d++) {
      const ds = mp + '-' + String(d).padStart(2, '0');
      const dayFin = filteredFinance.filter(f => f.date === ds);
      const di = dayFin.filter(realIncome).reduce((s, f) => s + f.amount, 0);
      const de = dayFin.filter(realExpense).reduce((s, f) => s + f.amount, 0);
      data.push({ label: String(d), income: di, expense: de });
    }
    return data;
  }, [view, filteredFinance, finYear, finMonth, weekDates]);

  const chartTitle = view === 'week'
    ? `По дням недели`
    : view === 'year'
      ? `По месяцам — ${finYear}`
      : `По дням — ${MONTHS_RU[finMonth]} ${finYear}`;

  const pieData = useMemo(() => {
    const cats: Record<string, number> = {};
    filteredFinance.filter(realExpense).forEach(f => { cats[f.category] = (cats[f.category] || 0) + f.amount; });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [filteredFinance]);

  const q = searchQuery.trim().toLowerCase();
  const allFiltered = sortFinanceNewestFirst(filteredFinance);
  const transactions = (q
    ? allFiltered.filter(f =>
        f.category.toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q) ||
        f.date.includes(q) ||
        String(f.amount).includes(q)
      )
    : allFiltered
  ).slice(0, q ? undefined : 30);

  const gridColor = theme === 'dark' ? 'rgba(30,34,51,0.5)' : 'rgba(0,0,0,0.06)';
  const tickColor = theme === 'dark' ? '#5e6b82' : '#6b7589';
  const tooltipStyle = { background: theme === 'dark' ? '#1c2233' : '#fff', border: `1px solid ${theme === 'dark' ? '#2a3040' : '#dde0e6'}`, borderRadius: 8, fontSize: 12 };

  // ─── Navigation header ───
  const navHeader = () => {
    if (view === 'week') {
      const mon = parseDate(weekDates[0]);
      const sun = parseDate(weekDates[6]);
      return (
        <div className="flex items-center gap-3">
          <button onClick={prevWeek} className="ep-btn-ghost py-2 px-3"><i className="fa-solid fa-chevron-left" /></button>
          <span className="font-semibold text-sm min-w-[200px] text-center">{fmtDateRu(mon)} — {fmtDateRu(sun)}</span>
          <button onClick={nextWeek} className="ep-btn-ghost py-2 px-3"><i className="fa-solid fa-chevron-right" /></button>
          <button onClick={goCurrentWeek} className="ep-btn-ghost py-2 px-4 text-xs font-semibold">Текущая</button>
        </div>
      );
    }
    if (view === 'year') {
      return (
        <div className="flex items-center gap-3">
          <button onClick={prevYear} className="ep-btn-ghost py-2 px-3"><i className="fa-solid fa-chevron-left" /></button>
          <span className="font-semibold text-sm min-w-[120px] text-center">{finYear}</span>
          <button onClick={nextYear} className="ep-btn-ghost py-2 px-3"><i className="fa-solid fa-chevron-right" /></button>
          <button onClick={goCurrentYear} className="ep-btn-ghost py-2 px-4 text-xs font-semibold">Текущий</button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="ep-btn-ghost py-2 px-3"><i className="fa-solid fa-chevron-left" /></button>
        <span className="font-semibold text-sm min-w-[180px] text-center">{MONTHS_RU[finMonth]} {finYear}</span>
        <button onClick={nextMonth} className="ep-btn-ghost py-2 px-3"><i className="fa-solid fa-chevron-right" /></button>
        <button onClick={goCurrentMonth} className="ep-btn-ghost py-2 px-4 text-xs font-semibold">Текущий</button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 ep-fade-in">
        {navHeader()}
        <div className="view-tabs">
          {([['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год']] as const).map(([v, label]) => (
            <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 ep-fade-in" style={{ animationDelay: '0.05s' }}>
        <div className="stat-card">
          <div className="text-xs font-semibold mb-2 ep-muted">ДОХОДЫ</div>
          <div className="text-xl font-bold ep-accent-color">+{fmtMoney(tInc)}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs font-semibold mb-2 ep-muted">РАСХОДЫ</div>
          <div className="text-xl font-bold" style={{ color: 'var(--ep-danger)' }}>-{fmtMoney(tExp)}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs font-semibold mb-2 ep-muted">БАЛАНС</div>
          <div className="text-xl font-bold" style={{ color: bal >= 0 ? 'var(--ep-accent)' : 'var(--ep-danger)' }}>
            {bal >= 0 ? '+' : '-'}{fmtMoney(bal)}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 ep-card-static p-5 ep-fade-in" style={{ animationDelay: '0.1s' }}>
          <h4 className="font-bold text-sm mb-4">{chartTitle}</h4>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              {view === 'year' ? (
                <BarChart data={chartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 10 }} />
                  <YAxis tick={{ fill: tickColor, fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? (v / 1000).toFixed(0) + 'к' : v) + ' ₽'} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [value.toLocaleString('ru-RU') + ' ₽', name === 'income' ? 'Доходы' : 'Расходы']} />
                  <Bar dataKey="income" fill="#00e5a0" radius={[3, 3, 0, 0]} name="income" />
                  <Bar dataKey="expense" fill="#ff5c5c" radius={[3, 3, 0, 0]} name="expense" />
                </BarChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 11 }} />
                  <YAxis tick={{ fill: tickColor, fontSize: 11 }} tickFormatter={(v: number) => v.toLocaleString('ru-RU') + ' ₽'} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [value.toLocaleString('ru-RU') + ' ₽', name === 'income' ? 'Доходы' : 'Расходы']} />
                  <Line type="monotone" dataKey="income" stroke="#00e5a0" strokeWidth={2} dot={false} name="income" />
                  <Line type="monotone" dataKey="expense" stroke="#ff5c5c" strokeWidth={2} dot={false} name="expense" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
        <div className="ep-card-static p-5 ep-fade-in" style={{ animationDelay: '0.15s' }}>
          <h4 className="font-bold text-sm mb-4">Расходы по категориям</h4>
          <div style={{ height: 260 }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50} paddingAngle={2}>
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => value.toLocaleString('ru-RU') + ' ₽'} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-sm ep-muted">Нет расходов</div>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {pieData.map((d, idx) => (
              <div key={d.name} className="flex items-center gap-1 text-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                <span className="ep-muted">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="ep-card-static p-5 ep-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h4 className="font-bold text-sm">
            Операции
            {q && <span className="ml-2 text-xs ep-muted font-normal">найдено: {transactions.length}</span>}
            {!q && filteredFinance.length > 30 && (
              <span className="ml-2 text-xs ep-muted font-normal">последние 30</span>
            )}
          </h4>
          {filteredFinance.length > 0 && (
            <div className="relative w-full sm:w-64">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs ep-muted pointer-events-none" />
              <input
                type="text"
                className="ep-input ep-search-input text-sm"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по категории, описанию, сумме..."
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center ep-muted hover:opacity-70"
                  title="Очистить"
                >
                  <i className="fa-solid fa-xmark text-xs" />
                </button>
              )}
            </div>
          )}
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm py-6 text-center ep-muted">
            {q ? 'Ничего не найдено' : 'Нет операций'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Тип</th>
                  <th>Категория</th>
                  <th className="hidden sm:table-cell">Описание</th>
                  <th>Сумма</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(row => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap">{fmtDateRu(parseDate(row.date))}</td>
                    <td>
                      {isTransferFinance(row) ? (
                        <span className="badge badge-planned" title="Внутренний перевод баланса — не входит в доходы/расходы">
                          Перевод
                        </span>
                      ) : (
                        <span className={`badge ${row.type === 'income' ? 'badge-completed' : 'badge-cancelled'}`}>
                          {row.type === 'income' ? 'Доход' : 'Расход'}
                        </span>
                      )}
                    </td>
                    <td className="text-sm">{row.category}</td>
                    <td className="hidden sm:table-cell text-sm ep-muted">{row.description}</td>
                    <td className="font-semibold whitespace-nowrap" style={{ color: isTransferFinance(row) ? '#60a5fa' : row.type === 'income' ? 'var(--ep-accent)' : 'var(--ep-danger)' }}>
                      {row.type === 'income' ? '+' : '-'}{fmtMoney(row.amount)}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openModal('finance', row.id)}
                          className="w-7 h-7 rounded-md flex items-center justify-center"
                          style={{ background: 'rgba(128,128,128,0.08)', color: 'var(--ep-muted)' }}
                          title="Редактировать"
                        >
                          <i className="fa-solid fa-pen text-xs" />
                        </button>
                        <button
                          onClick={() => openConfirm('Удалить эту операцию?', () => { deleteFinance(row.id); addToast('Операция удалена', 'info'); })}
                          className="w-7 h-7 rounded-md flex items-center justify-center"
                          style={{ background: 'rgba(128,128,128,0.08)', color: 'var(--ep-muted)' }}
                          title="Удалить"
                        >
                          <i className="fa-solid fa-trash text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
