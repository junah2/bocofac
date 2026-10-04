import React, { useEffect, useState } from 'react';
import { Boxes, History, Plus, Minus, ArrowRight, ShoppingCart } from 'lucide-react';
import AdminModal from './AdminModal';
import { productCode } from '../utils/productCode';
import { MOVEMENT_LABELS, reorderLevelOf } from '../utils/stock';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

const formatDateTime = (value) => new Date(value).toLocaleString('en-PH', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});
// Ang manual na dagdag ay "restock", ang manual na bawas ay "adjustment" (nakatala sa history)
const movementLabel = (m) => (m.reason === 'adjustment' ? (m.change > 0 ? 'Stock added' : 'Stock removed') : MOVEMENT_LABELS[m.reason] || m.reason);

// [INVENTORY] Simpleng pag-update ng stock (dagdag o bawas) + kasaysayan ng lahat ng galaw ng stock.
// Ang order ng customer, cancel/reject at walk-in sale ay kusang nagbabago ng stock sa backend.
export default function StockModal({ product, initialView = 'update', onClose, onSubmit }) {
  const [view, setView] = useState(initialView);
  const [mode, setMode] = useState('add');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState('');

  const qty = quantity === '' ? NaN : Number(quantity);
  const validQty = Number.isInteger(qty) && qty > 0;
  const sign = mode === 'add' ? 1 : -1;
  const newStock = validQty ? product.stock + sign * qty : null;
  const reorderLevel = reorderLevelOf(product);

  // Kinukuha ulit ang history tuwing nagbabago ang stock (hal. may bagong order ang customer)
  useEffect(() => {
    if (view !== 'history') return undefined;
    let cancelled = false;
    setHistoryError('');
    fetch(`${API_BASE}/products/${product.id}/stock-movements`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data.error || 'Could not load the stock history.');
        if (!cancelled) setHistory(data);
      })
      .catch((err) => { if (!cancelled) setHistoryError(err.message); });
    return () => { cancelled = true; };
  }, [view, product.id, product.stock]);

  const submit = async () => {
    setError('');
    if (!validQty) {
      setError('Enter how many items, at least 1.');
      return;
    }
    if (newStock < 0) {
      setError(`You can only remove up to ${product.stock.toLocaleString()} ${product.unit || ''}.`);
      return;
    }
    setSaving(true);
    try {
      const ok = await onSubmit(product.id, newStock, { reason: mode === 'add' ? 'restock' : 'adjustment', note: note.trim() });
      if (ok) {
        setQuantity('');
        setNote('');
        setView('history');
      }
    } finally {
      setSaving(false);
    }
  };

  const tabClass = (key) => `flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
    view === key ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
  }`;
  const modeClass = (key, active) => `flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold cursor-pointer transition ${
    active
      ? key === 'add' ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:border-slate-300'
  }`;

  return (
    <AdminModal
      eyebrow={productCode(product)}
      icon={Boxes}
      title={product.name}
      subtitle={`${product.stock.toLocaleString()} ${product.unit || ''} in stock · reorder at ${reorderLevel}`}
      onClose={onClose}
      maxWidth="max-w-lg"
    >
      <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 mb-5">
        <button type="button" className={tabClass('update')} onClick={() => setView('update')}><Boxes className="w-3.5 h-3.5" /> Update Stock</button>
        <button type="button" className={tabClass('history')} onClick={() => setView('history')}><History className="w-3.5 h-3.5" /> History</button>
      </div>

      {view === 'update' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3" role="group" aria-label="Add or remove stock">
            <button type="button" onClick={() => { setMode('add'); setError(''); }} aria-pressed={mode === 'add'} className={modeClass('add', mode === 'add')}>
              <Plus className="w-4 h-4" /> Add stock
            </button>
            <button type="button" onClick={() => { setMode('remove'); setError(''); }} aria-pressed={mode === 'remove'} className={modeClass('remove', mode === 'remove')}>
              <Minus className="w-4 h-4" /> Remove stock
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label htmlFor="stock-qty" className="block text-xs font-bold text-slate-500 mb-1.5">
                How many {mode === 'add' ? 'to add' : 'to remove'}?
              </label>
              <input
                id="stock-qty"
                type="number"
                min="1"
                step="1"
                autoFocus
                placeholder="0"
                value={quantity}
                onChange={(e) => { setQuantity(e.target.value); setError(''); }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg font-bold"
              />
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">New stock</p>
              <p className="flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-white">
                <span className="text-slate-400 font-bold">{product.stock.toLocaleString()}</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <span className={newStock !== null && (newStock < 0 || newStock <= reorderLevel) ? 'text-rose-600' : ''}>{newStock === null ? '—' : newStock.toLocaleString()}</span>
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="stock-note" className="block text-xs font-bold text-slate-500 mb-1.5">Note (optional)</label>
            <input
              id="stock-note"
              placeholder={mode === 'add' ? 'e.g. New delivery from farmers' : 'e.g. Damaged during storage'}
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          </div>
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className={`w-full px-4 py-3 rounded-xl text-white text-sm font-bold cursor-pointer disabled:opacity-60 ${mode === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
          >
            {saving ? 'Saving...' : mode === 'add' ? 'Add to Stock' : 'Remove from Stock'}
          </button>
          <p className="flex items-start gap-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-2.5 text-[11px] text-emerald-900 dark:text-emerald-200">
            <ShoppingCart className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Customer orders and walk-in sales lower the stock automatically, and cancelled or rejected orders put it back. You only need this for deliveries and losses.
          </p>
        </div>
      ) : (
        <div>
          {historyError && <p className="text-sm text-rose-600">{historyError}</p>}
          {!history && !historyError && <p className="text-sm text-slate-400 py-6 text-center">Loading history...</p>}
          {history && history.length === 0 && (
            <p className="text-sm text-slate-400 py-6 text-center">No stock changes recorded yet. Orders and stock updates from now on will show here.</p>
          )}
          {history && history.length > 0 && (
            <ol className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.map((m) => (
                <li key={m.id} className="py-3 flex items-start gap-3">
                  <span className={`shrink-0 w-14 text-right font-extrabold tabular-nums ${m.change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {m.change > 0 ? '+' : '−'}{Math.abs(m.change).toLocaleString()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {movementLabel(m)}
                      {m.orderId && <span className="ml-1.5 font-mono text-[11px] text-slate-400">{m.orderId}</span>}
                    </p>
                    {m.note && <p className="text-xs text-slate-500 dark:text-slate-400">{m.note}</p>}
                    <p className="text-[11px] text-slate-400">{formatDateTime(m.createdAt)}{m.actor ? ` · ${m.actor}` : ''}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400 whitespace-nowrap">→ {m.stockAfter.toLocaleString()} left</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </AdminModal>
  );
}
