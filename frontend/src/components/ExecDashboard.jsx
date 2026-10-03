import React, { useState } from 'react';
import { Sparkles, BarChart3 } from 'lucide-react';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import BusiestOrderingDays from './BusiestOrderingDays';

const CHART_PALETTE = {
  light: {
    grid: '#e2e8f0',
    axis: '#94a3b8',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e2e8f0',
    tooltipText: '#0f172a',
    revenue: '#2f6f4b',
    stock: '#2f6f4b',
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
    revenue: '#64a67c',
    stock: '#64a67c',
    sold: '#fbbf24',
    views: '#818cf8',
    highlight: '#fbbf24',
  },
};

export default function ExecDashboard({
  products,
  orders = [],
  isDarkMode,
}) {
  const [selectedChartType, setSelectedChartType] = useState('sales');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [showAllProducts, setShowAllProducts] = useState(false);

  const palette = CHART_PALETTE[isDarkMode ? 'dark' : 'light'];

  // [RANKING] Top 5 best-selling products (sorted ayon sa dami ng nabenta)
  const topSellingProducts = [...products]
    .sort((a, b) => b.ordersCount - a.ordersCount)
    .slice(0, 5);

  // [ANALYTICS] Product Performance: nabenta (o views) bawat product, pinakamarami muna
  const PRODUCT_PREVIEW_COUNT = 8;
  const isSales = selectedChartType === 'sales';
  const metricKey = isSales ? 'ordersCount' : 'views';
  const rankedProducts = [...products].sort((a, b) => b[metricKey] - a[metricKey]);
  const visibleProducts = showAllProducts ? rankedProducts : rankedProducts.slice(0, PRODUCT_PREVIEW_COUNT);
  const maxMetric = Math.max(...rankedProducts.map((p) => p[metricKey]), 1);

  const toggleProduct = (productId) => {
    setSelectedProductId(prev => (prev === productId ? null : productId));
  };

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4 text-left">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                Product Performance
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {isSales ? 'Units sold per product, highest first.' : 'How many times each product page was viewed in the store.'} Click a product to highlight it in the leaderboard.
              </p>
            </div>
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1" role="group" aria-label="Product metric">
              {[
                { key: 'sales', label: 'Units Sold' },
                { key: 'conversion', label: 'Product Views' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSelectedChartType(t.key)}
                  aria-pressed={selectedChartType === t.key}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap ${
                    selectedChartType === t.key ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-950 dark:text-emerald-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="space-y-1">
            {visibleProducts.map((p, i) => {
              const value = p[metricKey];
              const selected = selectedProductId === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggleProduct(p.id)}
                    aria-pressed={selected}
                    className={`w-full flex items-center gap-3 p-2 rounded-xl text-left cursor-pointer transition ${
                      selected ? 'bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="w-5 text-xs font-bold text-slate-400 tabular-nums text-center shrink-0">{i + 1}</span>
                    <img src={resolveImageUrl(p.image)} alt="" className="w-10 h-10 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100 line-clamp-2 sm:line-clamp-1">{p.name.trim()}</p>
                      <p className="text-[11px] text-slate-400">{p.category}</p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.max((value / maxMetric) * 100, value > 0 ? 2 : 0)}%`, background: isSales ? palette.sold : palette.views }}
                          />
                        </div>
                        <span className="w-20 sm:w-24 text-right text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap">
                          {value.toLocaleString()} {isSales ? 'sold' : value === 1 ? 'view' : 'views'}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {rankedProducts.length > PRODUCT_PREVIEW_COUNT && (
            <button
              type="button"
              onClick={() => setShowAllProducts((v) => !v)}
              className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              {showAllProducts ? `Show top ${PRODUCT_PREVIEW_COUNT} only` : `Show all ${rankedProducts.length} products`}
            </button>
          )}
        </div>

        <div className="lg:col-span-5 space-y-6">

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

          <BusiestOrderingDays orders={orders} isDarkMode={isDarkMode} />

        </div>

      </div>
    </div>
  );
}
