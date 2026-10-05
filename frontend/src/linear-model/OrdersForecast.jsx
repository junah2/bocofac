import React from 'react';
import { ResponsiveContainer, ComposedChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { Users, ShoppingCart, History, TrendingUp, TrendingDown, Receipt, Info } from 'lucide-react';

const CHART = {
  light: { grid: '#e2e8f0', axis: '#94a3b8', tooltipBg: '#ffffff', tooltipBorder: '#e2e8f0', tooltipText: '#0f172a', actual: '#2f6f4b', forecast: '#d97706' },
  dark: { grid: '#334155', axis: '#64748b', tooltipBg: '#0f172a', tooltipBorder: '#334155', tooltipText: '#f1f5f9', actual: '#43895e', forecast: '#fbbf24' },
};
const TONES = {
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300',
};
const peso = (n) => `₱${Math.round(n).toLocaleString()}`;
const orders = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const orderCount = (n) => `${orders(n)} ${n === 1 ? 'order' : 'orders'}`;

function SummaryCard({ icon: Icon, label, value, sub, tone = 'emerald' }) {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex flex-col gap-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TONES[tone]}`}><Icon className="w-4 h-4" /></span>
      </div>
      <p className="text-lg xl:text-xl font-extrabold text-slate-900 dark:text-white leading-tight whitespace-nowrap">{value}</p>
      <p className="text-[11px] text-slate-400">{sub}</p>
    </div>
  );
}

// [PREDICTIVE ANALYTICS] Customer Purchase Pattern Forecast (UI lang): hula sa bilang ng orders mula sa
// orders regression ng statistician (model.js), kasama ang average na benta bawat order
export default function OrdersForecast({
  periodName, periodLabel, unit, projectedOrders, previousOrders, previousLabel,
  projectedSales, previousSales, accuracy, accuracyNote, result, equation, chartData, isDarkMode,
}) {
  const chart = CHART[isDarkMode ? 'dark' : 'light'];
  const change = previousOrders > 0 ? (projectedOrders - previousOrders) / previousOrders : null;
  const projectedAverage = projectedOrders > 0 ? projectedSales / projectedOrders : null;
  const previousAverage = previousOrders > 0 ? previousSales / previousOrders : null;
  const lastActual = chartData.filter((d) => d.actual !== undefined).pop();

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-5 sm:p-6 text-left space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            Customer Purchase Pattern Forecast
          </h3>
          <p className="text-xs text-slate-400 mt-1">How many orders customers are expected to place, and how much they spend per order.</p>
        </div>
        <div className="self-start shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Forecast Period</p>
          <p className="text-sm font-extrabold text-slate-900 dark:text-white whitespace-nowrap">{periodName} · {periodLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <SummaryCard icon={ShoppingCart} label="Projected Orders" value={orderCount(projectedOrders)} sub={periodLabel} />
        <SummaryCard icon={History} tone="sky" label="Previous Period" value={orderCount(previousOrders)} sub={`Actual orders, ${previousLabel}`} />
        <SummaryCard
          icon={change !== null && change < 0 ? TrendingDown : TrendingUp}
          tone={change !== null && change < 0 ? 'rose' : 'emerald'}
          label="Expected Change"
          value={change === null ? '—' : `${change >= 0 ? '+' : '−'}${Math.abs(change * 100).toFixed(1)}%`}
          sub="Projected vs previous period"
        />
        <SummaryCard
          icon={Receipt}
          tone="amber"
          label="Average Sale per Order"
          value={projectedAverage === null ? '—' : peso(projectedAverage)}
          sub={previousAverage === null ? 'Projected sales ÷ projected orders' : `Previous period: ${peso(previousAverage)}`}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Orders per {unit} — actual and forecast</h4>
          <div className="flex gap-4 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded" style={{ background: chart.actual }} />Actual</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 rounded border-t-2 border-dashed" style={{ borderColor: chart.forecast }} />Forecast</span>
          </div>
        </div>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: chart.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chart.axis }} axisLine={false} tickLine={false} width={44} />
              <Tooltip
                content={({ active, payload, label }) => (active && payload?.length ? (
                  <div className="rounded-lg px-3 py-2 text-xs font-semibold shadow-lg border" style={{ background: chart.tooltipBg, borderColor: chart.tooltipBorder, color: chart.tooltipText }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide opacity-60 mb-1">{label}</p>
                    {payload[0].payload.actual !== undefined && <p>Actual: {orderCount(payload[0].payload.actual)}</p>}
                    {payload[0].payload.forecast !== undefined && payload[0].payload.isForecast && <p>Forecast: {orderCount(payload[0].payload.forecast)}</p>}
                  </div>
                ) : null)}
              />
              {lastActual && <ReferenceLine x={lastActual.label} stroke={chart.axis} strokeDasharray="2 4" />}
              <Line dataKey="actual" stroke={chart.actual} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="forecast" stroke={chart.forecast} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {[
          { label: 'Model', value: equation },
          { label: 'Tested accuracy', value: accuracy === null ? '—' : `${Math.round(accuracy * 100)}% ${accuracyNote}` },
          { label: 'R²', value: result ? result.r2.toFixed(3) : '—' },
          { label: 'p-value', value: result ? `${result.p.toFixed(3)} (${result.p < 0.05 ? 'significant' : 'not significant'})` : '—' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100 break-words">{item.value}</p>
          </div>
        ))}
      </div>

      <p className="flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        Source: the statistician&apos;s linear regression of the number of orders per {unit} (Customer Purchase Pattern), trained on the sales history.
        The number of orders in that history is nearly the same every {unit}, so the forecast is nearly flat. These are forecasts, not guaranteed orders.
      </p>
    </div>
  );
}
