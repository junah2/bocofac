import React, { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
import { Sparkles, Crown, Flame, PackageX, CalendarRange, Trophy, Target, Info } from 'lucide-react';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import MobileScrollHint from '../components/MobileScrollHint';

const TABLE_PREVIEW = 10;
const TOP_COUNT = 5;
const peso = (n) => `₱${Math.round(n).toLocaleString()}`;

const LEVEL_STYLES = {
  High: { dot: 'bg-emerald-600', text: 'text-emerald-700 dark:text-emerald-400', bar: { light: '#2f6f4b', dark: '#43895e' } },
  Moderate: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bar: { light: '#f59e0b', dark: '#fbbf24' } },
  Low: { dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400', bar: { light: '#cbd5e1', dark: '#475569' } },
};
const RESTOCK_STYLES = {
  Restock: 'text-rose-600 dark:text-rose-400',
  Sufficient: 'text-emerald-700 dark:text-emerald-400',
  'Not in catalog': 'text-slate-400',
};
const RESTOCK_LABELS = { Restock: 'Restock Recommended', Sufficient: 'Sufficient Stock', 'Not in catalog': 'Not in catalog' };
const CHART = {
  light: { grid: '#e2e8f0', axis: '#94a3b8', tooltipBg: '#ffffff', tooltipBorder: '#e2e8f0', tooltipText: '#0f172a' },
  dark: { grid: '#334155', axis: '#64748b', tooltipBg: '#0f172a', tooltipBorder: '#334155', tooltipText: '#f1f5f9' },
};
const TONES = {
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
};

function SummaryCard({ icon: Icon, label, value, sub, tone = 'emerald' }) {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex flex-col gap-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TONES[tone]}`}><Icon className="w-4 h-4" /></span>
      </div>
      <p className="text-lg xl:text-xl font-extrabold text-slate-900 dark:text-white leading-tight line-clamp-2" title={value}>{value}</p>
      <p className="text-[11px] text-slate-400">{sub}</p>
    </div>
  );
}

function DemandLevel({ level }) {
  const style = LEVEL_STYLES[level];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap ${style.text}`}>
      <span className={`w-2 h-2 rounded-full ${style.dot}`} /> {level}
    </span>
  );
}

