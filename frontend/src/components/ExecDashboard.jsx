import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, BarChart3, Crown, Trophy } from 'lucide-react';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import { buildProductPerformance } from '../utils/productPerformance';
import { STATISTICIAN_DATASET } from '../data/statisticianResults';
import BusiestOrderingDays from './BusiestOrderingDays';
import MobileScrollHint from './MobileScrollHint';

const LEVELS = [
  { key: 'yearly', label: 'Yearly', unit: 'year', column: 'Year' },
  { key: 'monthly', label: 'Monthly', unit: 'month', column: 'Month' },
  { key: 'weekly', label: 'Weekly', unit: 'week', column: 'Week' },
];
const PREVIEW_ROWS = 12;
const TOP_PRODUCTS = 5;
const peso = (n) => `₱${Math.round(n).toLocaleString()}`;
const shortDate = (d, withYear = false) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });
const datasetEnd = new Date(`${STATISTICIAN_DATASET.to}T00:00`);
const plural = (n, unit) => `${n.toLocaleString()} ${unit}${n === 1 ? '' : 's'}`;

// [ANALYTICS] Product Performance gaya ng sheet ng statistician: Most In-Demand Product, Qty Sold at
// Total Sales bawat taon / buwan / linggo, ilang beses naging #1 ang bawat produkto, at kabuuang nabenta.
// Ang orders dito ay galing na sa analyticsOrders (sales history hanggang Aug 31, 2026 + bagong benta).
export default function ExecDashboard({ products = [], orders = [], isDarkMode, period = 'monthly' }) {
  const [level, setLevel] = useState(period);
  useEffect(() => { setLevel(period); }, [period]);
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [selectedName, setSelectedName] = useState(null);

  const levelInfo = LEVELS.find((l) => l.key === level);
  const perf = useMemo(() => buildProductPerformance(orders, level), [orders, level]);
  const imageByProductId = useMemo(() => new Map(products.map((p) => [p.id, p.image])), [products]);

  if (!perf) {
    return <p className="text-sm text-slate-500 text-left">No completed sales yet.</p>;
  }

  const periodsWithSales = perf.periods.filter((p) => p.topProduct);
  const latestFirst = [...perf.periods].reverse();
  const visiblePeriods = showAllPeriods || level === 'yearly' ? latestFirst : latestFirst.slice(0, PREVIEW_ROWS);
  const leader = [...perf.products].sort((a, b) => b.timesTop - a.timesTop || b.quantity - a.quantity)[0];
  const topCounts = perf.products.filter((p) => p.timesTop > 0).sort((a, b) => b.timesTop - a.timesTop || b.quantity - a.quantity);
  const maxTop = Math.max(...topCounts.map((p) => p.timesTop), 1);
  const rankedProducts = showAllProducts ? perf.products : perf.products.slice(0, TOP_PRODUCTS);
  const maxQty = Math.max(...perf.products.map((p) => p.quantity), 1);
  const imageOf = (row) => [...row.productIds].map((id) => imageByProductId.get(id)).find(Boolean);
  const toggleName = (name) => setSelectedName((prev) => (prev === name ? null : name));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Most In-Demand Product per period */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4 text-left min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                Product Performance
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Most in-demand product (most units sold) and total sales per {levelInfo.unit}.
              </p>
            </div>
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1" role="group" aria-label="Product performance period">
              {LEVELS.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => { setLevel(l.key); setShowAllPeriods(false); }}
                  aria-pressed={level === l.key}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    level === l.key ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-950 dark:text-emerald-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {leader && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 sm:col-span-2">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <Crown className="w-3.5 h-3.5" /> Most in demand overall
                </p>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white">{leader.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  #1 in {leader.timesTop} of {plural(periodsWithSales.length, levelInfo.unit)} · {leader.quantity.toLocaleString()} units sold
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total sales</p>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white whitespace-nowrap">{peso(perf.totalSales)}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{perf.totalUnits.toLocaleString()} units · {plural(perf.periods.length, levelInfo.unit)}</p>
              </div>
            </div>
          )}

          <MobileScrollHint />
          <div className="overflow-auto max-h-[520px] rounded-xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-2.5 font-bold">{levelInfo.column}</th>
                  <th className="px-3 py-2.5 font-bold">Most In-Demand Product</th>
                  <th className="px-3 py-2.5 font-bold text-right">Qty Sold</th>
                  <th className="px-3 py-2.5 font-bold text-right">Total Sales</th>
                </tr>
              </thead>
              <tbody>
                {visiblePeriods.map((p) => {
                  const highlighted = selectedName && p.topProduct === selectedName;
                  const dimmed = selectedName && !highlighted;
                  return (
                    <tr
                      key={p.number}
                      className={`border-t border-slate-100 dark:border-slate-800 transition-opacity ${highlighted ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''} ${dimmed ? 'opacity-40' : ''}`}
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{p.label}</p>
                        {level === 'weekly' && <p className="text-[11px] text-slate-400">{shortDate(p.from)} – {shortDate(p.to, true)}</p>}
                        {p.inProgress && <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">In progress</p>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                        {p.topProduct || <span className="text-slate-400">No orders</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{p.topQty ? p.topQty.toLocaleString() : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">{peso(p.totalSales)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-slate-50 dark:bg-slate-800">
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-3 py-2.5 text-xs font-extrabold text-slate-700 dark:text-slate-200" colSpan={2}>TOTAL ({plural(perf.periods.length, levelInfo.unit)})</td>
                  <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-500">{perf.totalUnits.toLocaleString()} units</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-extrabold text-slate-900 dark:text-white whitespace-nowrap">{peso(perf.totalSales)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {level !== 'yearly' && perf.periods.length > PREVIEW_ROWS && (
            <button
              type="button"
              onClick={() => setShowAllPeriods((v) => !v)}
              className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              {showAllPeriods ? `Show latest ${PREVIEW_ROWS} only` : `Show all ${perf.periods.length} ${levelInfo.unit}s`}
            </button>
          )}
          <p className="text-[11px] text-slate-400">
            Nov 2021 – {shortDate(datasetEnd, true)} is the sales history the statistician analyzed ({peso(STATISTICIAN_DATASET.totalSales)}); sales after that are added as they come in.
            All Coconut Husk Pole sizes count as one product, as in the statistician's data.
          </p>
        </div>

        <div className="lg:col-span-5 space-y-6 min-w-0">

          {/* How often each product was #1 */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 text-left space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                Times Most In-Demand
              </h3>
              <p className="text-xs text-slate-400 mt-1">How many {levelInfo.unit}s each product sold the most units. Click one to see its {levelInfo.unit}s in the table.</p>
            </div>
            <ul className="space-y-1">
              {topCounts.map((p) => (
                <li key={p.name}>
                  <button
                    type="button"
                    onClick={() => toggleName(p.name)}
                    aria-pressed={selectedName === p.name}
                    className={`w-full p-2 rounded-xl text-left cursor-pointer transition ${
                      selectedName === p.name ? 'bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{p.name}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap">{plural(p.timesTop, levelInfo.unit)}</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500" style={{ width: `${(p.timesTop / maxTop) * 100}%` }} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Units sold per product */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 text-left space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                Top Selling Products
              </h3>
              <p className="text-xs text-slate-400 mt-1">Units sold and sales per product, all time.</p>
            </div>
            <ul className="space-y-1">
              {rankedProducts.map((p, i) => (
                <li key={p.name}>
                  <button
                    type="button"
                    onClick={() => toggleName(p.name)}
                    aria-pressed={selectedName === p.name}
                    className={`w-full flex items-center gap-3 p-2 rounded-xl text-left cursor-pointer transition ${
                      selectedName === p.name ? 'bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className={`w-6 text-xs font-bold tabular-nums text-center shrink-0 ${i < 3 ? 'text-amber-600' : 'text-slate-400'}`}>#{i + 1}</span>
                    <img src={resolveImageUrl(imageOf(p))} alt="" className="w-9 h-9 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{p.name}</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap">{p.quantity.toLocaleString()} sold</p>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${(p.quantity / maxQty) * 100}%` }} />
                        </div>
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">{peso(p.sales)}</span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {perf.products.length > TOP_PRODUCTS && (
              <button
                type="button"
                onClick={() => setShowAllProducts((v) => !v)}
                className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                {showAllProducts ? `Show top ${TOP_PRODUCTS} only` : `Show all ${perf.products.length} products`}
              </button>
            )}
          </div>

          <BusiestOrderingDays orders={orders} isDarkMode={isDarkMode} />
        </div>
      </div>
    </div>
  );
}
