import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { Lightbulb, LineChart as LineChartIcon, Layers, AlertTriangle, TrendingUp, TrendingDown, History, ShoppingBag, PhilippinePeso, X, BarChart3 } from 'lucide-react';
import { MONTH_LABELS } from '../utils/dateBuckets';
import { buildSalesForecast, buildWeeklySales, buildYearlySales, weekStart, monthIndex, ANALYTICS_ORDER_STATUSES, monthFromIndex, backtestLinearMape, linearModelForecast, weeklyModelForecast, yearlyModelForecast } from './forecast';
import { STATISTICIAN_MONTHLY_SALES_MODEL, STATISTICIAN_WEEKLY_SALES_MODEL, STATISTICIAN_YEARLY_SALES_MODEL, STATISTICIAN_RESULTS, STATISTICIAN_DATASET,
  STATISTICIAN_MONTHLY_ORDERS_MODEL, STATISTICIAN_WEEKLY_ORDERS_MODEL, STATISTICIAN_YEARLY_ORDERS_MODEL } from './model';
import { Card } from '../components/CoopInsights';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import { analyticsOrders, buildProductPerformance, predictProductPerformance, performanceName, toProductPredictions } from './productPerformance';
import ProductForecast from './ProductForecast';
import OrdersForecast from './OrdersForecast';
import BusiestOrderingDays from '../components/BusiestOrderingDays';

