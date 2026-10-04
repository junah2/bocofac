import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
import { CalendarDays } from 'lucide-react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const REALIZED_ORDER_STATUSES = ['Pending Verification', 'Completed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered'];

const PALETTE = {
  light: { grid: '#e2e8f0', axis: '#94a3b8', tooltipBg: '#ffffff', tooltipBorder: '#e2e8f0', tooltipText: '#0f172a', busiest: '#2f6f4b', other: '#96c6a6' },
  dark: { grid: '#334155', axis: '#64748b', tooltipBg: '#0f172a', tooltipBorder: '#334155', tooltipText: '#f1f5f9', busiest: '#43895e', other: '#214833' },
};

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// [RANKING] Busiest ordering day: bilang ng orders bawat araw ng linggo
export function weekdayStats(orders) {
  const days = WEEKDAYS.map((day, i) => ({ day, name: WEEKDAY_NAMES[i], count: 0 }));
  orders
    .filter((o) => REALIZED_ORDER_STATUSES.includes(o.status))
    .forEach((o) => { days[new Date(o.orderedAt).getDay()].count++; });
  const total = days.reduce((s, d) => s + d.count, 0);
  const busiest = days.reduce((best, d) => (d.count > best.count ? d : best), days[0]);
  const quietest = days.reduce((low, d) => (d.count < low.count ? d : low), days[0]);
  return { days, total, busiest, quietest };
}

export default function BusiestOrderingDays({ orders = [], isDarkMode }) {
  const palette = PALETTE[isDarkMode ? 'dark' : 'light'];
  const { days, total, busiest, quietest } = useMemo(() => weekdayStats(orders), [orders]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4 text-left min-w-0">
      <div>
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          Busiest Ordering Days
        </h3>
        <p className="text-xs text-slate-400 mt-1">Completed and in-progress orders by day of the week - plan stock, staff and deliveries around the peaks.</p>
      </div>

      {total === 0 ? (
        <p className="text-xs text-slate-400 text-center py-10">No completed orders yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Busiest day</p>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">{busiest.name}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{busiest.count.toLocaleString()} orders · {pct(busiest.count, total)}%</p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Quietest day</p>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">{quietest.name}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{quietest.count.toLocaleString()} orders · {pct(quietest.count, total)}%</p>
            </div>
          </div>

          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={days} margin={{ top: 22, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: palette.axis }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: palette.axis }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                  content={({ active, payload }) => (active && payload?.length ? (
                    <div className="rounded-lg px-3 py-2 text-xs font-semibold shadow-lg border" style={{ background: palette.tooltipBg, borderColor: palette.tooltipBorder, color: palette.tooltipText }}>
                      {payload[0].payload.name}: {payload[0].value.toLocaleString()} orders ({pct(payload[0].value, total)}%)
                    </div>
                  ) : null)}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={38}>
                  {days.map((d) => (
                    <Cell key={d.day} fill={d.day === busiest.day ? palette.busiest : palette.other} />
                  ))}
                  <LabelList dataKey="count" content={(p) => (p.value === busiest.count && p.value > 0 ? <text x={p.x + p.width / 2} y={p.y - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill={palette.axis}>Busiest</text> : null)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {busiest.count > quietest.count && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Restock before <span className="font-semibold text-slate-700 dark:text-slate-200">{busiest.name}</span> and try running promos on <span className="font-semibold text-slate-700 dark:text-slate-200">{quietest.name}</span>.
            </p>
          )}
        </>
      )}
    </div>
  );
}
