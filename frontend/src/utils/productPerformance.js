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
