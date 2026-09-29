import React, { useState, useMemo } from 'react';
import { lastNMonths, bucketOrderRevenue } from '../utils/dateBuckets';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  TrendingUp,
  BarChart3,
  RefreshCw,
  PhilippinePeso,
  Check,
  Eye,
  ClipboardCheck,
  Package,
  Upload,
  PieChart,
  Sparkles,
  Building2,
  X,
  Tag,
  Lightbulb,
  Percent,
} from 'lucide-react';
import MobileScrollHint from './MobileScrollHint';

const CHART_PALETTE = {
  light: {
    grid: '#e2e8f0',
    axis: '#94a3b8',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e2e8f0',
    tooltipText: '#0f172a',
    revenue: '#6b7c52',
    stock: '#6b7c52',
    sold: '#f59e0b',
    views: '#6366f1',
    highlight: '#d97706',
  },
  dark: {
    grid: '#334155',
    axis: '#64748b',
    tooltipBg: '#0f172a',
    tooltipBorder: '#334155',
    tooltipText: '#f1f5f9',
    revenue: '#a8b587',
    stock: '#a8b587',
    sold: '#fbbf24',
    views: '#818cf8',
    highlight: '#fbbf24',
  },
};

const CATEGORY_COLORS = {
  light: {
    Charcoal: '#2b2b2b',
    Fertilizer: '#6b7c52',
    'Fibre & Coir': '#6f4e37',
    Handicraft: '#d97706',
    Other: '#94a3b8',
  },
  dark: {
    Charcoal: '#a8a29e',
    Fertilizer: '#a8b587',
    'Fibre & Coir': '#b08968',
    Handicraft: '#fbbf24',
    Other: '#64748b',
  },
};

