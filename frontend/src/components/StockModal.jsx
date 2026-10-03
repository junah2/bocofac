import React, { useEffect, useState } from 'react';
import { Boxes, History, ArrowRight } from 'lucide-react';
import AdminModal from './AdminModal';
import { productCode } from '../utils/productCode';
import { STOCK_ACTIONS, MOVEMENT_LABELS, reorderLevelOf } from '../utils/stock';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

const formatDateTime = (value) => new Date(value).toLocaleString('en-PH', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});

// [INVENTORY] Pag-update ng stock na may dahilan + kasaysayan ng lahat ng galaw ng stock ng product
export default function StockModal({ product, initialView = 'update', onClose, onSubmit }) {
  const [view, setView] = useState(initialView);
  const [reason, setReason] = useState('restock');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState('');

  const action = STOCK_ACTIONS.find((a) => a.reason === reason);
  const qty = quantity === '' ? NaN : Number(quantity);
  const validQty = Number.isInteger(qty) && qty >= 0 && (action.sign === 0 || qty > 0);
  const newStock = !validQty ? null : action.sign === 0 ? qty : product.stock + action.sign * qty;
  const reorderLevel = reorderLevelOf(product);

  useEffect(() => {
    if (view !== 'history') return undefined;
    let cancelled = false;
    setHistory(null);
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
      setError(action.sign === 0 ? 'Enter the exact number of items you counted.' : 'Enter how many items, at least 1.');
      return;
    }
    if (newStock < 0) {
      setError(`You only have ${product.stock} ${product.unit || ''} in stock.`);
      return;
    }
    if (newStock === product.stock) {
      setError('That leaves the stock unchanged.');
      return;
    }
    setSaving(true);
    try {
      const ok = await onSubmit(product.id, newStock, { reason, note: note.trim() });
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

  return (
    <AdminModal
      eyebrow={productCode(product)}
      icon={Boxes}
      title={product.name}
      subtitle={`${product.stock.toLocaleString()} ${product.unit || ''} in stock · reorder at ${reorderLevel}`}
      onClose={onClose}
      maxWidth="max-w-xl"
    >
      <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 mb-5">
        <button type="button" className={tabClass('update')} onClick={() => setView('update')}><Boxes className="w-3.5 h-3.5" /> Update Stock</button>
        <button type="button" className={tabClass('history')} onClick={() => setView('history')}><History className="w-3.5 h-3.5" /> History</button>
      </div>

      {view === 'update' ? (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">What happened?</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STOCK_ACTIONS.map((a) => (
                <button
                  key={a.reason}
                  type="button"
                  onClick={() => { setReason(a.reason); setError(''); }}
                  className={`text-left px-3 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer transition ${
                    reason === a.reason
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <span className={`mr-1.5 font-extrabold ${a.sign > 0 ? 'text-emerald-600' : a.sign < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {a.sign > 0 ? '+' : a.sign < 0 ? '−' : '='}
                  </span>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="stock-qty" className="block text-xs font-bold text-slate-500 mb-1.5">
                {action.sign === 0 ? 'Actual count on hand' : action.sign > 0 ? 'Items added' : 'Items removed'}
              </label>
              <input
                id="stock-qty"
                type="number"
                min="0"
                step="1"
                autoFocus
                value={quantity}
                onChange={(e) => { setQuantity(e.target.value); setError(''); }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              />
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-4 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">New stock</p>
              <p className="flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-white">
                <span className="text-slate-400 font-bold">{product.stock}</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <span className={newStock !== null && newStock <= reorderLevel ? 'text-rose-600' : ''}>{newStock ?? '—'}</span>
              </p>
            </div>
          </div>
          <div>
            <label htmlFor="stock-note" className="block text-xs font-bold text-slate-500 mb-1.5">Note (optional)</label>
            <input
              id="stock-note"
              placeholder="e.g. Delivery from Barangay Tanawan farmers, DR #1023"
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
          </div>
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 cursor-pointer disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Stock Update'}
          </button>
          <p className="text-[11px] text-slate-400 text-center">Online orders and walk-in sales lower the stock on their own and appear in History.</p>
        </div>
      ) : (
        <div>
          {historyError && <p className="text-sm text-rose-600">{historyError}</p>}
          {!history && !historyError && <p className="text-sm text-slate-400 py-6 text-center">Loading history...</p>}
          {history && history.length === 0 && (
            <p className="text-sm text-slate-400 py-6 text-center">No stock changes recorded yet. Changes made from now on will show here.</p>
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
                      {MOVEMENT_LABELS[m.reason] || m.reason}
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
