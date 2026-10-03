import { REALIZED_ORDER_STATUSES, weekStart } from './forecast';
import { STATISTICIAN_DATASET } from '../data/statisticianResults';

const DAY_MS = 86400000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isHistoryOrder = (o) => o.id.startsWith('HIST-');

// [ANALYTICS] Mga order na binibilang sa analytics. Hanggang Aug 31, 2026 (dulo ng data ng statistician),
// ang sales history lang ang kasama para eksaktong tumugma sa resulta niya; ang mga order sa website noon
// ay mga test order bago inilunsad ang system. Pagkatapos nito, lahat ng natuloy na benta ay kasama na.
export function analyticsOrders(orders) {
  return orders.filter((o) => isHistoryOrder(o) || ymd(new Date(o.orderedAt)) > STATISTICIAN_DATASET.to);
}

// Iisang produkto ang lahat ng sukat ng Coconut Husk Pole sa data ng statistician
export const performanceName = (name) => name.trim().replace(/\s*\(\d+\s*ft\)$/i, '');

function periodKeyer(level, firstOrder) {
  if (level === 'yearly') {
    return {
      index: (d) => d.getFullYear() - firstOrder.getFullYear(),
      describe: (i) => {
        const year = firstOrder.getFullYear() + i;
        return { label: String(year), from: new Date(year, 0, 1), to: new Date(year, 11, 31) };
      },
    };
  }
  if (level === 'monthly') {
    const base = firstOrder.getFullYear() * 12 + firstOrder.getMonth();
    return {
      index: (d) => d.getFullYear() * 12 + d.getMonth() - base,
      describe: (i) => {
        const year = Math.floor((base + i) / 12);
        const month = (base + i) % 12;
        return { label: `${MONTHS[month]} ${year}`, from: new Date(year, month, 1), to: new Date(year, month + 1, 0) };
      },
    };
  }
  const firstWeek = weekStart(firstOrder);
  return {
    index: (d) => Math.round((weekStart(d) - firstWeek) / (7 * DAY_MS)),
    describe: (i) => {
      const from = new Date(firstWeek.getFullYear(), firstWeek.getMonth(), firstWeek.getDate() + i * 7);
      return { label: `Week ${i + 1}`, from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6) };
    },
  };
}

