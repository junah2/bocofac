// [PREDICTIVE ANALYTICS] Time-series forecast ng benta: Classical Decomposition
//   1. Seasonal Index bawat buwan (ratio-to-centered-moving-average)
//   2. Alisin ang season (deseasonalize), saka linear regression para sa trend
//   3. Forecast = Trend x Seasonal Index
// Accuracy: i-forecast ang huling 6 na buwan na parang hindi pa alam, ikumpara sa aktwal (MAPE)

export const REALIZED_ORDER_STATUSES = ['Completed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered'];
// [ANALYTICS] Binibilang agad sa analytics ang bawat order, pati ang hinihintay pang ma-verify;
// ang Rejected at Cancelled lang ang hindi kasama
export const ANALYTICS_ORDER_STATUSES = ['Pending Verification', ...REALIZED_ORDER_STATUSES];

const MIN_MONTHS_FOR_SEASONALITY = 24;
const BACKTEST_MONTHS = 6;
// Buwan na mas mababa sa 25% ng karaniwan = malamang hindi pa naitatala ang benta (hal. walk-in)
const TREND_THRESHOLD = 0.1;
const MAX_GROWTH = 0.5;
const MIN_UNITS_FOR_TREND = 20;

// Bilang ng buwan mula year 0 - para madaling magbilang ng buwan pasulong/paatras
export const monthIndex = (date) => date.getFullYear() * 12 + date.getMonth();
export const monthFromIndex = (i) => ({ year: Math.floor(i / 12), month: i % 12 });

const sum = (values) => values.reduce((s, v) => s + v, 0);
const mean = (values) => (values.length ? sum(values) / values.length : 0);

// Least squares: y = a + b·x
export function linearRegression(ys) {
  const n = ys.length;
  if (n === 0) return { a: 0, b: 0 };
  const xMean = (n - 1) / 2;
  const yMean = mean(ys);
  let num = 0, den = 0;
  ys.forEach((y, x) => {
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  });
  const b = den === 0 ? 0 : num / den;
  return { a: yMean - b * xMean, b };
}

// Seasonal Index bawat calendar month (Jan..Dec); 1.10 = 10% mas mataas sa karaniwan
export function seasonalIndices(values, startMonth) {
  if (values.length < MIN_MONTHS_FOR_SEASONALITY) return Array(12).fill(1);
  const ratios = Array.from({ length: 12 }, () => []);
  for (let t = 6; t < values.length - 6; t++) {
    const cma = (0.5 * values[t - 6] + sum(values.slice(t - 5, t + 6)) + 0.5 * values[t + 6]) / 12;
    if (cma > 0) ratios[(startMonth + t) % 12].push(values[t] / cma);
  }
  const raw = ratios.map((r) => (r.length ? mean(r) : 1));
  const scale = 12 / sum(raw);
  return raw.map((r) => r * scale);
}

export function fitForecast(values, startMonth, horizon) {
  const seasonal = seasonalIndices(values, startMonth);
  const deseasonalized = values.map((v, t) => v / seasonal[(startMonth + t) % 12]);
  const { a, b } = linearRegression(deseasonalized);
  const predict = (t) => Math.max(0, (a + b * t) * seasonal[(startMonth + t) % 12]);
  return {
    seasonal,
    slope: b,
    forecast: Array.from({ length: horizon }, (_, h) => predict(values.length + h)),
  };
}

// MAPE = average ng |aktwal - forecast| / aktwal; mas mababa = mas tumpak
export function backtestMape(values, startMonth) {
  if (values.length < MIN_MONTHS_FOR_SEASONALITY + BACKTEST_MONTHS) return null;
  const train = values.slice(0, -BACKTEST_MONTHS);
  const actual = values.slice(-BACKTEST_MONTHS);
  const { forecast } = fitForecast(train, startMonth, BACKTEST_MONTHS);
  const errors = actual.map((a, i) => (a > 0 ? Math.abs(a - forecast[i]) / a : null)).filter((e) => e !== null);
  return errors.length ? mean(errors) : null;
}

