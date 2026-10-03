import React, { useMemo, useState } from 'react';
import { Store, Plus, Trash2 } from 'lucide-react';
import AdminModal from './AdminModal';
import { productCode } from '../utils/productCode';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
const MEMBER_DISCOUNT = 0.10;
const peso = (n) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// Petsa ngayon sa Pilipinas (YYYY-MM-DD) - hindi pwedeng lumampas dito
const todayPH = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
const newLine = () => ({ key: Math.random().toString(36).slice(2), productId: '', quantity: '1', price: '' });

// [WALK-IN SALE] Form para itala ang benta sa opisina/tindahan: bawas sa stock, kasama sa sales at analytics
export default function WalkInSaleModal({ products, onClose, onRecorded }) {
  const [soldAt, setSoldAt] = useState(todayPH());
  const [lines, setLines] = useState([newLine()]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [memberDiscount, setMemberDiscount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const sortedProducts = useMemo(() => products.slice().sort((a, b) => a.name.localeCompare(b.name)), [products]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const updateLine = (key, patch) => {
    setError('');
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };
  const pickProduct = (key, productId) => {
    const p = byId.get(productId);
    updateLine(key, { productId, price: p ? String(p.salePrice ?? p.price) : '' });
  };

  const subtotal = lines.reduce((sum, l) => {
    const qty = Number(l.quantity);
    const price = Number(l.price);
    return l.productId && qty > 0 && price >= 0 ? sum + qty * price : sum;
  }, 0);
  const total = Math.round(subtotal * (memberDiscount ? 1 - MEMBER_DISCOUNT : 1) * 100) / 100;
  const usedIds = new Set(lines.map((l) => l.productId).filter(Boolean));

  const submit = async () => {
    setError('');
    const filled = lines.filter((l) => l.productId);
    if (filled.length === 0) return setError('Pick at least one product.');
    for (const l of filled) {
      const p = byId.get(l.productId);
      const qty = Number(l.quantity);
      if (!Number.isInteger(qty) || qty < 1) return setError(`Enter a whole-number quantity for ${p.name}.`);
      if (qty > p.stock) return setError(`Only ${p.stock} ${p.unit || ''} of ${p.name} left in stock.`);
      if (l.price === '' || Number(l.price) < 0) return setError(`Enter the price for ${p.name}.`);
    }
    if (!soldAt || soldAt > todayPH()) return setError('The sale date cannot be in the future.');

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/orders/walk-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          soldAt,
          paymentMethod,
          referenceNumber: paymentMethod === 'GCash' ? referenceNumber.trim() : undefined,
          buyerName: buyerName.trim() || undefined,
          memberDiscount,
          items: filled.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), price: Number(l.price) })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not record the sale.');
      onRecorded(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm';

  return (
    <AdminModal
      eyebrow="Walk-in Sale"
      icon={Store}
      title="Record a Walk-in Sale"
      subtitle="For items bought at the office or store. The stock goes down and the sale counts in Sales Records and Analytics."
      onClose={onClose}
      maxWidth="max-w-3xl"
      footer={(
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</p>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{peso(total)}</p>
            {memberDiscount && subtotal > 0 && <p className="text-[11px] text-slate-400">{peso(subtotal)} less 10% member discount</p>}
          </div>
          {error && <p className="text-xs font-semibold text-rose-600 sm:max-w-xs">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 cursor-pointer disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Record Sale'}
          </button>
        </div>
      )}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="walkin-date" className="block text-xs font-bold text-slate-500 mb-1.5">Date of sale</label>
            <input id="walkin-date" type="date" max={todayPH()} value={soldAt} onChange={(e) => setSoldAt(e.target.value)} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="walkin-buyer" className="block text-xs font-bold text-slate-500 mb-1.5">Buyer name (optional)</label>
            <input id="walkin-buyer" placeholder="Walk-in Customer" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-500 mb-1.5">Items sold</p>
          <div className="space-y-2">
            {lines.map((l) => {
              const p = byId.get(l.productId);
              const lineTotal = p && Number(l.quantity) > 0 && l.price !== '' ? Number(l.quantity) * Number(l.price) : null;
              return (
                <div key={l.key} className="grid grid-cols-12 gap-2 items-start rounded-xl border border-slate-100 dark:border-slate-800 p-2.5">
                  <div className="col-span-12 sm:col-span-6">
                    <select aria-label="Product" value={l.productId} onChange={(e) => pickProduct(l.key, e.target.value)} className={inputClass}>
                      <option value="">Choose a product...</option>
                      {sortedProducts.map((sp) => (
                        <option key={sp.id} value={sp.id} disabled={sp.stock <= 0 || (usedIds.has(sp.id) && sp.id !== l.productId)}>
                          {productCode(sp)} · {sp.name} ({sp.stock} left)
                        </option>
                      ))}
                    </select>
                    {p && <p className="text-[11px] text-slate-400 mt-1">{p.stock} {p.unit} in stock</p>}
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input aria-label="Quantity" type="number" min="1" step="1" placeholder="Qty" value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: e.target.value })} className={inputClass} />
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    <input aria-label="Price each" type="number" min="0" step="0.01" placeholder="Price ₱" value={l.price} onChange={(e) => updateLine(l.key, { price: e.target.value })} className={inputClass} />
                  </div>
                  <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1.5 pt-2">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{lineTotal !== null ? peso(lineTotal) : '—'}</span>
                    {lines.length > 1 && (
                      <button type="button" aria-label="Remove item" onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} className="p-1 rounded-md text-slate-400 hover:text-rose-600 cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => setLines((prev) => [...prev, newLine()])} className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Add another product
          </button>
          <p className="text-[11px] text-slate-400 mt-1">The price is filled in from the store price. Change it if this buyer got a different price.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1.5">Payment</p>
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              {['Cash', 'GCash'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${paymentMethod === m ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            {paymentMethod === 'GCash' && (
              <input placeholder="GCash reference no. (optional)" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className={`${inputClass} mt-2`} />
            )}
          </div>
          <label className="flex items-start gap-2.5 rounded-xl border border-slate-100 dark:border-slate-800 p-3 cursor-pointer">
            <input type="checkbox" checked={memberDiscount} onChange={(e) => setMemberDiscount(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-600" />
            <span>
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Coop member</span>
              <span className="block text-[11px] text-slate-400">Apply the 10% member discount</span>
            </span>
          </label>
        </div>
      </div>
    </AdminModal>
  );
}