// [ANALYTICS] Product Performance (gaya ng sheet ng statistician): bawat taon / buwan / linggo,
// ang Most In-Demand Product (pinakamaraming nabentang piraso), ilan ang nabenta nito, at ang Total Sales.
// Kasama rin kung ilang beses naging #1 ang bawat produkto at ang kabuuang nabenta bawat produkto.
export function buildProductPerformance(orders, level, { now = new Date() } = {}) {
  const sales = orders.filter((o) => REALIZED_ORDER_STATUSES.includes(o.status));
  if (sales.length === 0) return null;
  const firstOrder = new Date(Math.min(...sales.map((o) => new Date(o.orderedAt).getTime())));
  const keyer = periodKeyer(level, firstOrder);
  const count = keyer.index(now) + 1;
  const periods = Array.from({ length: count }, (_, i) => ({ ...keyer.describe(i), number: i + 1, totalSales: 0, orders: 0, units: 0, qty: new Map() }));
  const products = new Map();

  sales.forEach((o) => {
    const p = periods[keyer.index(new Date(o.orderedAt))];
    if (!p) return;
    p.totalSales += o.totalAmount;
    p.orders += 1;
    (o.items || []).forEach((item) => {
      const name = performanceName(item.productName);
      p.qty.set(name, (p.qty.get(name) || 0) + item.quantity);
      p.units += item.quantity;
      const row = products.get(name) || { name, productIds: new Set(), quantity: 0, sales: 0, timesTop: 0 };
      row.productIds.add(item.productId);
      row.quantity += item.quantity;
      row.sales += item.price * item.quantity;
      products.set(name, row);
    });
  });

  // Kapag tabla, ang mas mabentang produkto sa kabuuan ang nauuna (gaya ng ayos ng column sa sheet)
  const overallRank = new Map([...products.values()].sort((a, b) => b.quantity - a.quantity).map((r, i) => [r.name, i]));
  periods.forEach((p) => {
    let top = null;
    p.qty.forEach((qty, name) => {
      if (!top || qty > top.qty || (qty === top.qty && overallRank.get(name) < overallRank.get(top.name))) top = { name, qty };
    });
    p.topProduct = top ? top.name : null;
    p.topQty = top ? top.qty : 0;
    if (top) products.get(top.name).timesTop += 1;
    p.inProgress = p.to >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  return {
    level,
    periods,
    products: [...products.values()].sort((a, b) => b.quantity - a.quantity || b.sales - a.sales),
    totalSales: periods.reduce((s, p) => s + p.totalSales, 0),
    totalUnits: periods.reduce((s, p) => s + p.units, 0),
  };
}

// Ilang linggo ang laman ng isang period (para maikumpara ang stock sa lingguhang demand)
const WEEKS_PER_PERIOD = { weekly: 1, monthly: 52.18 / 12, yearly: 52.18 };
// Huling mga period na ikinukumpara sa kabuuang average para sa trend
const RECENT_PERIODS = { weekly: 26, monthly: 12, yearly: 2 };

// [PREDICTIVE ANALYTICS] Hula sa product performance ng susunod na period.
// - Inaasahang benta ng produkto = bahagi nito sa benta (sales history) x projected sales ng statistician
// - Inaasahang dami = karaniwang nabebenta nito bawat period, inayon sa projected sales
// - Tsansang maging #1 = ilang beses itong naging most in-demand / bilang ng period
// - Trend = karaniwang nabenta sa mga huling period kumpara sa buong history
// - Stock cover = ilang linggo pa tatagal ang kasalukuyang stock sa inaasahang demand
export function predictProductPerformance(perf, projected, stockByName = new Map()) {
  if (!perf) return null;
  const withSales = perf.periods.filter((p) => !p.inProgress && p.totalSales > 0);
  const sorted = withSales.map((p) => p.totalSales).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  // Hindi isinasama ang period na kulang ang naitalang benta (gaya ng sa sales forecast)
  const basis = withSales.filter((p) => p.totalSales >= median * 0.5);
  if (basis.length === 0) return null;

  const basisSales = basis.reduce((s, p) => s + p.totalSales, 0);
  const avgPeriodSales = basisSales / basis.length;
  const scale = avgPeriodSales > 0 ? projected / avgPeriodSales : 1;
  const recent = basis.slice(-RECENT_PERIODS[perf.level]);
  const weeksPerPeriod = WEEKS_PER_PERIOD[perf.level];

  const stats = new Map();
  basis.forEach((p) => {
    p.qty.forEach((qty, name) => {
      const s = stats.get(name) || { units: 0, top: 0 };
      s.units += qty;
      stats.set(name, s);
    });
    if (p.topProduct) stats.get(p.topProduct).top += 1;
  });
  const salesByName = new Map(perf.products.map((r) => [r.name, r]));
  const totalProductSales = [...stats.keys()].reduce((s, name) => s + (salesByName.get(name)?.sales || 0), 0);

  const rows = [...stats.entries()].map(([name, s]) => {
    const info = salesByName.get(name);
    const avgUnits = s.units / basis.length;
    const recentUnits = recent.reduce((sum, p) => sum + (p.qty.get(name) || 0), 0) / recent.length;
    const ratio = avgUnits > 0 ? recentUnits / avgUnits : 1;
    const expectedUnits = Math.max(0, Math.round(avgUnits * scale));
    const share = totalProductSales > 0 ? (info?.sales || 0) / totalProductSales : 0;
    const stock = stockByName.has(name) ? stockByName.get(name) : null;
    const weeklyDemand = expectedUnits / weeksPerPeriod;
    return {
      name,
      productIds: info ? [...info.productIds] : [],
      expectedUnits,
      expectedSales: share * projected,
      share,
      chanceTop: s.top / basis.length,
      trend: avgUnits < 2 ? 'Low volume' : ratio >= 1.1 ? 'Rising' : ratio <= 0.9 ? 'Declining' : 'Steady',
      change: ratio - 1,
      stock,
      weeksOfStock: stock === null ? null : weeklyDemand > 0 ? stock / weeklyDemand : Infinity,
    };
  }).sort((a, b) => b.chanceTop - a.chanceTop || b.expectedSales - a.expectedSales);

  return { rows, basisPeriods: basis.length, projected, from: basis[0].from, to: basis[basis.length - 1].to };
}