// [PREDICTIVE ANALYTICS] Product Performance (UI lang): ipinapakita ang hula na ibinibigay ng SalesForecast
// (predictions = toProductPredictions(...)), galing sa resulta ng statistician sa Google Colab.
export default function ProductForecast({ predictions, periodName, periodLabel, projectedSales, imageOf, isDarkMode, comparison, method }) {
  const [showAll, setShowAll] = useState(false);
  if (!predictions || predictions.length === 0) return null;

  const chart = CHART[isDarkMode ? 'dark' : 'light'];
  const top = predictions[0];
  const highCount = predictions.filter((p) => p.demandLevel === 'High').length;
  const restockCount = predictions.filter((p) => p.restockStatus === 'Restock').length;
  const totalDemand = predictions.reduce((s, p) => s + p.predictedDemand, 0);
  const visible = showAll ? predictions : predictions.slice(0, TABLE_PREVIEW);
  const topProducts = predictions.slice(0, TOP_COUNT);
  const chartData = predictions.filter((p) => p.predictedDemand > 0).map((p) => ({ name: p.productName, value: p.predictedDemand, level: p.demandLevel }));
  const shortName = (name) => (name.length > 16 ? `${name.slice(0, 15)}…` : name);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-5 sm:p-6 text-left space-y-6">
      {/* Header + forecast period */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            Product Performance Forecast
          </h3>
          <p className="text-xs text-slate-400 mt-1">Which products are expected to be in demand, how many units may sell, and which may need restocking.</p>
        </div>
        <div className="self-start shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Forecast Period</p>
          <p className="text-sm font-extrabold text-slate-900 dark:text-white whitespace-nowrap">{periodName} · {periodLabel}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <SummaryCard icon={Crown} label="Highest Predicted Demand" value={top.productName} sub={`~${top.predictedDemand.toLocaleString()} units expected`} />
        <SummaryCard icon={Flame} tone="amber" label="Products with High Demand" value={`${highCount} product${highCount === 1 ? '' : 's'}`} sub={`out of ${predictions.length} products`} />
        <SummaryCard icon={PackageX} tone="rose" label="Products Needing Restock" value={`${restockCount} product${restockCount === 1 ? '' : 's'}`} sub="Stock below the predicted demand" />
        <SummaryCard icon={CalendarRange} tone="sky" label="Forecast Period" value={periodName} sub={`${periodLabel} · ${peso(projectedSales)} expected sales`} />
      </div>

      {/* Prediction table */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Product Performance Prediction</h4>
        <MobileScrollHint />
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="px-3 py-3 w-14 text-center">Rank</th>
                <th className="px-3 py-3">Product</th>
                <th className="px-3 py-3 text-right">Current Stock</th>
                <th className="px-3 py-3 text-right">Predicted Demand</th>
                <th className="px-3 py-3">Demand Level</th>
                <th className="px-3 py-3">Restock Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {visible.map((p, i) => (
                <tr key={p.productId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs font-extrabold tabular-nums ${i < 3 ? 'text-amber-600' : 'text-slate-400'}`}>{i + 1}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <img src={resolveImageUrl(imageOf(p))} alt="" className="w-8 h-8 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{p.productName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{p.currentStock === null ? '—' : p.currentStock.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-bold text-slate-900 dark:text-white">{p.predictedDemand.toLocaleString()}</td>
                  <td className="px-3 py-3"><DemandLevel level={p.demandLevel} /></td>
                  <td className={`px-3 py-3 text-xs font-bold whitespace-nowrap ${RESTOCK_STYLES[p.restockStatus]}`}>{RESTOCK_LABELS[p.restockStatus]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {predictions.length > TABLE_PREVIEW && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            {showAll ? `Show top ${TABLE_PREVIEW} only` : `Show all ${predictions.length} products`}
          </button>
        )}
      </div>

      {/* Chart + top products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Predicted Product Demand — {periodName}</h4>
            <div className="flex gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              {['High', 'Moderate', 'Low'].map((l) => (
                <span key={l} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${LEVEL_STYLES[l].dot}`} />{l}</span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <div style={{ minWidth: Math.max(560, chartData.length * 44), height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 20, right: 8, left: 18, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="name" interval={0} angle={-40} textAnchor="end" height={92} tickFormatter={shortName} tick={{ fontSize: 10, fill: chart.axis }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chart.axis }} axisLine={false} tickLine={false} width={48} label={{ value: 'Predicted quantity', angle: -90, position: 'insideLeft', offset: -8, style: { fontSize: 10, fill: chart.axis, textAnchor: 'middle' } }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                    content={({ active, payload }) => (active && payload?.length ? (
                      <div className="rounded-lg px-3 py-2 text-xs font-semibold shadow-lg border" style={{ background: chart.tooltipBg, borderColor: chart.tooltipBorder, color: chart.tooltipText }}>
                        <p>{payload[0].payload.name}</p>
                        <p className="opacity-70">Predicted demand: {payload[0].value.toLocaleString()} units · {payload[0].payload.level}</p>
                      </div>
                    ) : null)}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={34}>
                    {chartData.map((d) => <Cell key={d.name} fill={LEVEL_STYLES[d.level].bar[isDarkMode ? 'dark' : 'light']} />)}
                    <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 700, fill: chart.axis }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-600" /> Top Predicted Products
          </h4>
          <ol className="space-y-2">
            {topProducts.map((p, i) => (
              <li key={p.productId} className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>{i + 1}</span>
                <img src={resolveImageUrl(imageOf(p))} alt="" className="w-9 h-9 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{p.productName}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${top.predictedDemand > 0 ? (p.predictedDemand / top.predictedDemand) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">{p.predictedDemand.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400">units</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-slate-400">{totalDemand.toLocaleString()} units predicted across all products for {periodLabel}.</p>
        </div>
      </div>

      {/* Actual vs Predicted - lalabas lang kapag may kumpletong aktuwal na benta na para sa forecast period */}
      {comparison?.available ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> Actual vs Predicted Sales — {periodLabel}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Average error: <span className="font-bold text-slate-800 dark:text-slate-100">{comparison.meanError.toFixed(1)} units</span> per product</p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3 text-right">Predicted</th>
                  <th className="px-3 py-3 text-right">Actual</th>
                  <th className="px-3 py-3 text-right">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {comparison.rows.map((r) => (
                  <tr key={r.productName}>
                    <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-100">{r.productName}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.predicted.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.actual.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-900 dark:text-white">{r.error.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : comparison?.message ? (
        <p className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {comparison.message}
        </p>
      ) : null}

      <p className="text-[11px] text-slate-400 leading-relaxed">{method}</p>
    </div>
  );
}