export default function ExecDashboard({
  products,
  orders,
  members = [],
  ledger = [],
  onVerifyOrder,
  onUpdateProductStock,
  onApplyPromo,
  onToast,
  isDarkMode,
}) {
  const [editingProductId, setEditingProductId] = useState(null);
  const [restockValue, setRestockValue] = useState(0);
  const [selectedChartType, setSelectedChartType] = useState('sales');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [applyingPromoId, setApplyingPromoId] = useState(null);
  const [showAllAuditOrders, setShowAllAuditOrders] = useState(false);
  const [showAllShareCapital, setShowAllShareCapital] = useState(false);

  const palette = CHART_PALETTE[isDarkMode ? 'dark' : 'light'];
  const categoryColors = CATEGORY_COLORS[isDarkMode ? 'dark' : 'light'];

  const FULFILLMENT_STATUSES = ['Completed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered'];
  const verifiedOrders = orders.filter(o => FULFILLMENT_STATUSES.includes(o.status));
  // [ANALYTICS] Total Revenue: verified orders lang (hindi kasama pending/rejected/cancelled)
  const totalRevenue = orders.reduce((sum, o) => {
    return o.status !== 'Pending Verification' && o.status !== 'Rejected' && o.status !== 'Cancelled' ? sum + o.totalAmount : sum;
  }, 0);

  const [previousMonthRevenue, currentMonthRevenue] = bucketOrderRevenue(
    verifiedOrders, lastNMonths(2), 'Monthly'
  ).map(b => b.amount);
  // [ANALYTICS] Sales Growth = (Current - Previous) / Previous x 100
  const salesGrowthRate = previousMonthRevenue > 0
    ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
    : 0;

  const totalTransactions = orders.length;
  // [ANALYTICS] Average Order Value = Total Revenue / Number of Orders
  const averageOrderValue = totalTransactions > 0
    ? totalRevenue / totalTransactions
    : 0;

  const overallProductViews = products.reduce((sum, p) => sum + p.views, 0);
  const overallProductOrders = products.reduce((sum, p) => sum + p.ordersCount, 0);
  // [ANALYTICS] Conversion Rate = Orders / Product Views x 100
  const conversionRate = overallProductViews > 0
    ? (overallProductOrders / overallProductViews) * 100
    : 0;

  const totalUnitsSold = products.reduce((sum, p) => sum + p.ordersCount, 0);
  const totalCurrentStockCount = products.reduce((sum, p) => sum + p.stock, 0);
  const averageInventory = (totalUnitsSold + totalCurrentStockCount) / 2 || 1;
  // [ANALYTICS] Inventory Turnover = Units Sold / Average Inventory
  const inventoryTurnover = totalUnitsSold / averageInventory;

  // [RANKING] Top 5 best-selling products (sorted ayon sa dami ng nabenta)
  const topSellingProducts = [...products]
    .sort((a, b) => b.ordersCount - a.ordersCount)
    .slice(0, 5);

  // [METRICS] Promo score (0-100): mabagal mabenta (slow-moving) + low conversion + bumabagal na benta
  const promoSuggestions = useMemo(() => {
    const now = new Date();
    const cutoffRecent = new Date(now);
    cutoffRecent.setDate(cutoffRecent.getDate() - 30);
    const cutoffPrior = new Date(now);
    cutoffPrior.setDate(cutoffPrior.getDate() - 60);

    const recentUnitsById = new Map();
    const priorUnitsById = new Map();
    verifiedOrders.forEach(o => {
      const orderedAt = new Date(o.orderedAt);
      (o.items || []).forEach(item => {
        if (orderedAt >= cutoffRecent) {
          recentUnitsById.set(item.productId, (recentUnitsById.get(item.productId) || 0) + item.quantity);
        } else if (orderedAt >= cutoffPrior) {
          priorUnitsById.set(item.productId, (priorUnitsById.get(item.productId) || 0) + item.quantity);
        }
      });
    });

    // [METRICS] Hindi kasama: bagong product (wala pang 30 days) at product na walang stock
    const NEW_PRODUCT_DAYS = 30;
    const isNewProduct = (p) => p.createdAt && (now - new Date(p.createdAt)) / 86400000 < NEW_PRODUCT_DAYS;

    return products
      .filter(p => !isNewProduct(p) && p.stock > 0)
      .map(p => {
        const reasons = [];
        let score = 0;

        const sellThrough = p.ordersCount / (p.ordersCount + p.stock || 1);
        if (p.stock > 5 && sellThrough < 0.25) {
          score += (1 - sellThrough) * 40;
          reasons.push(`Slow-moving · ${Math.round(sellThrough * 100)}% of stock sold`);
        }

        if (p.views >= 10) {
          const productConversion = p.ordersCount / p.views;
          const overallConversion = conversionRate / 100;
          if (overallConversion > 0 && productConversion < overallConversion * 0.6) {
            score += Math.min(1, 1 - productConversion / overallConversion) * 30;
            reasons.push('High views, low conversion');
          }
        }

        const recentUnits = recentUnitsById.get(p.id) || 0;
        const priorUnits = priorUnitsById.get(p.id) || 0;
        if (priorUnits >= 2) {
          const decline = (priorUnits - recentUnits) / priorUnits;
          if (decline >= 0.3) {
            score += Math.min(1, decline) * 30;
            reasons.push('Sales slowing');
          }
        }

        // [METRICS] Suggested discount = score ÷ 5, naka-round sa 5% (25→5%, 50→10%, 75→15%, 100→20%); max 25%
        const suggestedDiscount = score > 0 ? Math.min(25, Math.max(5, Math.round(score / 25) * 5)) : 0;
        return { ...p, reasons, score, suggestedDiscount };
      })
      .filter(p => p.score >= 25 && !(p.discountPercent > 0))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [products, verifiedOrders, conversionRate]);

  const activePromos = products.filter(p => p.discountPercent > 0);

  const monthBuckets = useMemo(() => lastNMonths(6), []);
  const monthlyRevenueData = useMemo(() => {
    const revenues = bucketOrderRevenue(verifiedOrders, monthBuckets, 'Monthly');
    return monthBuckets.map((b, i) => ({ ...b, amount: revenues[i].amount }));
  }, [verifiedOrders, monthBuckets]);

  const categoryRevenue = useMemo(() => {
    const categoryById = new Map(products.map(p => [p.id, p.category]));
    const totals = {};
    verifiedOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const category = categoryById.get(item.productId) || 'Other';
        totals[category] = (totals[category] || 0) + item.price * item.quantity;
      });
    });
    return Object.entries(totals)
      .map(([category, revenue]) => ({ category, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [products, verifiedOrders]);

  const PRODUCT_CHART_LIMIT = 8;
  const productMetricKey = selectedChartType === 'sales' ? 'ordersCount' : 'views';
  const productChartSource = selectedCategory
    ? products.filter(p => p.category === selectedCategory)
    : products;
  const productChartData = [...productChartSource]
    .sort((a, b) => b[productMetricKey] - a[productMetricKey])
    .slice(0, PRODUCT_CHART_LIMIT);
  const hiddenProductCount = Math.max(productChartSource.length - PRODUCT_CHART_LIMIT, 0);

  const auditOrders = selectedMonth
    ? orders.filter(o => {
        const d = new Date(o.orderedAt);
        return d.getFullYear() === selectedMonth.year && d.getMonth() === selectedMonth.month;
      })
    : orders;

  const AUDIT_PREVIEW_COUNT = 3;
  const visibleAuditOrders = showAllAuditOrders ? auditOrders : auditOrders.slice(0, AUDIT_PREVIEW_COUNT);

  const toggleMonth = (point) => {
    setSelectedMonth(prev => (prev && prev.label === point.label && prev.year === point.year ? null : point));
  };
  const toggleCategory = (category) => {
    setSelectedCategory(prev => (prev === category ? null : category));
  };
  const toggleProduct = (productId) => {
    setSelectedProductId(prev => (prev === productId ? null : productId));
  };

  const ChartTooltip = ({ active, payload, label, formatter }) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        className="rounded-lg px-3 py-2 text-xs font-semibold shadow-lg border"
        style={{ background: palette.tooltipBg, borderColor: palette.tooltipBorder, color: palette.tooltipText }}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-60 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color || p.fill }}>{formatter ? formatter(p) : `${p.name}: ${p.value}`}</p>
        ))}
      </div>
    );
  };

  const totalShareCapitalContributed = ledger
    .filter(l => l.status === 'Verified')
    .reduce((sum, l) => sum + l.amount, 0);
  const totalRequiredShareCapital = members.reduce((sum, m) => sum + m.requiredShareCapital, 0);
  // [SHARE CAPITAL] Outstanding = Total Required - Total Contributed (lahat ng members)
  const outstandingShareCapital = Math.max(totalRequiredShareCapital - totalShareCapitalContributed, 0);
  const shareCapitalByMember = members.map(m => {
    const contributed = ledger
      .filter(l => l.memberId === m.id && l.status === 'Verified')
      .reduce((sum, l) => sum + l.amount, 0);
    return { ...m, contributed, remaining: Math.max(m.requiredShareCapital - contributed, 0) };
  });

  const SHARE_CAPITAL_PREVIEW_COUNT = 8;
  const maxShareCapital = Math.max(...shareCapitalByMember.map(m => m.contributed + m.remaining), 1);

  const handleApplyPromo = async (productId, discountPercent) => {
    setApplyingPromoId(productId);
    try {
      await onApplyPromo(productId, discountPercent);
    } finally {
      setApplyingPromoId(null);
    }
  };

  const handleRestockSubmit = (e, productId) => {
    e.preventDefault();
    if (restockValue < 0) {
      onToast('Restock values cannot be negative.', 'error');
      return;
    }
    onUpdateProductStock(productId, restockValue);
    setEditingProductId(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="space-y-1 text-left">
          <p className="text-xs font-mono uppercase tracking-widest text-[#d97706] font-bold">E-COMMERCE ANALYTICS</p>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Product Performance &amp; Purchase Patterns</h2>
        </div>
        <div className="flex gap-2">
          <span className="text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-slate-900 dark:text-emerald-300 border border-emerald-200/50 flex items-center gap-1">
             GA-GAAP Standard Metrics
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 select-none">

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex flex-col justify-between relative overflow-hidden group hover:border-[#313826]/40 transition-all duration-300">
          <div className="space-y-2 text-left">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <PhilippinePeso className="w-3.5 h-3.5 text-emerald-800" /> GAAP Sales Revenue
            </p>
            <p className="text-3xl font-light text-slate-950 dark:text-white mt-1">
              ₱{totalRevenue.toLocaleString()}
            </p>
          </div>
          <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 mt-4">
            <p className="text-[10px] text-slate-400 font-medium">MoM Growth Rate</p>
            <span className={`text-xs font-bold flex items-center gap-0.5 ${
              salesGrowthRate >= 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}>
              <TrendingUp className="w-3.5 h-3.5" />
              {salesGrowthRate.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="bg-[#FDFCF7] dark:bg-emerald-950/25 border border-emerald-100 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group hover:border-[#D97706]/40 transition-all duration-300">
          <div className="space-y-2 text-left">
            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-amber-600" /> Conv. Rate
            </p>
            <p className="text-3xl font-bold text-emerald-950 dark:text-emerald-400 mt-1">
              {conversionRate.toFixed(2)}<span className="text-lg font-light text-emerald-700">%</span>
            </p>
          </div>
          <div className="pt-4 space-y-2 border-t border-emerald-100/50 dark:border-slate-800 mt-4">
            <div className="h-1.5 w-full bg-emerald-100 dark:bg-slate-900 rounded-full overflow-hidden">
              <div className="h-full bg-[#D97706]" style={{ width: `${Math.min(conversionRate, 100)}%` }}></div>
            </div>
            <div className="flex justify-between items-center text-[10px] text-emerald-700">
              <span>Orders vs Views</span>
              <span className="font-mono font-bold">{overallProductOrders} / {overallProductViews}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#313826] text-white rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group hover:bg-[#1e2318] transition-all duration-300">
          <div className="space-y-2 text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" /> Inventory Turnover
            </p>
            <p className="text-4xl font-light mt-2 text-white">
              {inventoryTurnover.toFixed(2)}<span className="text-xl">x</span>
            </p>
          </div>
          <div className="pt-4 flex items-center gap-2 border-t border-emerald-800/80 mt-4">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <p className="text-[10px] text-emerald-200 text-left font-light leading-snug">Optimized stock utilization active</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex flex-col justify-between relative overflow-hidden group hover:border-[#313826]/40 transition-all duration-300">
          <div className="space-y-2 text-left">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-sky-600" /> Avg Order Value (AOV)
            </p>
            <p className="text-3xl font-light text-slate-950 dark:text-white mt-1">
              ₱{averageOrderValue.toFixed(2)}
            </p>
          </div>
          <div className="pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 mt-4">
            <p className="text-[10px] text-slate-400 font-medium">Verified Purchases</p>
            <span className="text-xs font-mono text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded">
              {totalTransactions} Posts
            </span>
          </div>
        </div>

      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3 border-b pb-3">
          <h3 className="font-bold text-slate-900 dark:text-white">
            Monthly Revenue Trend
          </h3>
          {selectedMonth && (
            <button
              onClick={() => setSelectedMonth(null)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
            >
              Filtering orders to {selectedMonth.label} {selectedMonth.year} <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400">Realized revenue for the last 6 months. Click a point to see that month's orders in the audit list below.</p>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart
              data={monthlyRevenueData}
              margin={{ top: 5, right: 16, left: 0, bottom: 0 }}
              onClick={(state) => {
                const point = state?.activePayload?.[0]?.payload;
                if (point) toggleMonth(point);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: palette.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: palette.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} width={48} />
              <Tooltip content={<ChartTooltip formatter={(p) => `Revenue: ₱${p.value.toLocaleString()}`} />} cursor={{ stroke: palette.grid }} />
              <Line
                type="monotone"
                dataKey="amount"
                name="Revenue"
                stroke={palette.revenue}
                strokeWidth={2.5}
                activeDot={{ r: 6, style: { cursor: 'pointer' } }}
                dot={(dotProps) => {
                  const { key, ...rest } = dotProps;
                  const isSelected = selectedMonth && rest.payload.label === selectedMonth.label && rest.payload.year === selectedMonth.year;
                  return (
                    <circle
                      key={key}
                      cx={rest.cx}
                      cy={rest.cy}
                      r={isSelected ? 6 : 4}
                      fill={isSelected ? palette.highlight : palette.revenue}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3 border-b pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white">
              Product Performance
            </h3>
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border text-slate-500 text-xs gap-1">
              <button
                onClick={() => setSelectedChartType('sales')}
                className={`px-2 py-1 rounded transition cursor-pointer font-medium ${selectedChartType === 'sales' ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm' : ''}`}
              >
                Stock vs Sold
              </button>
              <button
                onClick={() => setSelectedChartType('conversion')}
                className={`px-2 py-1 rounded transition cursor-pointer font-medium ${selectedChartType === 'conversion' ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm' : ''}`}
              >
                Product Views
              </button>
            </div>
          </div>

          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
            >
              <Tag className="w-3 h-3" /> Category: {selectedCategory} <X className="w-3 h-3" />
            </button>
          )}

          <p className="text-xs text-slate-400">
            {selectedChartType === 'sales'
              ? 'Remaining stock vs lifetime units sold. Click a bar to highlight that product in the leaderboard.'
              : 'Storefront page views per product. Click a bar to highlight that product in the leaderboard.'}
          </p>

          <div style={{ width: '100%', height: Math.max(productChartData.length * 34, 160) }}>
            <ResponsiveContainer>
              <BarChart data={productChartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: palette.axis }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={112}
                  tick={{ fontSize: 11, fill: palette.axis }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.12)' }}
                  content={<ChartTooltip formatter={(p) => `${p.name}: ${p.value.toLocaleString()}`} />}
                />
                {selectedChartType === 'sales' ? (
                  <>
                    <Bar dataKey="stock" name="Stock" radius={[0, 4, 4, 0]} maxBarSize={14} style={{ cursor: 'pointer' }} onClick={(data) => toggleProduct(data?.payload?.id ?? data?.id)}>
                      {productChartData.map((p) => (
                        <Cell key={p.id} fill={palette.stock} opacity={!selectedProductId || selectedProductId === p.id ? 1 : 0.35} />
                      ))}
                    </Bar>
                    <Bar dataKey="ordersCount" name="Sold" radius={[0, 4, 4, 0]} maxBarSize={14} style={{ cursor: 'pointer' }} onClick={(data) => toggleProduct(data?.payload?.id ?? data?.id)}>
                      {productChartData.map((p) => (
                        <Cell key={p.id} fill={palette.sold} opacity={!selectedProductId || selectedProductId === p.id ? 1 : 0.35} />
                      ))}
                    </Bar>
                  </>
                ) : (
                  <Bar dataKey="views" name="Views" radius={[0, 4, 4, 0]} maxBarSize={18} style={{ cursor: 'pointer' }} onClick={(data) => toggleProduct(data?.payload?.id ?? data?.id)}>
                    {productChartData.map((p) => (
                      <Cell key={p.id} fill={palette.views} opacity={!selectedProductId || selectedProductId === p.id ? 1 : 0.35} />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
            {selectedChartType === 'sales' ? (
              <div className="flex gap-4 text-[10px] font-semibold text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: palette.stock }} /> Stock</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: palette.sold }} /> Sold</span>
              </div>
            ) : <span />}
            {hiddenProductCount > 0 && (
              <p className="text-[10px] text-slate-400">+{hiddenProductCount} more in the Products tab</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-3 text-left">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              Sales by Category
            </h3>
            <p className="text-xs text-slate-400">What customers actually buy. Click a category to filter Product Performance.</p>
            {categoryRevenue.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No realized sales yet.</p>
            ) : (
              <div style={{ width: '100%', height: Math.max(categoryRevenue.length * 38, 140) }}>
                <ResponsiveContainer>
                  <BarChart data={categoryRevenue} layout="vertical" margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: palette.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="category" width={84} tick={{ fontSize: 11, fill: palette.axis }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(148,163,184,0.12)' }} content={<ChartTooltip formatter={(p) => `Revenue: ₱${p.value.toLocaleString()}`} />} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={22} style={{ cursor: 'pointer' }} onClick={(data) => toggleCategory(data?.payload?.category ?? data?.category)}>
                      {categoryRevenue.map((c) => (
                        <Cell
                          key={c.category}
                          fill={categoryColors[c.category] || categoryColors.Other}
                          opacity={!selectedCategory || selectedCategory === c.category ? 1 : 0.35}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 text-left space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              Top Selling Leaderboard
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {topSellingProducts.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => toggleProduct(p.id)}
                  className={`w-full py-2.5 flex items-center justify-between text-left cursor-pointer rounded-lg transition ${
                    selectedProductId === p.id ? 'bg-emerald-50 dark:bg-emerald-950/30 px-2 -mx-2' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-[#d97706] font-bold text-xs w-4">
                      #{i + 1}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-950 dark:text-white line-clamp-1">{p.name}</p>
                      <p className="text-[10px] text-slate-400">{p.category}</p>
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <p className="font-bold text-slate-800 dark:text-slate-200">{p.ordersCount} sold</p>
                    <p className="text-[10px] text-emerald-600">₱{(p.ordersCount * p.price).toLocaleString()}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 text-left space-y-4">
        <div className="border-b pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Lightbulb className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
            Promo &amp; Discount Suggestions
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">
            Products flagged from stock, view and sales-trend signals as good candidates for a limited-time promo.
          </p>
        </div>

        {promoSuggestions.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No products currently need a promo push — inventory and sales look healthy.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {promoSuggestions.map(p => (
              <div key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-950 dark:text-white">
                    {p.name} <span className="font-normal text-slate-400">· {p.category}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.reasons.map((r, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 font-medium"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <button
                    onClick={() => handleApplyPromo(p.id, p.suggestedDiscount)}
                    disabled={applyingPromoId === p.id}
                    className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-emerald-800 text-white hover:bg-emerald-700 cursor-pointer disabled:opacity-60 disabled:cursor-wait transition-colors"
                  >
                    <Percent className="w-3 h-3" />
                    {applyingPromoId === p.id ? 'Applying…' : `Apply ${p.suggestedDiscount}% off`}
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1">{p.stock} {p.unit} left · {p.ordersCount} sold</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activePromos.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Active Promotions — live on the storefront now
            </p>
            <div className="flex flex-wrap gap-2">
              {activePromos.map(p => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-2 text-[10px] font-semibold pl-2.5 pr-1.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-900"
                >
                  {p.name} · -{p.discountPercent}%
                  <button
                    onClick={() => handleApplyPromo(p.id, 0)}
                    disabled={applyingPromoId === p.id}
                    className="p-0.5 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900 cursor-pointer disabled:opacity-60"
                    title="Clear promo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="border-b pb-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
                Share Capital Contributions
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">Live from the GAAP ledger - every submitted payment records here automatically.</p>
            </div>
            {shareCapitalByMember.length > SHARE_CAPITAL_PREVIEW_COUNT && (
              <button
                onClick={() => setShowAllShareCapital(v => !v)}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-emerald-800 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer transition-colors whitespace-nowrap"
              >
                {showAllShareCapital ? 'Hide' : `View all (${shareCapitalByMember.length})`}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <PhilippinePeso className="w-3.5 h-3.5 text-emerald-800" /> Total Contributed
              </p>
              <p className="text-3xl font-light text-slate-950 dark:text-white mt-1">
                ₱{totalShareCapitalContributed.toLocaleString()}
              </p>
            </div>
            <div className="bg-[#FDFCF7] dark:bg-emerald-950/25 border border-emerald-100 dark:border-slate-800 rounded-xl p-4">
              <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                <PieChart className="w-3.5 h-3.5 text-amber-600" /> Outstanding Balance
              </p>
              <p className="text-3xl font-bold text-emerald-950 dark:text-emerald-400 mt-1">
                ₱{outstandingShareCapital.toLocaleString()}
              </p>
            </div>
          </div>

          {shareCapitalByMember.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No registered shareholders yet.</p>
          ) : (
            <div className="space-y-3 pt-2">
              {(showAllShareCapital ? shareCapitalByMember : shareCapitalByMember.slice(0, SHARE_CAPITAL_PREVIEW_COUNT)).map(m => {
                const contributedPercent = (m.contributed / maxShareCapital) * 100;
                const remainingPercent = (m.remaining / maxShareCapital) * 100;
                return (
                  <div key={m.id} className="space-y-1 text-xs">
                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 font-medium">
                      <span className="text-slate-700 dark:text-slate-200 font-semibold">{m.name}</span>
                      <div className="flex gap-4 font-mono text-[10px]">
                        <span className="text-emerald-700 dark:text-emerald-400">Paid: ₱{m.contributed.toLocaleString()}</span>
                        <span className="text-amber-700 dark:text-amber-400">Remaining: ₱{m.remaining.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-900 rounded-full flex overflow-hidden">
                      <div className="bg-emerald-600 transition-all duration-500" style={{ width: `${contributedPercent}%` }} />
                      <div className="bg-amber-500 transition-all duration-500" style={{ width: `${remainingPercent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4 text-left">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Package className="w-4.5 h-4.5 text-emerald-800 dark:text-emerald-400" />
          Cooperative Warehouse Inventory Cabinet (Dynamic Deductions)
        </h3>
        <p className="text-xs text-slate-500">
          The physical catalog operates on strict state deductions.
          Formula: <span className="p-1 px-1.5 rounded font-mono bg-slate-100 dark:bg-slate-950 text-emerald-700 dark:text-emerald-400 font-semibold">Remaining Stock = Current Stock - Quantity Sold</span>
        </p>

        <MobileScrollHint />
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="sticky top-0 z-10 bg-[#fdfbf7] dark:bg-slate-950 text-slate-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="p-3">Product Name</th>
                <th className="p-3">Category</th>
                <th className="p-3 font-mono text-right">Unit Price</th>
                <th className="p-3 font-mono text-right">Sold Count</th>
                <th className="p-3 font-mono text-right">Remaining Stock</th>
                <th className="p-3 text-center">Warehouse Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
              {products.map(product => {
                const isEditing = editingProductId === product.id;
                return (
                  <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">{product.name}</td>
                    <td className="p-3 text-slate-500">{product.category}</td>
                    <td className="p-3 font-mono text-right">₱{product.price.toLocaleString()}</td>
                    <td className="p-3 font-mono text-right text-amber-700 dark:text-amber-400 font-bold">{product.ordersCount} sold</td>
                    <td className="p-3 font-mono text-right font-bold">
                      <span className={`${product.stock <= 10 ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded' : 'text-slate-800 dark:text-slate-200'}`}>
                        {product.stock} {product.unit}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {isEditing ? (
                        <form onSubmit={(e) => handleRestockSubmit(e, product.id)} className="flex items-center justify-center gap-2">
                          <input
                            type="number"
                            value={restockValue}
                            onChange={(e) => setRestockValue(Number(e.target.value))}
                            className="w-16 px-2 py-1 rounded border text-center dark:bg-slate-950"
                          />
                          <button
                            type="submit"
                            className="bg-emerald-800 text-white p-1 rounded-lg hover:bg-emerald-700 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingProductId(product.id);
                            setRestockValue(product.stock);
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          Restock / Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 text-left space-y-6">
        <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <ClipboardCheck className="w-4.5 h-4.5 text-emerald-800 dark:text-emerald-400" />
            Digital Wallet Receipt auditor
          </h3>
          <p className="text-xs text-slate-500 mt-1">Review applicant shopping baskets and matching screenshots uploaded from GCash. Click verification to complete GAAP ledgers.</p>
          {selectedMonth && (
            <button
              onClick={() => setSelectedMonth(null)}
              className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
            >
              Filtered to {selectedMonth.label} {selectedMonth.year} <X className="w-3 h-3" />
            </button>
          )}
        </div>
          {auditOrders.length > AUDIT_PREVIEW_COUNT && (
            <button
              onClick={() => setShowAllAuditOrders(v => !v)}
              className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-emerald-800 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer transition-colors whitespace-nowrap"
            >
              {showAllAuditOrders ? 'Hide' : `View all (${auditOrders.length})`}
            </button>
          )}
        </div>

        {auditOrders.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">{selectedMonth ? 'No orders in this month.' : 'No order logs received.'}</p>
        ) : (
          <div className="space-y-4">
            {visibleAuditOrders.map(order => (
              <div key={order.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#fdfbf6]/20 dark:bg-slate-950/20 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">

                <div className="md:col-span-4 space-y-1.5 text-xs text-left">
                  <div className="flex gap-2 items-center">
                    <span className="font-bold text-slate-900 dark:text-white">{order.id}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      order.status === 'Rejected' ? 'bg-rose-100 text-rose-800'
                        : order.status === 'Cancelled' ? 'bg-slate-200 text-slate-600'
                        : FULFILLMENT_STATUSES.includes(order.status) ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-slate-500">Buyer: <span className="font-semibold text-slate-800 dark:text-slate-300">{order.buyerName}</span></p>
                  <p className="text-slate-500">Address: <span className="font-light">{order.shippingAddress}</span></p>
                  <p className="text-[10px] text-slate-400">Filed time: {new Date(order.orderedAt).toLocaleString()}</p>
                </div>

                <div className="md:col-span-4 space-y-1 text-xs">
                  <p className="font-bold text-slate-600 uppercase text-[10px]">Purchase detail:</p>
                  {order.items.map((itm, i) => (
                    <div key={i} className="flex justify-between border-b pb-0.5 border-dashed border-slate-200">
                      <span>{itm.productName} (x{itm.quantity})</span>
                      <span className="font-mono text-slate-500">₱{(itm.price * itm.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold pt-1 text-emerald-800 dark:text-emerald-400">
                    <span>Total Amount Paid</span>
                    <span>₱{order.totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="md:col-span-4 space-y-2 text-xs text-right flex flex-col items-end">
                  <p className="font-bold text-slate-600 uppercase text-[10px] text-right">Audit Credentials:</p>
                  <div className="flex items-center gap-2 p-1.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-slate-700 dark:text-slate-300 font-mono text-[10px]">
                    <Upload className="w-3.5 h-3.5 text-amber-600" /> screenshot_receipt_gcash.jpg
                  </div>
                  <p className="text-slate-400 text-[10px] font-mono">Ref RefID: {order.referenceNumber}</p>

                  {order.status === 'Pending Verification' && (
                    <button
                      onClick={() => {
                        onVerifyOrder(order.id);
                        onToast(`Order ${order.id} verification completed. Receipt verified by admin!`, 'success');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                    >
                      Verify and Complete GAAP Order
                    </button>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