const PALETTE = {
  light: { grid: '#e2e8f0', axis: '#94a3b8', tooltipBg: '#ffffff', tooltipBorder: '#e2e8f0', tooltipText: '#0f172a', actual: '#2f6f4b', forecast: '#d97706', band: '#f59e0b', up: '#2f6f4b', down: '#d97706', muted: '#cbd5e1' },
  dark: { grid: '#334155', axis: '#64748b', tooltipBg: '#0f172a', tooltipBorder: '#334155', tooltipText: '#f1f5f9', actual: '#43895e', forecast: '#fbbf24', band: '#fbbf24', up: '#43895e', down: '#dd6b20', muted: '#475569' },
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Ilang nakaraang bahagi at ilang hula ang ipinapakita sa chart, bawat period
const PERIODS = {
  weekly: { label: 'Weekly', unit: 'week', adjective: 'weekly', next: 'This week', shown: 26, horizon: 8 },
  monthly: { label: 'Monthly', unit: 'month', adjective: 'monthly', next: 'This month', shown: 24, horizon: 6 },
  yearly: { label: 'Yearly', unit: 'year', adjective: 'yearly', next: 'This year', shown: 10, horizon: 2 },
};

const peso = (n) => `₱${Math.round(n).toLocaleString()}`;
const shortLabel = (i) => {
  const { year, month } = monthFromIndex(i);
  return `${MONTH_LABELS[month]} ${String(year).slice(2)}`;
};
const longLabel = (i) => {
  const { year, month } = monthFromIndex(i);
  return `${MONTH_NAMES[month]} ${year}`;
};
const weekDate = (d, opts = { month: 'short', day: 'numeric' }) => d.toLocaleDateString('en-PH', opts);
const addWeeks = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n * 7);
// Huling araw ng sales history na sinuri ng statistician
const DATASET_END = new Date(`${STATISTICIAN_DATASET.to}T00:00`);
// [PREDICTIVE ANALYTICS] Accuracy ng yearly model: hula vs aktwal sa mga buong taon ng sales history
// (hindi kasama ang unang taon at ang taon ng huling datos, dahil kulang ang buwan nila)
function yearlyFitMape(model, values, firstYear) {
  const lastYear = DATASET_END.getFullYear();
  const errors = values
    .map((value, i) => ({ value, year: firstYear + i }))
    .filter(({ value, year }) => year > firstYear && year < lastYear && value > 0)
    .map(({ value, year }) => Math.abs(value - (model.constant + model.slope * year)) / value);
  return errors.length ? errors.reduce((s, e) => s + e, 0) / errors.length : null;
}
const listNames = (items) => (items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

export default function SalesForecast({ orders: allOrders = [], products = [], isDarkMode, children }) {
  // [ANALYTICS] Sales history ng statistician hanggang Aug 31, 2026 + mga bagong benta pagkatapos nito
  const orders = useMemo(() => analyticsOrders(allOrders), [allOrders]);
  const palette = PALETTE[isDarkMode ? 'dark' : 'light'];
  const [period, setPeriod] = useState('monthly');

  const result = useMemo(() => buildSalesForecast(orders, products, { seasonality: false }), [orders, products]);
  const weekly = useMemo(() => buildWeeklySales(orders), [orders]);
  const yearly = useMemo(() => buildYearlySales(orders), [orders]);
  const [showSalesBreakdown, setShowSalesBreakdown] = useState(false);
  const salesBreakdown = useMemo(() => buildSalesBreakdown(orders, products), [orders, products]);
  const pendingOrderCount = orders.filter((o) => o.status === 'Pending Verification').length;

  if (!result || result.history.length < 12) {
    return (
      <div className="space-y-6 text-left">
        <Header />
        <p className="text-sm text-slate-500">Not enough sales history yet - the forecast needs at least 12 months of recorded sales.</p>
      </div>
    );
  }

  const { firstMonth, forecastStart, history } = result;
  // [PREDICTIVE ANALYTICS] Hula ng benta = Monthly Linear Regression ng statistician;
  // ang accuracy ay sinusubok ng system sa parehong paraan gamit ang kasalukuyang data
  const forecast = linearModelForecast(STATISTICIAN_MONTHLY_SALES_MODEL, forecastStart, 6);
  const monthlyResult = STATISTICIAN_RESULTS.find((r) => r.level === 'Monthly' && r.measure.startsWith('Product'));

  // [PREDICTIVE ANALYTICS] Ang napiling period (Monthly/Weekly): kasaysayan, hula ng statistician,
  // at accuracy na sinubok ng system sa huling 6 na bahagi
  const activePeriod = period === 'weekly' && weekly && weekly.history.length >= 18 ? 'weekly'
    : period === 'yearly' && yearly && yearly.history.length >= 2 ? 'yearly'
    : 'monthly';
  const config = PERIODS[activePeriod];
  const equationText = (model, unit) => `Sales = ${model.constant.toLocaleString()} ${model.slope < 0 ? '−' : '+'} ${Math.abs(model.slope).toLocaleString(undefined, { maximumFractionDigits: 2 })} × ${unit}`;
  const ordersEquationText = (model, unit) => `Orders = ${model.constant.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${model.slope < 0 ? '−' : '+'} ${Math.abs(model.slope).toLocaleString(undefined, { maximumFractionDigits: 4 })} × ${unit}`;
  const view = {
    weekly: () => ({
      history: weekly.history,
      forecast: weeklyModelForecast(STATISTICIAN_WEEKLY_SALES_MODEL, weekly.firstWeek, weekly.history.length, config.horizon),
      // Sinusubok ang accuracy sa sales history ng statistician (kumpleto ang datos hanggang Aug 2026)
      testLength: Math.round((weekStart(DATASET_END) - weekly.firstWeek) / (7 * 86400000)),
      mape: backtestLinearMape(weekly.history.slice(0, Math.round((weekStart(DATASET_END) - weekly.firstWeek) / (7 * 86400000)))),
      ordersForecast: weeklyModelForecast(STATISTICIAN_WEEKLY_ORDERS_MODEL, weekly.firstWeek, weekly.history.length, config.horizon),
      ordersEquation: ordersEquationText(STATISTICIAN_WEEKLY_ORDERS_MODEL, 'week no.'),
      label: (i) => weekDate(addWeeks(weekly.firstWeek, i)),
      longName: (i) => `week of ${weekDate(addWeeks(weekly.firstWeek, i), { month: 'long', day: 'numeric', year: 'numeric' })}`,
      equation: equationText(STATISTICIAN_WEEKLY_SALES_MODEL, 'week no.'),
      indexOf: (d) => Math.round((weekStart(d) - weekly.firstWeek) / (7 * 86400000)),
      targetIndex: Math.round((weekStart(new Date(STATISTICIAN_WEEKLY_SALES_MODEL.predicts)) - addWeeks(weekly.firstWeek, weekly.history.length)) / (7 * 86400000)),
    }),
    monthly: () => ({
      history,
      forecast: linearModelForecast(STATISTICIAN_MONTHLY_SALES_MODEL, forecastStart, config.horizon),
      testLength: monthIndex(DATASET_END) - firstMonth + 1,
      mape: backtestLinearMape(history.slice(0, monthIndex(DATASET_END) - firstMonth + 1)),
      ordersForecast: linearModelForecast(STATISTICIAN_MONTHLY_ORDERS_MODEL, forecastStart, config.horizon),
      ordersEquation: ordersEquationText(STATISTICIAN_MONTHLY_ORDERS_MODEL, 'month no.'),
      label: (i) => shortLabel(firstMonth + i),
      longName: (i) => longLabel(firstMonth + i),
      equation: equationText(STATISTICIAN_MONTHLY_SALES_MODEL, 'month no.'),
      indexOf: (d) => monthIndex(d) - firstMonth,
      targetIndex: STATISTICIAN_MONTHLY_SALES_MODEL.predicts.year * 12 + STATISTICIAN_MONTHLY_SALES_MODEL.predicts.month - forecastStart,
    }),
    // Taunan: masyadong kaunti ang taon para masubok ang accuracy, kaya babala ang ipinapakita
    yearly: () => ({
      history: yearly.history,
      forecast: yearlyModelForecast(STATISTICIAN_YEARLY_SALES_MODEL, yearly.firstYear + yearly.history.length, config.horizon),
      mape: yearlyFitMape(STATISTICIAN_YEARLY_SALES_MODEL, yearly.history, yearly.firstYear),
      accuracyNote: `on the complete years ${yearly.firstYear + 1}–${DATASET_END.getFullYear() - 1}`,
      testLength: null,
      ordersForecast: yearlyModelForecast(STATISTICIAN_YEARLY_ORDERS_MODEL, yearly.firstYear + yearly.history.length, config.horizon),
      ordersEquation: ordersEquationText(STATISTICIAN_YEARLY_ORDERS_MODEL, 'year'),
      label: (i) => String(yearly.firstYear + i),
      longName: (i) => (yearly.firstYear + i === new Date().getFullYear() ? `${yearly.firstYear + i} (in progress)` : String(yearly.firstYear + i)),
      equation: equationText(STATISTICIAN_YEARLY_SALES_MODEL, 'year'),
      indexOf: (d) => d.getFullYear() - yearly.firstYear,
      targetIndex: STATISTICIAN_YEARLY_SALES_MODEL.predicts - (yearly.firstYear + yearly.history.length),
      caution: `Use with caution: ${yearly.firstYear} has only ${12 - new Date(Math.min(...orders.map((o) => new Date(o.orderedAt).getTime()))).getMonth()} months of data, which makes the yearly trend look stronger than it is. The statistician found it not significant (p = ${STATISTICIAN_RESULTS[0].p}).`,
    }),
  }[activePeriod]();
  const lastIndex = view.history.length - 1;
  // Ang Projected Sales ay ang mismong period na hinulaan ng statistician; kung lampas na, ang susunod na period
  const projectedIndex = view.targetIndex >= 0 && view.targetIndex < view.forecast.length ? view.targetIndex : 0;
  const projected = view.forecast[projectedIndex];
  const previous = view.history[lastIndex];
  const expectedChange = previous > 0 ? (projected - previous) / previous : null;
  const mape = view.mape;
  const historyAt = (i) => history[i - firstMonth];

  // [PREDICTIVE ANALYTICS] Susunod na 3 buwan vs parehong 3 buwan noong nakaraang taon
  const next3 = forecast.slice(0, 3).reduce((s, v) => s + v, 0);
  const sameMonthsLastYear = [0, 1, 2].map((h) => historyAt(forecastStart + h - 12));
  const lastYear3 = sameMonthsLastYear.every((v) => v !== undefined) ? sameMonthsLastYear.reduce((s, v) => s + v, 0) : null;
  const vsLastYear = lastYear3 ? (next3 - lastYear3) / lastYear3 : null;
  const accuracy = mape === null ? null : Math.max(0, 1 - mape);
  const monthlyForecast = forecast;

  // Chart: huling 24 na buwan na aktwal + forecast; ang band = forecast ± karaniwang error (MAPE)
  // [ANALYTICS] Bilang ng order at products sold bawat period (kapareho ng mga order na binibilang sa revenue)
  const periodOrders = Array(view.history.length).fill(0);
  const periodUnits = Array(view.history.length).fill(0);
  orders.filter((o) => ANALYTICS_ORDER_STATUSES.includes(o.status)).forEach((o) => {
    const i = view.indexOf(new Date(o.orderedAt));
    if (i < 0 || i >= view.history.length) return;
    periodOrders[i]++;
    periodUnits[i] += (o.items || []).reduce((s, item) => s + item.quantity, 0);
  });
  const windowStart = Math.max(0, view.history.length - config.shown);
  const sumFrom = (arr) => arr.slice(windowStart).reduce((s, v) => s + v, 0);
  const trendSummary = {
    orders: sumFrom(periodOrders),
    units: sumFrom(periodUnits),
    revenue: sumFrom(view.history),
    range: activePeriod === 'weekly'
      ? `Weeks of ${view.label(windowStart)} – ${view.label(lastIndex)}`
      : `${view.longName(windowStart)} – ${view.longName(lastIndex)}`,
  };
  const chartData = buildChartData(view.history, view.forecast, view.label, config.shown, mape, { orders: periodOrders, units: periodUnits });
  const forecastLabels = view.forecast.map((_, h) => view.label(view.history.length + h));

  // [PREDICTIVE ANALYTICS] Customer Purchase Pattern: hula sa bilang ng orders (orders regression ng statistician),
  // para sa parehong period ng Projected Sales; accuracy = parehong backtest sa sales history
  const projectedOrders = view.ordersForecast[projectedIndex];
  const previousOrders = periodOrders[lastIndex];
  const ordersMape = activePeriod === 'yearly'
    ? yearlyFitMape(STATISTICIAN_YEARLY_ORDERS_MODEL, periodOrders, yearly.firstYear)
    : backtestLinearMape(periodOrders.slice(0, view.testLength));
  const accuracyNote = view.accuracyNote || `on the last 6 ${config.unit}s of the sales history`;
  const ordersAccuracy = ordersMape === null ? null : Math.max(0, 1 - ordersMape);
  const ordersResult = STATISTICIAN_RESULTS.find((r) => r.level === config.label && r.measure.startsWith('Customer'));
  const ordersChart = [
    ...periodOrders.slice(windowStart).map((value, i) => ({ label: view.label(windowStart + i), actual: value })),
    ...view.ordersForecast.map((value, h) => ({ label: view.label(view.history.length + h), forecast: value, isForecast: true })),
  ];
  // Ikinokonekta ang forecast line sa huling aktwal na punto
  if (periodOrders.length > 0) ordersChart[periodOrders.length - 1 - windowStart].forecast = previousOrders;

  // [PREDICTIVE ANALYTICS] Hula sa bawat produkto para sa period na hinulaan (Projected Sales)
  const productById = new Map(products.map((p) => [p.id, p]));
  const stockByName = new Map();
  products.forEach((p) => {
    const name = performanceName(p.name);
    stockByName.set(name, (stockByName.get(name) || 0) + p.stock);
  });
  // Ang Projected Sales (regression ng statistician mula sa Google Colab) ang hinahati bawat produkto
  const performance = buildProductPerformance(orders, activePeriod);
  const prediction = predictProductPerformance(performance, projected, stockByName);
  const projectedLabel = view.longName(view.history.length + projectedIndex).replace(/^week of /, 'Week of ');
  const periodName = { weekly: 'This Week', monthly: 'This Month', yearly: 'Next Year' }[activePeriod];
  const predictions = toProductPredictions(prediction, periodName);
  const imageOf = (row) => row.productIds.map((id) => productById.get(id)?.image).find(Boolean);

  // [PREDICTIVE ANALYTICS] Actual vs Predicted: kapag tapos na ang forecast period at kumpleto ang naitalang benta
  const targetPeriod = performance?.periods[view.history.length + projectedIndex];
  const comparison = (() => {
    if (!prediction) return null;
    if (!targetPeriod || targetPeriod.inProgress) {
      return { available: false, message: `Actual vs Predicted sales will appear here after ${projectedLabel} ends. New orders and walk-in sales are counted as soon as they are recorded.` };
    }
    const rows = predictions.map((r) => {
      const actual = targetPeriod.qty.get(r.productName) || 0;
      return { productName: r.productName, predicted: r.predictedDemand, actual, error: Math.abs(actual - r.predictedDemand) };
    });
    return { available: true, rows, meanError: rows.reduce((t, r) => t + r.error, 0) / (rows.length || 1) };
  })();
  const method = prediction
    ? `Source: the statistician's ${config.adjective} linear regression projects ${peso(projected)} in sales for ${projectedLabel}. Predicted demand = each product's usual units per ${config.unit} from ${prediction.basisPeriods} past ${config.unit}s, scaled to that projection. Demand level compares a product with the average predicted demand (High ≥ 1.5×, Low < 0.5×). Restock Recommended = current stock is below the predicted demand. These are forecasts, not guaranteed sales. All Coconut Husk Pole sizes count as one product.`
    : '';
  const categoryOf = (row) => row.productIds.map((id) => productById.get(id)?.category).find(Boolean) || 'Other';

  const categoryForecast = Object.values(
    (prediction?.rows || []).reduce((acc, r) => {
      const key = categoryOf(r);
      acc[key] = acc[key] || { category: key, revenue: 0 };
      acc[key].revenue += r.expectedSales;
      return acc;
    }, {})
  ).sort((a, b) => b.revenue - a.revenue);
  const categoryTotal = categoryForecast.reduce((s, c) => s + c.revenue, 0);

  const predicted = prediction?.rows || [];
  const rising = predicted.filter((r) => r.trend === 'Rising').sort((a, b) => b.change - a.change);
  const declining = predicted.filter((r) => r.trend === 'Declining').sort((a, b) => a.change - b.change);
  const restockNow = predictions.filter((r) => r.restockStatus === 'Restock').map((r) => ({ name: r.productName }));

  // [ANALYTICS] Mga rekomendasyon mula sa forecast
  const takeaways = [];
  if (predictions.length > 0) {
    const top = predictions[0];
    takeaways.push(`${top.productName} has the highest predicted demand for ${projectedLabel}: about ${top.predictedDemand.toLocaleString()} units.`);
  }
  takeaways.push(
    `Expected sales for ${MONTH_NAMES[forecastStart % 12]} to ${longLabel(forecastStart + 2)}: about ${peso(next3)}` +
    (vsLastYear === null ? '.'
      : Math.round(vsLastYear * 100) === 0 ? ', about the same as the same months last year.'
      : `, ${vsLastYear >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(vsLastYear * 100))}% from the same months last year.`)
  );
  takeaways.push(`The statistician's monthly regression shows sales are basically flat (${monthlyResult.slope}, not significant), so plan for about ${peso(monthlyForecast[0])} a month.`);
  takeaways.push(`Expect about ${Math.round(projectedOrders).toLocaleString()} orders for ${projectedLabel}, about ${peso(projectedOrders > 0 ? projected / projectedOrders : 0)} per order.`);
  if (restockNow.length > 0) {
    takeaways.push(`${listNames(restockNow.slice(0, 4).map((p) => p.name))}: current stock is below the predicted demand for ${projectedLabel}. Restock recommended.`);
  }
  if (rising.length > 0) {
    takeaways.push(`Demand is rising for ${listNames(rising.slice(0, 4).map((p) => p.name))}. Make sure supply keeps up.`);
  }
  if (declining.length > 0) {
    takeaways.push(`Demand is dropping for ${listNames(declining.slice(0, 4).map((p) => p.name))}. Consider a promo, a bundle, or producing less.`);
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-600 dark:from-emerald-900 dark:to-emerald-800 p-6 sm:p-7 text-left text-white shadow-sm">
        <div className="absolute -right-10 -top-12 w-48 h-48 rounded-full bg-white/5" aria-hidden="true" />
        <div className="absolute right-24 -bottom-16 w-40 h-40 rounded-full bg-white/5" aria-hidden="true" />
        <div className="relative flex flex-col lg:flex-row lg:items-end gap-5">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/15 text-[11px] font-semibold"><BarChart3 className="w-3.5 h-3.5" /> Forecasting</span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/15 text-[11px] font-semibold"><TrendingUp className="w-3.5 h-3.5" /> Linear Regression</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Analytics Forecast</h2>
            <p className="text-sm text-emerald-50/85">Sales projection and restock urgency based on historical sales.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <div className="flex rounded-xl bg-white/10 p-1" role="group" aria-label="Forecast period">
              {Object.entries(PERIODS).map(([key, p]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPeriod(key)}
                  aria-pressed={activePeriod === key}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    activePeriod === key ? 'bg-white text-emerald-800 shadow-sm' : 'text-white/85 hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <ForecastTile
          icon={ShoppingBag}
          tone="sky"
          label="Total Orders"
          value={orders.length.toLocaleString()}
          sub={`${pendingOrderCount} pending verification`}
        />
        <ForecastTile
          icon={TrendingUp}
          tone="emerald"
          label="Projected Sales"
          value={peso(projected)}
          sub={`${projectedIndex === 0 ? config.next : "Statistician's prediction"}: ${view.longName(view.history.length + projectedIndex)}`}
        />
        <ForecastTile
          icon={History}
          tone="sky"
          label="Previous Period"
          value={peso(previous)}
          sub={`Actual sales, ${view.longName(lastIndex)}`}
        />
        <ForecastTile
          icon={expectedChange !== null && expectedChange < 0 ? TrendingDown : TrendingUp}
          tone={expectedChange !== null && expectedChange < 0 ? 'rose' : 'emerald'}
          label="Expected Change"
          value={expectedChange === null ? '—' : `${expectedChange >= 0 ? '+' : '−'}${Math.abs(expectedChange * 100).toFixed(1)}%`}
          sub="Projected vs previous period"
        />
        <ForecastTile
          icon={PhilippinePeso}
          tone="amber"
          label="Total Sales"
          value={peso(salesBreakdown.totalSales)}
          sub="Click to see sales by product"
          onClick={() => setShowSalesBreakdown(true)}
        />
      </div>

      {showSalesBreakdown && (
        <SalesBreakdownModal orders={orders} products={products} onClose={() => setShowSalesBreakdown(false)} />
      )}

      <Card
        icon={LineChartIcon}
        title="Projected Sales Trend"
        description={`Actual ${config.adjective} sales and the statistician's ${config.adjective} linear regression forecast (${view.equation}).${accuracy === null ? '' : ` Tested accuracy: ${Math.round(accuracy * 100)}% ${view.accuracyNote || `on the last 6 ${config.unit}s of the sales history`}.`}${view.caution ? ` ${view.caution}` : ''}`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Orders', value: trendSummary.orders.toLocaleString() },
            { label: 'Products Sold', value: `${trendSummary.units.toLocaleString()} units` },
            { label: 'Total Revenue', value: peso(trendSummary.revenue) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white whitespace-nowrap">{item.value}</p>
              <p className="text-[11px] text-slate-400 truncate">{trendSummary.range}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {view.forecast.map((value, h) => (
            <span key={h} className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-[10.5px] font-semibold text-amber-800 dark:text-amber-300 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {forecastLabels[h]}: {peso(value)}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ background: palette.actual }} /> Actual</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded border-t-2 border-dashed" style={{ borderColor: palette.forecast }} /> Forecast</span>
          {mape !== null && <span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm opacity-25" style={{ background: palette.band }} /> Likely range</span>}
        </div>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: palette.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
              <YAxis tick={{ fontSize: 11, fill: palette.axis }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => (v >= 1000 ? `₱${(v / 1000).toFixed(0)}k` : `₱${v}`)} />
              <Tooltip
                content={<ChartTooltip render={(p) => {
                  const row = p[0].payload;
                  return (
                    <>
                      {row.actual !== undefined && <p>Revenue: {peso(row.actual)}</p>}
                      {row.orders !== undefined && <p className="opacity-80">Orders: {row.orders.toLocaleString()}</p>}
                      {row.units !== undefined && <p className="opacity-80">Products sold: {row.units.toLocaleString()} units</p>}
                      {row.isForecast && <p>Forecast: {peso(row.forecast)}</p>}
                      {row.isForecast && row.range && <p className="opacity-70">Likely {peso(row.range[0])} – {peso(row.range[1])}</p>}
                    </>
                  );
                }} />}
              />
              <ReferenceArea
                x1={forecastLabels[0]}
                x2={forecastLabels[forecastLabels.length - 1]}
                fill={palette.band}
                fillOpacity={0.08}
                label={{ value: 'FORECAST', position: 'insideTop', fill: palette.forecast, fontSize: 10, fontWeight: 700 }}
              />
              <ReferenceLine x={view.label(lastIndex)} stroke={palette.axis} strokeDasharray="2 4" />
              <Area dataKey="range" stroke="none" fill={palette.band} fillOpacity={0.18} isAnimationActive={false} />
              <Line dataKey="actual" stroke={palette.actual} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line dataKey="forecast" stroke={palette.forecast} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <ProductForecast predictions={predictions} periodName={periodName} periodLabel={projectedLabel} projectedSales={projected} imageOf={imageOf} isDarkMode={isDarkMode} comparison={comparison} method={method} />

      <OrdersForecast
        periodName={periodName}
        periodLabel={projectedLabel}
        unit={config.unit}
        projectedOrders={projectedOrders}
        previousOrders={previousOrders}
        previousLabel={view.longName(lastIndex)}
        projectedSales={projected}
        previousSales={previous}
        accuracy={ordersAccuracy}
        accuracyNote={accuracyNote}
        result={ordersResult}
        equation={view.ordersEquation}
        chartData={ordersChart}
        isDarkMode={isDarkMode}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card icon={Layers} title="Expected Demand by Category" description={`Share of the projected sales for ${projectedLabel}, by product category.`}>
          {categoryTotal === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">No product sales to forecast yet.</p>
          ) : (
            <div className="space-y-4 pt-1">
              {categoryForecast.map((c) => (
                <div key={c.category} className="space-y-1.5">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{c.category}</span>
                    <span className="text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">{peso(c.revenue)} · {Math.round((c.revenue / categoryTotal) * 100)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(c.revenue / categoryTotal) * 100}%`, background: palette.actual }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <BusiestOrderingDays orders={orders} isDarkMode={isDarkMode} />
      </div>

      <div className="bg-[#FDFCF7] dark:bg-emerald-950/25 border border-emerald-100 dark:border-slate-800 rounded-2xl p-6 text-left space-y-3">
        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" /> What the Forecast Suggests
        </h3>
        <ul className="space-y-2">
          {takeaways.map((t, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      {children}
    </div>
  );
}

const TILE_TONES = {
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300',
};

function ForecastTile({ icon: Icon, tone, label, value, sub, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick } : {})}
      className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-4 2xl:p-5 text-left flex flex-col gap-1 min-w-0 w-full ${
        onClick ? 'cursor-pointer transition hover:border-emerald-300 hover:shadow-md dark:hover:border-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold leading-snug text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TILE_TONES[tone]}`}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <p className="text-xl 2xl:text-2xl font-extrabold text-slate-900 dark:text-white whitespace-nowrap">{value}</p>
      <p className={`text-[11px] ${onClick ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`}>{sub}</p>
    </Tag>
  );
}

// [ANALYTICS] Total Sales na hinati bawat category, at sa loob nito bawat product (pinakamalaki muna)
const REALIZED = (o) => o.status !== 'Rejected' && o.status !== 'Cancelled';

// [ANALYTICS] Benta ng mga product na nasa catalog lang, hinati bawat category at product (pinakamalaki muna).
// Hindi kasama ang mga product na wala na sa catalog (lumang demo/test orders) at ang shipping fee,
// kaya ang Total Sales ay eksaktong kabuuan ng mga nakalistang product.
function buildSalesBreakdown(orders, products, inPeriod = () => true) {
  const productById = new Map(products.map((p) => [p.id, p]));
  const categories = new Map();
  let totalSales = 0;
  let orderCount = 0;
  orders.filter((o) => REALIZED(o) && inPeriod(new Date(o.orderedAt))).forEach((o) => {
    let counted = false;
    (o.items || []).forEach((item) => {
      const product = productById.get(item.productId);
      if (!product) return;
      counted = true;
      const amount = item.price * item.quantity;
      totalSales += amount;
      if (!categories.has(product.category)) categories.set(product.category, { category: product.category, total: 0, products: new Map() });
      const group = categories.get(product.category);
      group.total += amount;
      const row = group.products.get(product.id) || { id: product.id, name: product.name.trim(), unit: product.unit?.trim() || '', image: product.image, quantity: 0, total: 0 };
      row.quantity += item.quantity;
      row.total += amount;
      group.products.set(product.id, row);
    });
    if (counted) orderCount++;
  });
  return {
    totalSales,
    orderCount,
    categories: [...categories.values()]
      .map((c) => ({ ...c, products: [...c.products.values()].sort((a, b) => b.total - a.total) }))
      .sort((a, b) => b.total - a.total),
  };
}

// [ANALYTICS] Bawat benta (isang linya bawat produkto sa order), pinakabago muna - parehong mga item na
// binibilang sa Total Sales (catalog products lang, walang shipping fee)
const RECORD_PAGE = 50;
function buildSaleRecords(orders, products, inPeriod = () => true) {
  const productById = new Map(products.map((p) => [p.id, p]));
  const records = [];
  orders.filter((o) => REALIZED(o) && inPeriod(new Date(o.orderedAt))).forEach((o) => {
    (o.items || []).forEach((item, i) => {
      const product = productById.get(item.productId);
      if (!product) return;
      records.push({
        key: `${o.id}-${i}`,
        orderId: o.id,
        date: new Date(o.orderedAt),
        productName: product.name.trim(),
        category: product.category,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
        channel: o.channel || (o.id.startsWith('HIST-') ? 'walk-in' : 'online'),
      });
    });
  });
  return records.sort((a, b) => b.date - a.date || b.key.localeCompare(a.key));
}

// Mga pagpipiliang linggo / buwan / taon (pinakabago muna), mula sa mga petsa ng benta
const BREAKDOWN_PERIODS = [
  { key: 'all', label: 'All time' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
];
function periodOptions(orders, period) {
  const seen = new Map();
  orders.filter(REALIZED).forEach((o) => {
    const d = new Date(o.orderedAt);
    let key;
    let option;
    if (period === 'yearly') {
      key = String(d.getFullYear());
      option = () => ({ key, label: key, from: new Date(d.getFullYear(), 0, 1), to: new Date(d.getFullYear() + 1, 0, 1) });
    } else if (period === 'monthly') {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      option = () => ({ key, label: d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }), from: new Date(d.getFullYear(), d.getMonth(), 1), to: new Date(d.getFullYear(), d.getMonth() + 1, 1) });
    } else {
      const start = weekStart(d);
      key = start.toISOString();
      option = () => {
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
        return { key, label: `${weekDate(start)} – ${weekDate(end, { month: 'short', day: 'numeric', year: 'numeric' })}`, from: start, to: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) };
      };
    }
    if (!seen.has(key)) seen.set(key, option());
  });
  return [...seen.values()].sort((a, b) => b.from - a.from);
}

// Kulay ng bawat category sa bar, legend at mga tuldok
const CATEGORY_STYLES = {
  Fertilizer: { color: '#2f6f4b', soft: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
  Handicraft: { color: '#d97706', soft: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  Charcoal: { color: '#334155', soft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  'Fibre & Coir': { color: '#8b5e3c', soft: 'bg-orange-50 text-orange-900 dark:bg-orange-950/40 dark:text-orange-300' },
  Other: { color: '#94a3b8', soft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};
const categoryStyle = (c) => CATEGORY_STYLES[c] || CATEGORY_STYLES.Other;
const pctLabel = (value, digits = 0) => (value > 0 && value < 1 ? '<1%' : `${value.toFixed(digits)}%`);

function SalesBreakdownModal({ orders, products, onClose }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [period, setPeriod] = useState('all');
  const options = useMemo(() => (period === 'all' ? [] : periodOptions(orders, period)), [orders, period]);
  const [selectedKey, setSelectedKey] = useState(null);
  const selected = options.find((o) => o.key === selectedKey) || options[0];
  const [view, setView] = useState('products');
  const [recordLimit, setRecordLimit] = useState(RECORD_PAGE);
  const records = useMemo(
    () => buildSaleRecords(orders, products, selected ? (d) => d >= selected.from && d < selected.to : undefined),
    [orders, products, selected]
  );
  useEffect(() => { setRecordLimit(RECORD_PAGE); }, [selected, activeCategory, view]);
  const breakdown = useMemo(
    () => buildSalesBreakdown(orders, products, selected ? (d) => d >= selected.from && d < selected.to : undefined),
    [orders, products, selected]
  );
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const { totalSales, orderCount, categories } = breakdown;
  const share = (amount) => (totalSales > 0 ? (amount / totalSales) * 100 : 0);
  const visible = activeCategory === 'all' ? categories : categories.filter((c) => c.category === activeCategory);
  const unitsSold = categories.reduce((s, c) => s + c.products.reduce((t, p) => t + p.quantity, 0), 0);
  const productCount = categories.reduce((s, c) => s + c.products.length, 0);
  const visibleRecords = activeCategory === 'all' ? records : records.filter((r) => r.category === activeCategory);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-breakdown-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden bg-[#faf8f4] dark:bg-slate-950 rounded-3xl shadow-2xl text-left"
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-emerald-700 to-emerald-600 dark:from-emerald-900 dark:to-emerald-800 text-white px-5 sm:px-6 pt-5 pb-5">
          <div className="absolute -right-12 -top-16 w-48 h-48 rounded-full bg-white/5" aria-hidden="true" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-50/80">
                <PhilippinePeso className="w-3.5 h-3.5" /> Sales Breakdown
              </p>
              <h3 id="sales-breakdown-title" className="text-xl sm:text-2xl font-extrabold mt-1">Total Sales by Product</h3>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2 rounded-xl text-white/80 hover:bg-white/10 hover:text-white cursor-pointer transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative mt-4 grid grid-cols-3 gap-3">
            {[
              { label: selected ? `Sales · ${selected.label}` : 'Total sales', value: peso(totalSales) },
              { label: 'Orders', value: orderCount.toLocaleString() },
              { label: 'Units sold', value: unitsSold.toLocaleString() },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-white/10 px-2.5 sm:px-3 py-2.5 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-50/75">{s.label}</p>
                <p className="text-sm sm:text-xl font-extrabold whitespace-nowrap">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Category share bar + filters */}
        <div className="shrink-0 px-5 sm:px-6 pt-4 pb-4 space-y-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1" role="group" aria-label="Sales period">
              {BREAKDOWN_PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => { setPeriod(p.key); setSelectedKey(null); setActiveCategory('all'); }}
                  aria-pressed={period === p.key}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap ${
                    period === p.key ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-950 dark:text-emerald-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {options.length > 0 && (
              <select
                value={selected?.key}
                onChange={(e) => { setSelectedKey(e.target.value); setActiveCategory('all'); }}
                aria-label="Choose period"
                className="sm:ml-auto px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            )}
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
            {categories.map((c) => (
              <div key={c.category} style={{ width: `${share(c.total)}%`, background: categoryStyle(c.category).color }} title={`${c.category}: ${share(c.total).toFixed(1)}%`} />
            ))}
          </div>
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 w-full sm:w-auto sm:inline-flex" role="group" aria-label="Show">
            {[{ key: 'products', label: 'By Product' }, { key: 'records', label: `All Records (${visibleRecords.length.toLocaleString()})` }].map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                aria-pressed={view === v.key}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap ${
                  view === v.key ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-950 dark:text-emerald-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            {[{ category: 'all', total: totalSales, products: { length: productCount } }, ...categories].map((c) => {
              const active = activeCategory === c.category;
              const isAll = c.category === 'all';
              return (
                <button
                  key={c.category}
                  type="button"
                  onClick={() => setActiveCategory(c.category)}
                  aria-pressed={active}
                  className={`flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-colors ${
                    active
                      ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {!isAll && <span className="w-2.5 h-2.5 rounded-full" style={{ background: categoryStyle(c.category).color }} />}
                  {isAll ? 'All' : c.category}
                  <span className={active ? 'opacity-70' : 'text-slate-400'}>{isAll ? '100%' : pctLabel(share(c.total))}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Products per category */}
        <div className="overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
          {view === 'records' && (
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
              {visibleRecords.length === 0 && <p className="text-sm text-slate-400 text-center py-10">No sales yet.</p>}
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleRecords.slice(0, recordLimit).map((r) => (
                  <li key={r.key} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: categoryStyle(r.category).color }} />
                    <div className="w-24 shrink-0">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{r.date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      <p className="text-[10px] font-mono text-slate-400 truncate">{r.orderId}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{r.productName}</p>
                      <p className="text-[11px] text-slate-400">{r.quantity.toLocaleString()} × {peso(r.price)}{r.channel === 'walk-in' ? ' · Walk-in' : ' · Online'}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap tabular-nums">{peso(r.total)}</p>
                  </li>
                ))}
              </ul>
              {visibleRecords.length > recordLimit && (
                <button
                  type="button"
                  onClick={() => setRecordLimit((n) => n + RECORD_PAGE * 2)}
                  className="w-full py-3 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Show more ({(visibleRecords.length - recordLimit).toLocaleString()} left)
                </button>
              )}
            </section>
          )}
          {view === 'products' && visible.length === 0 && <p className="text-sm text-slate-400 text-center py-10">No sales yet.</p>}
          {view === 'products' && visible.map((c) => {
            const style = categoryStyle(c.category);
            const top = c.products[0]?.total || 1;
            return (
              <section key={c.category} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: style.color }} />
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 dark:text-white truncate">{c.category === 'Other' ? 'Other (hidden products)' : c.category}</h4>
                      <p className="text-[11px] text-slate-400">{c.products.length} product{c.products.length === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-extrabold text-slate-900 dark:text-white">{peso(c.total)}</p>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${style.soft}`}>{pctLabel(share(c.total), 1)} of sales</span>
                  </div>
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {c.products.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-5 text-xs font-bold text-slate-400 tabular-nums shrink-0">{i + 1}</span>
                      {p.image ? (
                        <img src={resolveImageUrl(p.image)} alt="" className="w-10 h-10 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0" />
                      ) : (
                        <span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100 line-clamp-2">{p.name}</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">{peso(p.total)}</p>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3">
                          <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(p.total / top) * 100}%`, background: style.color }} />
                          </div>
                          <p className="text-[11px] text-slate-400 whitespace-nowrap">{p.quantity.toLocaleString()} sold{p.unit ? ` · ${p.unit}` : ''}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <p className="text-[11px] text-slate-400 text-center">
            Product sales of items in the current catalog. Shipping fees are not included.
          </p>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="space-y-1 text-left border-b border-slate-200 dark:border-slate-800 pb-2">
      <p className="text-xs font-mono uppercase tracking-widest text-[#d97706] font-bold">PREDICTIVE ANALYTICS</p>
      <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Sales Forecast &amp; Product Demand</h2>
    </div>
  );
}

function buildChartData(history, forecast, labelOf, shown, mape, counts = {}) {
  const rows = [];
  const from = Math.max(0, history.length - shown);
  for (let t = from; t < history.length; t++) {
    rows.push({ label: labelOf(t), actual: history[t], orders: counts.orders?.[t], units: counts.units?.[t] });
  }
  // Ikonekta ang forecast line sa huling aktwal na punto
  const last = rows[rows.length - 1];
  last.forecast = last.actual;
  last.range = [last.actual, last.actual];
  forecast.forEach((value, h) => {
    const spread = mape === null ? 0 : value * mape;
    rows.push({
      label: labelOf(history.length + h),
      forecast: value,
      range: mape === null ? undefined : [Math.max(0, value - spread), value + spread],
      isForecast: true,
    });
  });
  return rows;
}
