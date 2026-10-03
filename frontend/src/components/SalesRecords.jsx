import React, { useEffect, useMemo, useState } from 'react';
import { Store, Printer, Download, Receipt, Package, PhilippinePeso, ShoppingBag } from 'lucide-react';
import SearchBar, { matchesSearch } from './SearchBar';
import MobileScrollHint from './MobileScrollHint';
import WalkInSaleModal from './WalkInSaleModal';
import { productCode } from '../utils/productCode';
import { REALIZED_ORDER_STATUSES } from '../utils/forecast';
import { printSalesRecords } from '../utils/printDocument';

const PAGE_SIZE = 50;
const peso = (n) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const displayDate = (d) => d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];
const SOURCES = [
  { key: 'all', label: 'All sales' },
  { key: 'walk-in', label: 'Walk-in' },
  { key: 'online', label: 'Online' },
];

// Simula at dulo (YYYY-MM-DD, kasama ang dulo) ng napiling panahon
function periodRange(key, now = new Date()) {
  const today = ymd(now);
  if (key === 'today') return { from: today, to: today };
  if (key === 'week') return { from: ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), to: today };
  if (key === 'month') return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  if (key === 'year') return { from: `${now.getFullYear()}-01-01`, to: today };
  return { from: '', to: '' };
}

// [SALES RECORDS] Bawat item na nabenta (isang linya bawat product sa bawat order)
function buildSaleLines(orders, products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = [];
  orders
    .filter((o) => REALIZED_ORDER_STATUSES.includes(o.status))
    .forEach((o) => {
      const date = new Date(o.orderedAt);
      (o.items || []).forEach((item, i) => {
        const product = byId.get(item.productId);
        lines.push({
          key: `${o.id}-${i}`,
          orderId: o.id,
          date,
          day: ymd(date),
          productId: item.productId,
          code: product ? productCode(product) : '—',
          productName: item.productName,
          category: product ? product.category : 'Other',
          quantity: item.quantity,
          price: item.price,
          total: Math.round(item.price * item.quantity * 100) / 100,
          buyer: o.buyerName,
          channel: o.channel || (o.id.startsWith('HIST-') ? 'walk-in' : 'online'),
          paymentMethod: o.paymentMethod,
        });
      });
    });
  return lines.sort((a, b) => b.date - a.date || a.key.localeCompare(b.key));
}