// Accuracy ng linear regression (paraan ng statistician): sanayin sa lahat maliban sa huling 6 na buwan,
// hulaan ang 6 na buwang iyon, saka ikumpara sa aktwal (MAPE)
export function backtestLinearMape(values) {
  if (values.length < 12 + BACKTEST_MONTHS) return null;
  const train = values.slice(0, -BACKTEST_MONTHS);
  const actual = values.slice(-BACKTEST_MONTHS);
  const { a, b } = linearRegression(train);
  const errors = actual
    .map((value, i) => (value > 0 ? Math.abs(value - (a + b * (train.length + i))) / value : null))
    .filter((e) => e !== null);
  return errors.length ? mean(errors) : null;
}

// Hula mula sa naka-save na equation (constant + slope x t), t = 1 ang unang buwan ng model
export function linearModelForecast(model, fromMonthIndex, horizon) {
  const base = model.firstMonth.year * 12 + model.firstMonth.month;
  return Array.from({ length: horizon }, (_, h) => Math.max(0, model.constant + model.slope * (fromMonthIndex + h - base + 1)));
}


const DAY_MS = 86400000;
// Lunes ng linggong kinabibilangan ng petsa (00:00, local time)
export function weekStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
const weeksBetween = (from, to) => Math.round((to - from) / (7 * DAY_MS));

// [PREDICTIVE ANALYTICS] Lingguhang benta (Lunes hanggang Linggo), buong linggo lang
export function buildWeeklySales(orders, { now = new Date() } = {}) {
  const sales = orders.filter((o) => ANALYTICS_ORDER_STATUSES.includes(o.status));
  if (sales.length === 0) return null;
  const firstWeek = weekStart(new Date(Math.min(...sales.map((o) => new Date(o.orderedAt).getTime()))));
  const length = weeksBetween(firstWeek, weekStart(now));
  if (length <= 0) return null;
  const totals = Array(length).fill(0);
  sales.forEach((o) => {
    const w = weeksBetween(firstWeek, weekStart(new Date(o.orderedAt)));
    if (w >= 0 && w < length) totals[w] += o.totalAmount;
  });
  return { firstWeek, history: totals };
}

// [PREDICTIVE ANALYTICS] Taunang benta, hanggang noong nakaraang taon lang (buong taon)
export function buildYearlySales(orders, { now = new Date() } = {}) {
  const sales = orders.filter((o) => ANALYTICS_ORDER_STATUSES.includes(o.status));
  if (sales.length === 0) return null;
  const firstYear = Math.min(...sales.map((o) => new Date(o.orderedAt).getFullYear()));
  const length = now.getFullYear() - firstYear;
  if (length <= 0) return null;
  const totals = Array(length).fill(0);
  sales.forEach((o) => {
    const y = new Date(o.orderedAt).getFullYear() - firstYear;
    if (y >= 0 && y < length) totals[y] += o.totalAmount;
  });
  return { firstYear, history: totals };
}

// Hula mula sa taunang equation (constant + slope x taon)
export function yearlyModelForecast(model, fromYear, horizon) {
  return Array.from({ length: horizon }, (_, h) => Math.max(0, model.constant + model.slope * (fromYear + h)));
}

// Hula mula sa lingguhang equation; t = 1 ang linggo ng model.firstWeekStart
export function weeklyModelForecast(model, firstWeek, fromWeek, horizon) {
  const offset = weeksBetween(weekStart(new Date(model.firstWeekStart)), firstWeek);
  return Array.from({ length: horizon }, (_, h) => Math.max(0, model.constant + model.slope * (offset + fromWeek + h + 1)));
}

function realizedSales(orders) {
  return orders
    .filter((o) => ANALYTICS_ORDER_STATUSES.includes(o.status))
    .map((o) => ({ ...o, month: monthIndex(new Date(o.orderedAt)) }));
}

