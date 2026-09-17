// src/utils/dateBuckets.js
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function lastNMonths(n) {
  const now = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ label: MONTH_LABELS[d.getMonth()], year: d.getFullYear(), month: d.getMonth() });
  }
  return out;
}

export function lastNQuarters(n) {
  const now = new Date();
  const currentQ = Math.floor(now.getMonth() / 3);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    let q = currentQ - i;
    let year = now.getFullYear();
    while (q < 0) { q += 4; year -= 1; }
    out.push({ label: `Q${q + 1} '${String(year).slice(2)}`, year, quarter: q });
  }
  return out;
}

// Sums realized order totals into month or quarter buckets, e.g. for
// revenue trend line charts.
export function bucketOrderRevenue(orders, buckets, granularity) {
  return buckets.map(b => {
    const amount = orders.reduce((sum, o) => {
      const d = new Date(o.orderedAt);
      const inBucket = granularity === 'Monthly'
        ? (d.getFullYear() === b.year && d.getMonth() === b.month)
        : (d.getFullYear() === b.year && Math.floor(d.getMonth() / 3) === b.quarter);
      return inBucket ? sum + o.totalAmount : sum;
    }, 0);
    return { label: b.label, amount };
  });
}