function downloadCsv(lines, filename) {
  const header = ['Date', 'Order', 'Product ID', 'Product', 'Category', 'Quantity', 'Unit Price', 'Line Total', 'Buyer', 'Source', 'Payment'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = lines.map((l) => [l.day, l.orderId, l.code, l.productName, l.category, l.quantity, l.price.toFixed(2), l.total.toFixed(2), l.buyer, l.channel, l.paymentMethod].map(esc).join(','));
  const blob = new Blob([`﻿${[header.map(esc).join(','), ...rows].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SummaryTile({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        <Icon className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> {label}
      </p>
      <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1 whitespace-nowrap">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

export default function SalesRecords({ orders, products, onWalkInRecorded }) {
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [source, setSource] = useState('all');
  const [category, setCategory] = useState('all');
  const [productId, setProductId] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showWalkIn, setShowWalkIn] = useState(false);

  const allLines = useMemo(() => buildSaleLines(orders, products), [orders, products]);
  const range = period === 'custom' ? { from: customFrom, to: customTo } : periodRange(period);
  const categories = useMemo(() => [...new Set(allLines.map((l) => l.category))].sort(), [allLines]);
  const productOptions = useMemo(() => {
    const seen = new Map();
    allLines.forEach((l) => {
      if ((category === 'all' || l.category === category) && !seen.has(l.productId)) seen.set(l.productId, l);
    });
    return [...seen.values()].sort((a, b) => a.productName.localeCompare(b.productName));
  }, [allLines, category]);

  const lines = useMemo(() => allLines.filter((l) => (
    (!range.from || l.day >= range.from)
    && (!range.to || l.day <= range.to)
    && (source === 'all' || l.channel === source)
    && (category === 'all' || l.category === category)
    && (productId === 'all' || l.productId === productId)
    && matchesSearch(search, l.orderId, l.productName, l.code, l.buyer)
  )), [allLines, range.from, range.to, source, category, productId, search]);

  useEffect(() => { setPage(0); }, [period, customFrom, customTo, source, category, productId, search]);

  const summary = useMemo(() => {
    const orderIds = new Set();
    let units = 0;
    let amount = 0;
    let walkInAmount = 0;
    lines.forEach((l) => {
      orderIds.add(l.orderId);
      units += l.quantity;
      amount += l.total;
      if (l.channel === 'walk-in') walkInAmount += l.total;
    });
    const byProduct = new Map();
    lines.forEach((l) => {
      const row = byProduct.get(l.productId) || { code: l.code, name: l.productName, category: l.category, quantity: 0, total: 0 };
      row.quantity += l.quantity;
      row.total += l.total;
      byProduct.set(l.productId, row);
    });
    return {
      transactions: orderIds.size,
      units,
      amount,
      walkInShare: amount > 0 ? Math.round((walkInAmount / amount) * 1000) / 10 : 0,
      products: [...byProduct.values()].sort((a, b) => b.total - a.total),
    };
  }, [lines]);

  const rangeLabel = range.from || range.to
    ? `${range.from ? displayDate(new Date(`${range.from}T00:00`)) : 'Start'} – ${range.to ? displayDate(new Date(`${range.to}T00:00`)) : 'Today'}`
    : 'All time';
  const filterLabel = [
    source !== 'all' && SOURCES.find((s) => s.key === source).label,
    category !== 'all' && category,
    productId !== 'all' && productOptions.find((p) => p.productId === productId)?.productName,
    search && `"${search}"`,
  ].filter(Boolean).join(' · ');

  const pageCount = Math.max(1, Math.ceil(lines.length / PAGE_SIZE));
  const pageLines = lines.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selectClass = 'px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 cursor-pointer';
  const chipClass = (active) => `px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition ${
    active ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
  }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <p className="text-xs text-slate-500 max-w-xl">
          Every item sold, online and walk-in. Pick a date range and filters, then print or download the report.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowWalkIn(true)} className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5" /> Record Walk-in Sale
          </button>
          <button
            onClick={() => printSalesRecords(lines, { rangeLabel, filterLabel, summary })}
            disabled={lines.length === 0}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-3.5 h-3.5" /> Print Report
          </button>
          <button
            onClick={() => downloadCsv(lines, `bocofac-sales-${range.from || 'start'}-to-${range.to || 'today'}.csv`)}
            disabled={lines.length === 0}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" /> Excel / CSV
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" onClick={() => setPeriod(p.key)} className={chipClass(period === p.key)}>{p.label}</button>
          ))}
          {period === 'custom' && (
            <span className="flex items-center gap-2 text-xs text-slate-500">
              <input type="date" aria-label="From" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} className={selectClass} />
              to
              <input type="date" aria-label="To" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} className={selectClass} />
            </span>
          )}
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)} className={selectClass}>
            {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setProductId('all'); }} className={selectClass}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select aria-label="Product" value={productId} onChange={(e) => setProductId(e.target.value)} className={`${selectClass} md:max-w-xs`}>
            <option value="all">All products</option>
            {productOptions.map((p) => <option key={p.productId} value={p.productId}>{p.productName}</option>)}
          </select>
          <div className="flex-1 min-w-0">
            <SearchBar value={search} onChange={setSearch} placeholder="Search order, product or buyer" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryTile icon={Receipt} label="Transactions" value={summary.transactions.toLocaleString()} sub={rangeLabel} />
        <SummaryTile icon={Package} label="Units Sold" value={summary.units.toLocaleString()} sub={`${summary.products.length} product${summary.products.length === 1 ? '' : 's'}`} />
        <SummaryTile icon={PhilippinePeso} label="Sales Amount" value={peso(summary.amount)} sub="Item prices, before member discount & shipping" />
        <SummaryTile icon={ShoppingBag} label="Walk-in Share" value={`${summary.walkInShare}%`} sub={`${Math.round((100 - summary.walkInShare) * 10) / 10}% online`} />
      </div>

      <MobileScrollHint />
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
            <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
              <th className="p-3 pl-4 font-bold">Date</th>
              <th className="p-3 font-bold">Order</th>
              <th className="p-3 font-bold">Product</th>
              <th className="p-3 font-bold text-right">Qty</th>
              <th className="p-3 font-bold text-right">Price</th>
              <th className="p-3 font-bold text-right">Total</th>
              <th className="p-3 font-bold">Buyer</th>
              <th className="p-3 pr-4 font-bold">Source</th>
            </tr>
          </thead>
          <tbody>
            {pageLines.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-sm text-slate-400">No sales match these filters.</td></tr>
            )}
            {pageLines.map((l) => (
              <tr key={l.key} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                <td className="p-3 pl-4 whitespace-nowrap text-slate-600 dark:text-slate-300">{displayDate(l.date)}</td>
                <td className="p-3 whitespace-nowrap font-mono text-xs text-slate-500">{l.orderId}</td>
                <td className="p-3">
                  <p className="font-semibold text-slate-900 dark:text-white">{l.productName}</p>
                  <p className="text-[11px] text-slate-400">{l.code} · {l.category}</p>
                </td>
                <td className="p-3 text-right tabular-nums">{l.quantity.toLocaleString()}</td>
                <td className="p-3 text-right tabular-nums whitespace-nowrap text-slate-500">{peso(l.price)}</td>
                <td className="p-3 text-right tabular-nums whitespace-nowrap font-bold text-slate-900 dark:text-white">{peso(l.total)}</td>
                <td className="p-3 text-slate-600 dark:text-slate-300 max-w-[180px] truncate">{l.buyer}</td>
                <td className="p-3 pr-4 whitespace-nowrap">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${l.channel === 'walk-in' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
                    {l.channel === 'walk-in' ? 'Walk-in' : 'Online'}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">{l.paymentMethod}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lines.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Showing {(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min(lines.length, (page + 1) * PAGE_SIZE).toLocaleString()} of {lines.length.toLocaleString()} items</span>
          <div className="flex gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
            <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      )}

      {showWalkIn && (
        <WalkInSaleModal
          products={products}
          onClose={() => setShowWalkIn(false)}
          onRecorded={(order) => {
            setShowWalkIn(false);
            onWalkInRecorded(order);
          }}
        />
      )}
    </div>
  );
}
