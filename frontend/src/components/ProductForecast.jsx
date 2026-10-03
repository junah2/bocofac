import React, { useMemo, useState } from 'react';
import { Crown, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import MobileScrollHint from './MobileScrollHint';

const PREVIEW_ROWS = 8;
const peso = (n) => `₱${Math.round(n).toLocaleString()}`;
const pct = (v) => (v > 0 && v < 0.01 ? '<1%' : `${Math.round(v * 100)}%`);

const TREND = {
  Rising: { icon: TrendingUp, className: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40' },
  Declining: { icon: TrendingDown, className: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40' },
  Steady: { icon: Minus, className: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800' },
  'Low volume': { icon: Minus, className: 'text-slate-400 bg-slate-50 dark:text-slate-500 dark:bg-slate-800/60' },
};

// Ilang linggo pa tatagal ang stock: pula kapag wala o < 2 linggo, dilaw kapag < 4 linggo
function StockCover({ row }) {
  if (row.stock === null) return <span className="text-xs text-slate-400">Not in catalog</span>;
  if (row.stock === 0) return <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Out of stock</span>;
  if (row.weeksOfStock === Infinity) return <span className="text-xs text-slate-500">{row.stock.toLocaleString()} in stock</span>;
  const weeks = row.weeksOfStock;
  const tone = weeks < 2 ? 'text-rose-600 dark:text-rose-400' : weeks < 4 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400';
  const label = weeks < 1 ? 'Less than a week' : weeks >= 52 ? 'Over a year' : `~${Math.floor(weeks)} week${Math.floor(weeks) === 1 ? '' : 's'}`;
  return (
    <span className="block">
      <span className={`text-xs font-bold ${tone}`}>{label}</span>
      <span className="block text-[11px] text-slate-400">{row.stock.toLocaleString()} in stock</span>
    </span>
  );
}

// [PREDICTIVE ANALYTICS] Product Performance Forecast: aling produkto ang malamang na pinaka-mabenta
// sa susunod na period, at ilan ang inaasahang mabebenta bawat produkto (batay sa projected sales ng statistician)
export default function ProductForecast({ prediction, periodLabel, unit, imageOf }) {
  const [showAll, setShowAll] = useState(false);
  const byDemand = useMemo(() => (prediction ? [...prediction.rows].sort((a, b) => b.expectedUnits - a.expectedUnits || b.expectedSales - a.expectedSales) : []), [prediction]);
  if (!prediction) return null;

  const [leader, ...runnersUp] = prediction.rows;
  const visible = showAll ? byDemand : byDemand.slice(0, PREVIEW_ROWS);
  const maxChance = Math.max(...prediction.rows.map((r) => r.chanceTop), 0.0001);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 text-left space-y-5">
      <div>
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          Product Performance Forecast
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Expected demand per product for <span className="font-semibold text-slate-600 dark:text-slate-300">{periodLabel}</span>, based on the statistician's projected sales of {peso(prediction.projected)}.
        </p>
      </div>

      {/* Malamang na #1 + susunod na dalawa */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:row-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-600 dark:from-emerald-900 dark:to-emerald-800 text-white p-5">
          <div className="absolute -right-8 -top-10 w-32 h-32 rounded-full bg-white/10" aria-hidden="true" />
          <p className="relative flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-50/80">
            <Crown className="w-3.5 h-3.5" /> Likely most in-demand
          </p>
          <div className="relative mt-3 flex items-center gap-3">
            <img src={resolveImageUrl(imageOf(leader))} alt="" className="w-14 h-14 rounded-xl object-cover bg-white/20 shrink-0" />
            <p className="text-xl font-extrabold leading-tight">{leader.name}</p>
          </div>
          <div className="relative mt-4 grid grid-cols-3 gap-2 [&>div]:min-w-0">
            <div>
              <p className="text-base sm:text-lg xl:text-2xl font-extrabold leading-tight whitespace-nowrap">{pct(leader.chanceTop)}</p>
              <p className="text-[10px] text-emerald-50/80 leading-tight">chance of #1</p>
            </div>
            <div>
              <p className="text-base sm:text-lg xl:text-2xl font-extrabold leading-tight whitespace-nowrap">~{leader.expectedUnits.toLocaleString()}</p>
              <p className="text-[10px] text-emerald-50/80 leading-tight">units expected</p>
            </div>
            <div>
              <p className="text-base sm:text-lg xl:text-2xl font-extrabold leading-tight whitespace-nowrap">{peso(leader.expectedSales)}</p>
              <p className="text-[10px] text-emerald-50/80 leading-tight">expected sales</p>
            </div>
          </div>
        </div>
        {runnersUp.slice(0, 2).map((r, i) => (
          <div key={r.name} className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
            <span className="text-sm font-extrabold text-amber-600 w-6 text-center">#{i + 2}</span>
            <img src={resolveImageUrl(imageOf(r))} alt="" className="w-11 h-11 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{r.name}</p>
              <p className="text-[11px] text-slate-400">~{r.expectedUnits.toLocaleString()} units · {peso(r.expectedSales)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">{pct(r.chanceTop)}</p>
              <p className="text-[10px] text-slate-400">chance of #1</p>
            </div>
          </div>
        ))}
      </div>

      {/* Inaasahang demand bawat produkto */}
      <MobileScrollHint />
      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <th className="px-2 py-2.5">Product</th>
              <th className="px-2 py-2.5 text-right">Expected units</th>
              <th className="px-2 py-2.5 text-right">Expected sales</th>
              <th className="px-2 py-2.5 w-40">Chance of #1</th>
              <th className="px-2 py-2.5">Trend</th>
              <th className="px-2 py-2.5">Stock lasts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {visible.map((r) => {
              const trend = TREND[r.trend];
              const TrendIcon = trend.icon;
              return (
                <tr key={r.name}>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <img src={resolveImageUrl(imageOf(r))} alt="" className="w-8 h-8 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums font-bold text-slate-900 dark:text-white">~{r.expectedUnits.toLocaleString()}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">{peso(r.expectedSales)}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500" style={{ width: `${(r.chanceTop / maxChance) * 100}%` }} />
                      </div>
                      <span className="w-9 text-right text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">{pct(r.chanceTop)}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${trend.className}`}>
                      <TrendIcon className="w-3 h-3" />
                      {r.trend}{(r.trend === 'Rising' || r.trend === 'Declining') && ` ${r.change >= 0 ? '+' : '−'}${Math.abs(Math.round(r.change * 100))}%`}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 whitespace-nowrap"><StockCover row={r} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {byDemand.length > PREVIEW_ROWS && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
        >
          {showAll ? `Show top ${PREVIEW_ROWS} only` : `Show all ${byDemand.length} products`}
        </button>
      )}
      <p className="text-[11px] text-slate-400 leading-relaxed">
        How it is computed: each product's share of past sales × the statistician's projected sales. Chance of #1 = how often the product sold the most units
        in {prediction.basisPeriods} past {unit}s. Trend compares recent {unit}s with the average. All Coconut Husk Pole sizes count as one product.
      </p>
    </div>
  );
}
