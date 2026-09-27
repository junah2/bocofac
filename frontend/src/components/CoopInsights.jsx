import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
} from 'recharts';
import { Lightbulb, Wallet, ArrowDownUp, Users, CalendarDays, UserCheck } from 'lucide-react';
import { lastNMonths } from '../utils/dateBuckets';

// Decision-support analytics for the cooperative side of BOCOFAC (savings,
// withdrawals, member payments, membership growth) - the e-commerce side is
// covered by ExecDashboard. Everything is computed from data the dashboards
// already load; nothing here writes anywhere.
//
// Money in / money out colors were run through the dataviz palette validator
// (light on #fcfcfb, dark on #0f172a): both pairs pass, with colorblind
// separation in the 6-8 band - so the two series also differ by position
// (side-by-side bars), carry a legend, and are named in the tooltip.
const PALETTE = {
  light: { grid: '#e2e8f0', axis: '#94a3b8', tooltipBg: '#ffffff', tooltipBorder: '#e2e8f0', tooltipText: '#0f172a', moneyIn: '#2f855a', moneyOut: '#d97706', single: '#2f855a', singleMuted: '#9fc5b0' },
  dark: { grid: '#334155', axis: '#64748b', tooltipBg: '#0f172a', tooltipBorder: '#334155', tooltipText: '#f1f5f9', moneyIn: '#1f9d57', moneyOut: '#dd6b20', single: '#1f9d57', singleMuted: '#1e5b3a' },
};