export function buildSalesForecast(orders, products, { horizon = 6, now = new Date(), seasonality = true } = {}) {
  const sales = realizedSales(orders);
  if (sales.length === 0) return null;

  // Buong buwan lang: hanggang noong nakaraang buwan
  const firstMonth = Math.min(...sales.map((o) => o.month));
  const lastCompleteMonth = monthIndex(now) - 1;
  if (lastCompleteMonth < firstMonth) return null;

  const length = lastCompleteMonth - firstMonth + 1;
  const revenue = Array(length).fill(0);
  const units = new Map();
  sales.forEach((o) => {
    const t = o.month - firstMonth;
    if (t < 0 || t >= length) return;
    revenue[t] += o.totalAmount;
    (o.items || []).forEach((item) => {
      if (!units.has(item.productId)) units.set(item.productId, Array(length).fill(0));
      units.get(item.productId)[t] += item.quantity;
    });
  });

  // Lahat ng buong buwan ay kasama, kahit maliit ang naitalang benta
  const usable = length;

  const history = revenue.slice(0, usable);
  const startMonth = firstMonth % 12;
  const { seasonal, slope, forecast } = fitForecast(history, startMonth, horizon);
  const mape = backtestMape(history, startMonth);
  const forecastStart = firstMonth + usable;

  // Kapag walang napatunayang seasonal pattern, pantay (1) ang index ng bawat buwan sa hula bawat product
  const productSeasonal = seasonality ? seasonal : Array(12).fill(1);
  const productForecasts = products
    .map((p) => productForecast(p, (units.get(p.id) || Array(length).fill(0)).slice(0, usable), forecastStart, productSeasonal))
    .filter((p) => p.recentUnits > 0 || p.stock > 0);

  return {
    firstMonth,
    forecastStart,
    history,
    forecast,
    seasonal,
    monthlyTrend: slope,
    mape,
    hasSeasonality: history.length >= MIN_MONTHS_FOR_SEASONALITY,
    productForecasts,
  };
}

// [PREDICTIVE ANALYTICS] Demand bawat product:
// Forecast = average na benta bawat buwan (huling 12 buwan) x Seasonal Index x (1 + growth)
// Growth = huling 6 na buwan kumpara sa parehong 6 na buwan noong nakaraang taon (YoY)
function productForecast(product, monthlyUnits, forecastStart, seasonal) {
  const n = monthlyUnits.length;
  const last12 = monthlyUnits.slice(Math.max(0, n - 12));
  const last6 = sum(monthlyUnits.slice(Math.max(0, n - 6)));
  const sameLastYear = n >= 18 ? sum(monthlyUnits.slice(n - 18, n - 12)) : 0;
  const growth = sameLastYear > 0 ? (last6 - sameLastYear) / sameLastYear : null;

  // Kapag sobrang konti ng benta, hindi maaasahan ang % growth
  const lowVolume = last6 + sameLastYear < MIN_UNITS_FOR_TREND;

  let trend = 'Steady';
  if (growth === null) trend = last6 > 0 ? 'New' : 'No recent sales';
  else if (lowVolume) trend = 'Low volume';
  else if (growth >= TREND_THRESHOLD) trend = 'Rising';
  else if (growth <= -TREND_THRESHOLD) trend = 'Declining';

  const avgMonthly = mean(last12);
  const usableGrowth = growth === null || lowVolume ? 0 : growth;
  const factor = 1 + Math.min(MAX_GROWTH, Math.max(-MAX_GROWTH, usableGrowth));
  const monthly = [0, 1, 2].map((h) => avgMonthly * seasonal[(forecastStart + h) % 12] * factor);
  const nextMonthUnits = Math.round(monthly[0]);
  const next3Units = Math.round(sum(monthly));

  let stockStatus = 'Enough';
  if (nextMonthUnits > 0 && product.stock < nextMonthUnits) stockStatus = 'Restock now';
  else if (next3Units > 0 && product.stock < next3Units) stockStatus = 'Restock soon';

  return {
    id: product.id,
    name: product.name.trim(),
    category: product.category,
    unit: product.unit,
    stock: product.stock,
    price: product.price,
    recentUnits: sum(last12),
    growth,
    trend,
    nextMonthUnits,
    next3Units,
    next3Revenue: next3Units * product.price,
    stockStatus,
  };
}