// Withdrawal size bands - small enough to be useful for cash planning,
// few enough to read at a glance.
const WITHDRAWAL_BANDS = [
  { label: '₱500 & below', short: '≤500', max: 500 },
  { label: '₱501–1,000', short: '501–1k', max: 1000 },
  { label: '₱1,001–2,000', short: '1k–2k', max: 2000 },
  { label: '₱2,001–5,000', short: '2k–5k', max: 5000 },
  { label: '₱5,001–10,000', short: '5k–10k', max: 10000 },
  { label: 'Over ₱10,000', short: '10k+', max: Infinity },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const REALIZED_ORDER_STATUSES = ['Completed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered'];
const INACTIVE_PAYER_DAYS = 90;

const peso = (n) => `₱${Math.round(n).toLocaleString()}`;
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function sameMonth(date, bucket) {
  const d = new Date(date);
  return d.getFullYear() === bucket.year && d.getMonth() === bucket.month;
}

function StatTile({ label, value, sub }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-5 text-left min-w-0">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 break-words">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function Card({ icon: Icon, title, description, children }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-3 text-left min-w-0">
      <div>
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Icon className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          {title}
        </h3>
        {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export default function CoopInsights({ members = [], ledger = [], withdrawals = [], orders = [], applicants = [], isDarkMode }) {
  const palette = PALETTE[isDarkMode ? 'dark' : 'light'];

  // --- Withdrawals: how much members usually take out ---
  const withdrawalStats = useMemo(() => {
    const amounts = withdrawals.map(w => w.requestedAmount).filter(a => a > 0);
    const bands = WITHDRAWAL_BANDS.map(b => ({ ...b, count: 0 }));
    amounts.forEach(a => { bands.find(b => a <= b.max).count++; });
    const topBand = bands.reduce((best, b) => (b.count > best.count ? b : best), bands[0]);

    const frequency = new Map();
    amounts.forEach(a => frequency.set(a, (frequency.get(a) || 0) + 1));
    let mostCommonAmount = null;
    frequency.forEach((count, amount) => {
      if (!mostCommonAmount || count > mostCommonAmount.count) mostCommonAmount = { amount, count };
    });

    const sent = withdrawals.filter(w => w.status === 'Sent');
    const rejected = withdrawals.filter(w => w.status === 'Rejected');
    const pending = withdrawals.filter(w => w.status === 'Pending');
    return {
      count: amounts.length,
      bands,
      topBand,
      median: median(amounts),
      average: amounts.length ? amounts.reduce((s, a) => s + a, 0) / amounts.length : 0,
      mostCommonAmount,
      totalSent: sent.reduce((s, w) => s + (w.sentAmount ?? w.requestedAmount), 0),
      approvalRate: sent.length + rejected.length > 0 ? pct(sent.length, sent.length + rejected.length) : null,
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, w) => s + w.requestedAmount, 0),
    };
  }, [withdrawals]);

  // --- Money in (verified share capital) vs money out (sent withdrawals) ---
  const cashFlow = useMemo(() => {
    return lastNMonths(6).map(b => {
      const moneyIn = ledger
        .filter(l => l.status === 'Verified' && sameMonth(l.paymentDate, b))
        .reduce((s, l) => s + l.amount, 0);
      const moneyOut = withdrawals
        .filter(w => w.status === 'Sent' && sameMonth(w.processedAt || w.requestedAt, b))
        .reduce((s, w) => s + (w.sentAmount ?? w.requestedAmount), 0);
      return { label: `${b.label} ${String(b.year).slice(2)}`, moneyIn, moneyOut, net: moneyIn - moneyOut };
    });
  }, [ledger, withdrawals]);
  const last3 = cashFlow.slice(-3);
  const last3In = last3.reduce((s, m) => s + m.moneyIn, 0);
  const last3Out = last3.reduce((s, m) => s + m.moneyOut, 0);
  const avgMonthlyOut = cashFlow.reduce((s, m) => s + m.moneyOut, 0) / cashFlow.length;

  // --- Share capital payment standing per member ---
  const payerStatus = useMemo(() => {
    const now = Date.now();
    let fullyPaid = 0, paying = 0, noPayment = 0, inactive = 0;
    const inactiveMembers = [];
    members.filter(m => m.status !== 'Removed').forEach(m => {
      const payments = ledger.filter(l => l.memberId === m.id && l.status === 'Verified');
      const paid = payments.reduce((s, l) => s + l.amount, 0);
      if (paid >= m.requiredShareCapital && m.requiredShareCapital > 0) { fullyPaid++; return; }
      if (payments.length === 0) { noPayment++; return; }
      paying++;
      const lastPaid = Math.max(...payments.map(l => new Date(l.paymentDate).getTime()));
      const days = Math.floor((now - lastPaid) / 86400000);
      if (days >= INACTIVE_PAYER_DAYS) {
        inactive++;
        inactiveMembers.push({ id: m.id, name: m.name, days, remaining: m.requiredShareCapital - paid });
      }
    });
    inactiveMembers.sort((a, b) => b.days - a.days);
    return { fullyPaid, paying, noPayment, inactive, inactiveMembers, total: fullyPaid + paying + noPayment };
  }, [members, ledger]);

  // --- When customers order ---
  const ordersByWeekday = useMemo(() => {
    const counts = WEEKDAYS.map((day, i) => ({ day, name: WEEKDAY_NAMES[i], count: 0 }));
    orders
      .filter(o => REALIZED_ORDER_STATUSES.includes(o.status))
      .forEach(o => { counts[new Date(o.orderedAt).getDay()].count++; });
    return counts;
  }, [orders]);
  const totalWeekdayOrders = ordersByWeekday.reduce((s, d) => s + d.count, 0);
  const busiestDay = ordersByWeekday.reduce((best, d) => (d.count > best.count ? d : best), ordersByWeekday[0]);
  const quietestDay = ordersByWeekday.reduce((low, d) => (d.count < low.count ? d : low), ordersByWeekday[0]);

  // --- Membership pipeline ---
  const pipeline = useMemo(() => {
    const submitted = applicants.filter(a => a.status !== 'Draft');
    const approved = submitted.filter(a => a.status === 'Approved').length;
    const rejected = submitted.filter(a => a.status === 'Rejected').length;
    const waitingPmes = submitted.filter(a => a.status === 'PMES Pending').length;
    const forReview = submitted.filter(a => a.status === 'Pending Review').length;
    return { submitted: submitted.length, approved, rejected, waitingPmes, forReview, approvalRate: pct(approved, approved + rejected) };
  }, [applicants]);

  // --- Plain-language takeaways, strongest signals first ---
  const takeaways = [];
  if (withdrawalStats.count > 0) {
    takeaways.push(`Most withdrawals are ${withdrawalStats.topBand.label} (${withdrawalStats.topBand.count} of ${withdrawalStats.count} request${withdrawalStats.count === 1 ? '' : 's'}, ${pct(withdrawalStats.topBand.count, withdrawalStats.count)}%). A typical request is ${peso(withdrawalStats.median)}${withdrawalStats.mostCommonAmount && withdrawalStats.mostCommonAmount.count > 1 ? `, and ${peso(withdrawalStats.mostCommonAmount.amount)} is the single most requested amount` : ''}.`);
  }
  if (avgMonthlyOut > 0) {
    takeaways.push(`Members withdrew about ${peso(avgMonthlyOut)} a month over the last 6 months - keeping at least that much cash ready each month avoids delayed releases.`);
  }
  if (last3In > 0 || last3Out > 0) {
    takeaways.push(last3Out > last3In
      ? `Withdrawals (${peso(last3Out)}) exceeded share capital collected (${peso(last3In)}) in the last 3 months - consider a contribution drive or pacing large withdrawals.`
      : `Share capital collected (${peso(last3In)}) covered withdrawals (${peso(last3Out)}) in the last 3 months - a net gain of ${peso(last3In - last3Out)}.`);
  }
  if (withdrawalStats.pendingCount > 0) {
    takeaways.push(`${withdrawalStats.pendingCount} withdrawal request${withdrawalStats.pendingCount > 1 ? 's are' : ' is'} waiting (${peso(withdrawalStats.pendingAmount)} total) - prepare this amount for release.`);
  }
  if (payerStatus.inactive > 0 || payerStatus.noPayment > 0) {
    const parts = [];
    if (payerStatus.noPayment > 0) parts.push(`${payerStatus.noPayment} member${payerStatus.noPayment > 1 ? 's have' : ' has'} not paid any share capital yet`);
    if (payerStatus.inactive > 0) parts.push(`${payerStatus.inactive} ha${payerStatus.inactive > 1 ? 've' : 's'} not paid in ${INACTIVE_PAYER_DAYS}+ days`);
    takeaways.push(`${parts.join(' and ')} - a payment reminder could raise collections.`);
  }
  if (totalWeekdayOrders >= 7 && busiestDay.count > quietestDay.count) {
    takeaways.push(`${busiestDay.name} is the busiest ordering day (${pct(busiestDay.count, totalWeekdayOrders)}% of orders) and ${quietestDay.name} the quietest - schedule restocking and deliveries around it, and try promos on ${quietestDay.name}.`);
  }
  if (pipeline.waitingPmes + pipeline.forReview > 0) {
    takeaways.push(`${pipeline.forReview} application${pipeline.forReview === 1 ? ' is' : 's are'} ready for Board review and ${pipeline.waitingPmes} still need${pipeline.waitingPmes === 1 ? 's' : ''} to attend PMES.`);
  }

  const ChartTooltip = ({ active, payload, label, render }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg px-3 py-2 text-xs font-semibold shadow-lg border" style={{ background: palette.tooltipBg, borderColor: palette.tooltipBorder, color: palette.tooltipText }}>
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-60 mb-1">{label}</p>
        {render(payload)}
      </div>
    );
  };

  const maxBandCount = Math.max(...withdrawalStats.bands.map(b => b.count));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="space-y-1 text-left border-b border-slate-200 dark:border-slate-800 pb-2">
        <p className="text-xs font-mono uppercase tracking-widest text-[#d97706] font-bold">COOPERATIVE INSIGHTS</p>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Savings, Withdrawals &amp; Member Behavior</h2>
      </div>

      {/* Takeaways first: the decision-ready summary of everything below. */}
      <div className="bg-[#FDFCF7] dark:bg-emerald-950/25 border border-emerald-100 dark:border-slate-800 rounded-2xl p-6 text-left space-y-3">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Key Takeaways for Decision-Making
        </h3>
        {takeaways.length === 0 ? (
          <p className="text-xs text-slate-500">Not enough activity yet - takeaways appear once members start saving, withdrawing and ordering.</p>
        ) : (
          <ul className="space-y-2">
            {takeaways.map((t, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Typical Withdrawal" value={peso(withdrawalStats.median)} sub={`Median of ${withdrawalStats.count} request${withdrawalStats.count === 1 ? '' : 's'}`} />
        <StatTile
          label="Most Requested Amount"
          value={withdrawalStats.mostCommonAmount ? peso(withdrawalStats.mostCommonAmount.amount) : '—'}
          sub={withdrawalStats.mostCommonAmount ? `Asked ${withdrawalStats.mostCommonAmount.count} time${withdrawalStats.mostCommonAmount.count === 1 ? '' : 's'}` : 'No requests yet'}
        />
        <StatTile label="Total Released" value={peso(withdrawalStats.totalSent)} sub={`Average request ${peso(withdrawalStats.average)}`} />
        <StatTile label="Approval Rate" value={withdrawalStats.approvalRate === null ? '—' : `${withdrawalStats.approvalRate}%`} sub={`${withdrawalStats.pendingCount} pending now`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card icon={Wallet} title="Common Withdrawal Amounts" description="How many withdrawal requests fall in each amount range (₱). The tallest bar is what members usually take out.">
          {withdrawalStats.count === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">No withdrawal requests yet.</p>
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={withdrawalStats.bands} margin={{ top: 22, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                  <XAxis dataKey="short" tick={{ fontSize: 10, fill: palette.axis }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: palette.axis }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                    content={<ChartTooltip render={(p) => <p>{p[0].payload.label}: {p[0].value} request{p[0].value === 1 ? '' : 's'} ({pct(p[0].value, withdrawalStats.count)}%)</p>} />}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {withdrawalStats.bands.map(b => (
                      <Cell key={b.label} fill={b.count === maxBandCount ? palette.single : palette.singleMuted} />
                    ))}
                    <LabelList dataKey="count" content={(p) => (p.value === maxBandCount && p.value > 0 ? <text x={p.x + p.width / 2} y={p.y - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill={palette.axis}>Most common</text> : null)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card icon={ArrowDownUp} title="Money In vs Money Out" description="Verified share capital collected vs withdrawals released, last 6 months.">
          <div className="flex gap-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: palette.moneyIn }} /> Share capital in</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: palette.moneyOut }} /> Withdrawals out</span>
          </div>
          <div style={{ width: '100%', height: 236 }}>
            <ResponsiveContainer>
              <BarChart data={cashFlow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: palette.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: palette.axis }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => (v >= 1000 ? `₱${(v / 1000).toFixed(0)}k` : `₱${v}`)} />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                  content={<ChartTooltip render={(p) => {
                    const row = p[0].payload;
                    return (
                      <>
                        <p>Share capital in: {peso(row.moneyIn)}</p>
                        <p>Withdrawals out: {peso(row.moneyOut)}</p>
                        <p className="mt-1 pt-1 border-t" style={{ borderColor: palette.tooltipBorder }}>Net: {row.net >= 0 ? '+' : '−'}{peso(Math.abs(row.net))}</p>
                      </>
                    );
                  }} />}
                />
                <Bar dataKey="moneyIn" name="Share capital in" fill={palette.moneyIn} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="moneyOut" name="Withdrawals out" fill={palette.moneyOut} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card icon={Users} title="Share Capital Payment Standing" description="Where members are on their required share capital - who to thank, who to remind.">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Fully paid', value: payerStatus.fullyPaid },
              { label: 'Still paying', value: payerStatus.paying },
              { label: 'No payment yet', value: payerStatus.noPayment },
              { label: `No payment in ${INACTIVE_PAYER_DAYS}+ days`, value: payerStatus.inactive, of: payerStatus.paying, ofLabel: 'of those still paying' },
            ].map(s => (
              <div key={s.label} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                <p className="text-xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{s.label} · {pct(s.value, s.of ?? payerStatus.total)}% {s.ofLabel || 'of members'}</p>
              </div>
            ))}
          </div>
          {payerStatus.inactiveMembers.length > 0 && (
            <div className="pt-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Longest without a payment</p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {payerStatus.inactiveMembers.slice(0, 5).map(m => (
                  <div key={m.id} className="py-1.5 flex justify-between gap-3 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{m.name}</span>
                    <span className="text-slate-500 dark:text-slate-400 shrink-0">{m.days} days · {peso(m.remaining)} left</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card icon={CalendarDays} title="Busiest Ordering Days" description="Completed and in-progress orders by day of the week - plan stock, staff and deliveries around the peaks.">
          {totalWeekdayOrders === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">No completed orders yet.</p>
          ) : (
            <div style={{ width: '100%', height: 236 }}>
              <ResponsiveContainer>
                <BarChart data={ordersByWeekday} margin={{ top: 22, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: palette.axis }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: palette.axis }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                    content={<ChartTooltip render={(p) => <p>{p[0].payload.name}: {p[0].value} orders ({pct(p[0].value, totalWeekdayOrders)}%)</p>} />}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36}>
                    {ordersByWeekday.map(d => (
                      <Cell key={d.day} fill={d.day === busiestDay.day ? palette.single : palette.singleMuted} />
                    ))}
                    <LabelList dataKey="count" content={(p) => (p.value === busiestDay.count && p.value > 0 ? <text x={p.x + p.width / 2} y={p.y - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill={palette.axis}>Busiest</text> : null)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card icon={UserCheck} title="Membership Pipeline" description="Submitted applications and where they are now.">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Applications', value: pipeline.submitted },
            { label: 'Waiting for PMES', value: pipeline.waitingPmes },
            { label: 'Ready for review', value: pipeline.forReview },
            { label: 'Approved', value: pipeline.approved },
            { label: 'Approval rate', value: `${pipeline.approvalRate}%` },
          ].map(s => (
            <div key={s.label} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
              <p className="text-xl font-bold text-slate-900 dark:text-white">{s.value}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
