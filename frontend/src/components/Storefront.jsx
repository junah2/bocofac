import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  ChevronRight,
  ArrowLeft,
  Check,
  Trash2,
  Plus,
  Minus,
  Upload,
  Sparkles,
  Info,
  X,
  UserPlus
} from 'lucide-react';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import {
  FOCUS_PROVINCES, OTHER_PROVINCE_OPTION, HOME_PROVINCE, HOME_CITY,
  CITIES_BY_PROVINCE, BARANGAYS_BY_CITY, detectShippingZone,
} from '../data/phAddress';
import { isValidPhone11, isValidGcashRef13, digitsOnly, validationBorderClass, extractDigitRuns, refNumberMatchesReceipt } from '../utils/validators';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

// Mirrors SHIPPING_ZONES in backend/src/routes/orders.routes.js - the fee
// actually charged is always recomputed server-side from the zone name, this
// copy is only for showing the customer a live total before they submit.
// Text shown above the variant dropdown - "Length" reads right for the husk
// poles, but a set like the sandok variants is really about which piece you
// want, so it needs its own wording per variant group instead of one
// hardcoded label for every group.
const VARIANT_SELECTOR_LABELS = {
  'coconut-husk-pole': 'Length',
  'coconut-sandok-set': 'Type',
};

const SHIPPING_ZONES = {
  'Within Town/Municipality': 50,
  'Neighboring Barangay (Lupi Border)': 50,
  'Same Province (Camarines Sur)': 100,
  'Camarines Norte': 200,
  'Outside Delivery Area': 350,
};

// Products sharing a variantGroup (e.g. the four "Coconut Husk Pole" lengths)
// collapse into one catalog entry with all their variants attached, so the
// grid renders one card with a size dropdown instead of one redundant card
// per length. Every other product (the vast majority) is unaffected - it
// just becomes a "group" of exactly one, which ProductCard below renders
// identically to how a single product always looked.
function groupProductsForDisplay(products) {
  const seenGroups = new Set();
  const items = [];
  for (const product of products) {
    if (product.variantGroup) {
      if (seenGroups.has(product.variantGroup)) continue;
      seenGroups.add(product.variantGroup);
      items.push({
        key: product.variantGroup,
        variants: products.filter(p => p.variantGroup === product.variantGroup),
      });
    } else {
      items.push({ key: product.id, variants: [product] });
    }
  }
  return items;
}

function ProductCard({ variants, isMember, memberPrice, onAddToCart, onViewDetail }) {
  const [selectedId, setSelectedId] = useState(variants[0].id);
  const product = variants.find(v => v.id === selectedId) || variants[0];
  const hasSizes = variants.length > 1;

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden hover-lift flex flex-col group relative">
      {/* Active product zoom thumbnail container */}
      <div className="h-48 overflow-hidden relative bg-slate-100 dark:bg-slate-950 block">
        <img
          src={resolveImageUrl(product.image)}
          alt={product.name}
          onClick={() => onViewDetail(product)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
        />
        <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur rounded-lg px-2.5 py-1 text-[10px] text-white font-mono uppercase tracking-wide">
          {product.category}
        </div>

        {product.discountPercent > 0 && (
          <div className="absolute top-3 right-3 bg-rose-600 rounded-lg px-2.5 py-1 text-[10px] text-white font-bold uppercase tracking-wide shadow-sm">
            Sale -{product.discountPercent}%
          </div>
        )}

        {/* Out of stock overlay badge */}
        {product.stock <= 0 && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center">
            <span className="text-xs font-bold text-rose-400 tracking-wider uppercase border border-rose-400 p-2 rounded-lg bg-rose-950/20">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-start gap-2">
            <h3
              onClick={() => onViewDetail(product)}
              className="font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors text-base cursor-pointer"
            >
              {hasSizes ? product.name.replace(/\s*\([^)]*\)\s*$/, '') : product.name}
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Size selector - only rendered when this catalog entry actually has more than one size/variant */}
        {hasSizes && (
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              {VARIANT_SELECTOR_LABELS[product.variantGroup] || 'Options'}
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-3 py-1.5 text-xs rounded-lg border bg-white dark:bg-slate-950 dark:border-slate-700 cursor-pointer"
            >
              {variants.map(v => (
                <option key={v.id} value={v.id} disabled={v.stock <= 0}>
                  {v.variantLabel}{v.stock <= 0 ? ' (Out of stock)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {!hasSizes && (
          <div className="flex flex-wrap gap-1">
            {product.specifications.slice(0, 2).map((s, i) => (
              <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 line-clamp-1 max-w-full">
                {s}
              </span>
            ))}
          </div>
        )}

        {product.stock > 0 && (
          <p className={`text-[11px] font-semibold ${product.stock <= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {product.stock <= 5 ? `Only ${product.stock} ${product.unit} left in stock` : `${product.stock} ${product.unit} in stock`}
          </p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div>
            <p className="text-xs text-slate-400 font-mono">Price per {product.unit}</p>
            {(() => {
              const hasPromo = product.discountPercent > 0;
              const basePrice = hasPromo ? product.salePrice : product.price;
              const finalPrice = isMember ? memberPrice(basePrice) : basePrice;
              return (hasPromo || isMember) ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-lg font-extrabold text-emerald-800 dark:text-emerald-400">
                    ₱{finalPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-400 line-through">₱{product.price.toLocaleString()}</p>
                  {hasPromo && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400">SALE -{product.discountPercent}%</span>
                  )}
                  {isMember && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">MEMBER -10%</span>
                  )}
                </div>
              ) : (
                <p className="text-lg font-extrabold text-emerald-800 dark:text-emerald-400">
                  ₱{product.price.toLocaleString()}
                </p>
              );
            })()}
          </div>
          <button
            onClick={() => onAddToCart(product)}
            disabled={product.stock <= 0}
            className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-medium text-xs transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" /> Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Storefront({ user, products, cart, setCart, onAddOrder, onToast, cartPanelOpen = false, onCloseCart, onRequireAccount }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCheckouting, setIsCheckouting] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [activeProductDetail, setActiveProductDetail] = useState(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [viewedAttachmentUrl, setViewedAttachmentUrl] = useState(null);
  const [showAccountRequiredModal, setShowAccountRequiredModal] = useState(false);

  // Manual payment state - prefilled for signed-in customers so a repeat
  // buyer never has to retype delivery details they already gave us once.
  const [recipientName, setRecipientName] = useState(user?.name || '');
  const [recipientEmail, setRecipientEmail] = useState(user?.email || '');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [province, setProvince] = useState('');
  const [cityMunicipality, setCityMunicipality] = useState('');
  const [barangay, setBarangay] = useState('');
  const [shippingZone, setShippingZone] = useState('');

  // Camarines Sur and Camarines Norte are the two provinces BOCOFAC actually
  // delivers to on a structured basis - both are populated down to full
  // City/Municipality + Barangay dropdowns (see src/data/phAddress.js).
  // Anything else still ships, just via the free-text "Other" fallback below
  // at the flat out-of-area rate.
  const isFocusProvince = FOCUS_PROVINCES.includes(province);
  const citiesForProvince = CITIES_BY_PROVINCE[province] || [];
  const barangaysForCity = BARANGAYS_BY_CITY[cityMunicipality] || [];

  const onProvinceChange = (e) => {
    setProvince(e.target.value);
    setCityMunicipality('');
    setBarangay('');
  };
  const onCityChange = (e) => {
    setCityMunicipality(e.target.value);
    setBarangay('');
  };

  const [paymentMethod, setPaymentMethod] = useState('GCash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [scanningReceipt, setScanningReceipt] = useState(false);
  // Digit runs OCR'd off the receipt itself (see handleReceiptUpload) - lets
  // the typed reference number be cross-checked against what the receipt
  // actually shows, not just its own 13-digit format.
  const [receiptDigitRuns, setReceiptDigitRuns] = useState(null);

  // Backend only stores/expects a single shippingAddress string - compose it
  // from the structured picks instead of changing its shape server-side.
  const shippingAddress = [streetAddress, barangay && `Barangay ${barangay}`, cityMunicipality, province]
    .filter(Boolean).join(', ');

  // Name/email come from the account instantly; phone/address aren't part
  // of the account itself, so restore them from this browser's own last
  // checkout instead of making a repeat buyer re-type it every time.
  // Deliberately NOT sourced from a past order's `shippingAddress` - that's
  // already a single flattened "street, Barangay X, city, province" string,
  // and re-seeding the free-text Street field with it would double up with
  // whatever province/city/barangay get picked for *this* order (each
  // checkout compounding the last into one ever-growing address). Storing
  // the still-separate fields client-side avoids that entirely.
  useEffect(() => {
    if (!user?.email) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`bocofac_last_shipping_${user.email}`) || 'null');
      if (!saved) return;
      setRecipientPhone(prev => prev || saved.phone || '');
      setStreetAddress(prev => prev || saved.streetAddress || '');
      setProvince(prev => prev || saved.province || '');
      setCityMunicipality(prev => prev || saved.cityMunicipality || '');
      setBarangay(prev => prev || saved.barangay || '');
    } catch {
      // Corrupt/missing localStorage entry - fall back to a blank form.
    }
  }, [user?.email]);

  // Re-detect the delivery zone every time the selected province/city/
  // barangay changes, so it never drifts out of sync with what was actually
  // picked (barangay matters for the Lupi-border discount).
  useEffect(() => {
    setShippingZone(detectShippingZone({ province, cityMunicipality, barangay }));
  }, [province, cityMunicipality, barangay]);

  const categories = ['All', 'Charcoal', 'Fertilizer', 'Fibre & Coir', 'Handicraft'];

  const filteredProducts = selectedCategory === 'All'
    ? products
    : products.filter(p => p.category === selectedCategory);

  const viewProductDetail = (product) => {
    setActiveProductDetail(product);
    // Fire-and-forget view counter, powers the Conv. Rate analytic on the
    // exec dashboard - a failed ping shouldn't block browsing.
    fetch(`${API_BASE}/products/${product.id}/view`, { method: 'POST' }).catch(() => {});
  };

  const addToCart = (product) => {
    if (!user) {
      setShowAccountRequiredModal(true);
      return;
    }
    if (product.stock <= 0) {
      onToast(`Sorry, ${product.name} is currently out of stock.`, 'error');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          onToast(`Maximum available stock (${product.stock} ${product.unit}) is already in your cart.`, 'error');
          return prev;
        }
        onToast(`Added another ${product.name} to cart.`, 'success');
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      onToast(`Added ${product.name} to cart.`, 'success');
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.product.stock) {
            onToast(`Cannot exceed physical stock of ${item.product.stock} units.`, 'error');
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
    onToast('Item removed from cart.', 'info');
  };

  // Coop members (accounts linked to an approved membership record) get 10%
  // off - a plain customer account with no memberId pays full price.
  const MEMBER_DISCOUNT_RATE = 0.10;
  const isMember = !!(user && user.memberId);
  const memberPrice = (price) => (isMember ? price * (1 - MEMBER_DISCOUNT_RATE) : price);
  // Admin-set promo (product.discountPercent/salePrice, from the Analytics
  // promo suggestions) is applied first, then the member discount stacks on
  // top of that - a member buying a promo item gets both.
  const effectivePrice = (product) => (product.discountPercent > 0 ? product.salePrice : product.price);

  // Broken out in three steps so the cart summary can itemize each discount
  // instead of silently folding the promo into "Subtotal" - a shopper needs
  // to see where the 25% (or whatever %) actually went, not just a smaller
  // number with no line explaining it.
  const cartOriginalTotal = cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  const cartSubtotal = cart.reduce((total, item) => total + (effectivePrice(item.product) * item.quantity), 0);
  const cartPromoDiscount = cartOriginalTotal - cartSubtotal;
  const memberDiscount = isMember ? cartSubtotal * MEMBER_DISCOUNT_RATE : 0;
  const shippingFee = SHIPPING_ZONES[shippingZone] ?? 0;
  const cartTotal = cartSubtotal - memberDiscount + shippingFee;

  // A valid GCash/bank transfer confirmation always carries some subset of
  // these words - a random unrelated photo won't, so requiring at least two
  // matches (not just one, which a lot of ordinary photos could accidentally
  // contain) is a decent filter for "does this actually look like a receipt"
  // without needing a real ML image classifier.
  const RECEIPT_OCR_KEYWORDS = [
    'gcash', 'reference', 'ref no', 'amount', 'transaction', 'payment',
    'sent', 'transfer', 'total', 'php', 'bank', 'received',
  ];

  // Screenshot upload - OCR'd client-side (tesseract.js, loaded on demand so
  // it doesn't bloat the initial bundle for shoppers who never reach
  // checkout) to reject obviously-unrelated images before they're even
  // attached. This is a content sanity check, not a substitute for the
  // admin's own manual verification of the reference number against the
  // actual GCash/bank screenshot.
  const handleReceiptUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // let picking the same file again re-trigger onChange
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onToast('Please upload an image (JPG, PNG, or WebP) of your payment receipt.', 'error');
      return;
    }

    setScanningReceipt(true);
    try {
      const { default: Tesseract } = await import('tesseract.js');
      const { data: { text } } = await Tesseract.recognize(file, 'eng');
      const normalized = text.toLowerCase();
      const matchCount = RECEIPT_OCR_KEYWORDS.filter((kw) => normalized.includes(kw)).length;
      if (matchCount < 2) {
        onToast("This doesn't look like a payment receipt screenshot. Please attach the actual GCash/bank transfer confirmation.", 'error');
        return;
      }
      setReceiptDigitRuns(extractDigitRuns(text));
      setReceiptFile(file);
      setReceiptPreview(URL.createObjectURL(file));
      onToast(`Receipt "${file.name}" looks valid and is attached. Ready for board audit.`, 'success');
    } catch (err) {
      onToast('Could not scan that image - please try a clearer screenshot of the receipt.', 'error');
    } finally {
      setScanningReceipt(false);
    }
  };

  const submitManualPayment = async (e) => {
    e.preventDefault();
    if (!recipientName || !recipientEmail || !streetAddress || !shippingZone) {
      onToast('Please fill out all required shipping fields.', 'error');
      return;
    }

    if (paymentMethod === 'GCash') {
      if (!referenceNumber) {
        onToast('Please fill out the transaction reference field.', 'error');
        return;
      }
      if (!isValidGcashRef13(referenceNumber)) {
        onToast('Transaction reference number must be exactly 13 digits.', 'error');
        return;
      }
      if (refNumberMatchesReceipt(receiptDigitRuns, referenceNumber) === false) {
        onToast("The reference number you entered doesn't match your attached receipt. Please double-check it.", 'error');
        return;
      }
      if (!receiptFile) {
        onToast('A digital payment screenshot (GCash receipt) is strictly required for manual verification.', 'error');
        return;
      }
    }

    setSubmittingOrder(true);
    try {
      const formData = new FormData();
      formData.append('buyerName', recipientName);
      formData.append('buyerEmail', recipientEmail);
      formData.append('phone', recipientPhone);
      formData.append('shippingAddress', shippingAddress);
      formData.append('shippingZone', shippingZone);
      formData.append('paymentMethod', paymentMethod);
      formData.append('items', JSON.stringify(cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
      }))));
      if (paymentMethod === 'GCash') {
        formData.append('referenceNumber', referenceNumber);
        formData.append('receipt', receiptFile);
      }

      // credentials: 'include' sends the signed-in customer's session cookie,
      // so the backend ties this order to their account (req.user.sub) - no
      // guest fallback needed when the shopper is actually logged in.
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const newOrder = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(newOrder.error || 'Failed to submit order.');

      // Remember this checkout's still-separate fields (not the flattened
      // `shippingAddress` sent above) for next time - see the prefill effect.
      if (user?.email) {
        localStorage.setItem(`bocofac_last_shipping_${user.email}`, JSON.stringify({
          phone: recipientPhone, streetAddress, province, cityMunicipality, barangay,
        }));
      }

      onAddOrder(newOrder);
      setCart([]);
      setIsCheckouting(false);
      setCheckoutStep(1);
      setReceiptFile(null);
      setReceiptPreview('');
      setReceiptDigitRuns(null);
      setReferenceNumber('');
      onToast(`Order ${newOrder.id} placed! We're verifying your payment now — please allow about a week for your order to be processed and delivered.`, 'success');
    } catch (err) {
      onToast(err.message || 'Failed to submit order.', 'error');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // An account is required to place an order (so the cooperative can follow
  // up on a disputed/wrong payment reference, and the buyer gets order
  // history). Gated at Add to Cart rather than only at checkout, so a guest
  // never builds up a cart they can't actually order - and kept here too as
  // a fallback in case a cart was already saved to localStorage from before
  // this account requirement existed.
  const handleProceedToCheckout = () => {
    if (!user) {
      setShowAccountRequiredModal(true);
      return;
    }
    setIsCheckouting(true);
  };

  // Cart summary content, shared between two placements: alone and centered
  // when just browsing with the cart opened, or docked beside the checkout
  // form (with its own "Proceed" button hidden mid-checkout) once the
  // customer has moved into isCheckouting - see the layout branches below.
  const cartPanelJSX = (
    <>
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-800 dark:text-emerald-400" />
            Basket Cart
          </h3>
          <button
            type="button"
            onClick={() => onCloseCart && onCloseCart()}
            aria-label="Close cart"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Your basket is empty</p>
              <p className="text-xs text-slate-400">Curate some organic items into your basket catalog above to check out.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto pr-1">
              {cart.map((item, index) => (
                <div key={item.product.id || index} className="py-3 flex gap-3 text-left">
                  <img
                    src={resolveImageUrl(item.product.image)}
                    alt={item.product.name}
                    className="w-12 h-12 rounded-lg object-cover bg-slate-50"
                  />
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-1">{item.product.name}</p>
                    <p className="text-xs text-emerald-800 dark:text-emerald-400 font-bold">₱{memberPrice(effectivePrice(item.product)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    <div className="flex items-center justify-between pt-1">
                      {/* Quantity selector */}
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                        <button
                          onClick={() => updateCartQuantity(item.product.id, -1)}
                          className="text-slate-500 hover:text-slate-800 transition"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-semibold w-4 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQuantity(item.product.id, 1)}
                          className="text-slate-500 hover:text-slate-800 transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      {/* Remove button */}
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-rose-500 hover:text-rose-700 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between text-xs text-slate-500">
                <p>Subtotal</p>
                <p>₱{cartOriginalTotal.toLocaleString()}</p>
              </div>
              {cartPromoDiscount > 0 && (
                <div className="flex justify-between text-xs text-rose-600 font-semibold">
                  <p>Promo Discount</p>
                  <p>-₱{cartPromoDiscount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
              )}
              {isMember && (
                <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                  <p>Member Discount (10%)</p>
                  <p>-₱{memberDiscount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                </div>
              )}
              <div className="flex justify-between text-xs text-slate-500">
                <p>Shipping{shippingZone ? ` (${shippingZone})` : ''}</p>
                <p className="font-semibold">{shippingZone ? `₱${shippingFee.toLocaleString()}` : '—'}</p>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-150 text-slate-900 dark:text-white">
                <p className="font-semibold text-sm">Estimated Total</p>
                <p className="text-xl font-extrabold text-neutral-900 dark:text-emerald-400">₱{cartTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            {!isCheckouting ? (
              <button
                onClick={handleProceedToCheckout}
                className="w-full py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-sm transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                Proceed to Manual Checkout <ChevronRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Secure cooperative logistics guarantee panel */}
      <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex gap-3 text-xs leading-relaxed text-slate-500">
        <Info className="w-5 h-5 text-emerald-800 shrink-0" />
        <p>
          Prices reflect direct co-op valuations. All purchases directly assist the <strong>Share Capital of agricultural members</strong>. Receipt matching takes up to 1-2 business hours.
        </p>
      </div>
    </>
  );

  return (
    <div className="animate-in fade-in duration-500">

      {/* 1. Hero Showcase - full-bleed, matching the home page hero. Hidden
          once the cart or checkout is showing, so those stay a focused,
          single-purpose screen instead of a marketing banner plus content. */}
      {!cartPanelOpen && !isCheckouting && (
      <section className="relative overflow-hidden bg-neutral-900 border-b border-emerald-800/30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/60 via-slate-950/90 to-slate-950 -z-10" />

        {/* Banner decorative graphics */}
        <div className="max-w-4xl mx-auto px-6 py-16 sm:py-24 text-center space-y-6 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider backdrop-blur">
            <Sparkles className="w-3 mx-auto text-emerald-400" />
            Empowering Agricultural Commerce
          </div>
          <h1 className="font-serif text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight">
            Premium Coconut <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-amber-300 to-emerald-300">
              Cooperative Storefront
            </span>
          </h1>
          <p className="text-slate-300 text-base sm:text-xl max-w-2xl mx-auto font-light leading-relaxed">
            Support rural agrarian economies by purchasing direct-to-farm coconut products. Backed by the BOCOFAC organic network, supporting verified local producers.
          </p>
          <div className="flex justify-center gap-4 pt-4 shrink-0">
            <button
              onClick={() => {
                const catalog = document.getElementById('catalog-section');
                catalog?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg hover:shadow-emerald-900/20 transition-all cursor-pointer"
            >
              Browse Curated Catalog
            </button>
            <div className="hidden sm:flex items-center gap-6 text-xs text-slate-400 border-l border-slate-800 pl-6 text-left">
              <div>
                <p className="font-semibold text-white">100% Organic</p>
                <p>Sustainable Biomass</p>
              </div>
              <div>
                <p className="font-semibold text-white">Direct Trade</p>
                <p>Fair Shared Capital</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      <div className="max-w-[1680px] mx-auto w-full p-4 sm:p-8 space-y-8">
      {/* Main Content Area - a checkout in progress uses the two-column
          grid (form + live cart summary beside it); otherwise the catalog
          and the cart panel are mutually exclusive full-width views, so
          opening the cart doesn't leave the product grid peeking in beside
          it (each branch keeps id="catalog-section" so the hero's "Browse
          Curated Catalog" scroll target always resolves). */}
      {isCheckouting ? (
      <div id="catalog-section" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        <div className="lg:col-span-8 space-y-6">
            {/* Multi-step Manual Payment and Checkout Flow */}
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm p-6 sm:p-8 space-y-6 relative">
              <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-4">
                <button
                  onClick={() => setIsCheckouting(false)}
                  className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Storefront
                </button>
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  Secure Checkout
                </span>
              </div>

              {/* Steps Progress Visualizer */}
              <div className="flex items-center justify-between max-w-md mx-auto py-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    checkoutStep >= 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {checkoutStep > 1 ? <Check className="w-4 h-4" /> : '1'}
                  </div>
                  <span className="text-xs font-semibold hidden sm:inline">Delivery Info</span>
                </div>
                <div className="flex-1 h-0.5 bg-slate-200 dark:bg-slate-800 mx-4" />
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    checkoutStep >= 2 ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}>
                    1
                  </div>
                  <span className="text-xs font-semibold hidden sm:inline">Audit Reference</span>
                </div>
              </div>

              {checkoutStep === 1 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Shipping & Contact Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Juan Dela Cruz"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Email Address</label>
                      <input
                        type="email"
                        required
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="juan.delacruz@gmail.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Mobile number</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={11}
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(digitsOnly(e.target.value, 11))}
                      placeholder="09171234567"
                      className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 text-slate-900 dark:text-white ${validationBorderClass(recipientPhone, isValidPhone11(recipientPhone))}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Street / House No. / Landmark</label>
                    <textarea
                      required
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="123 Rizal St., near the barangay hall"
                      rows={2}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Province</label>
                      <select
                        required
                        value={province}
                        onChange={onProvinceChange}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                      >
                        <option value="">Select province</option>
                        {FOCUS_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                        <option value={OTHER_PROVINCE_OPTION}>{OTHER_PROVINCE_OPTION}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">City / Municipality</label>
                      {isFocusProvince ? (
                        <select
                          required
                          value={cityMunicipality}
                          onChange={onCityChange}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                        >
                          <option value="">Select city/municipality</option>
                          {citiesForProvince.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          required
                          disabled={!province}
                          value={cityMunicipality}
                          onChange={onCityChange}
                          placeholder={province ? 'e.g. Legazpi City' : 'Select a province first'}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white disabled:opacity-50"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Barangay</label>
                      {isFocusProvince && barangaysForCity.length > 0 ? (
                        <select
                          value={barangay}
                          onChange={(e) => setBarangay(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                        >
                          <option value="">Select barangay</option>
                          {barangaysForCity.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          disabled={!cityMunicipality}
                          value={barangay}
                          onChange={(e) => setBarangay(e.target.value)}
                          placeholder={cityMunicipality ? 'e.g. Poblacion' : 'Select a city/municipality first'}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white disabled:opacity-50"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Delivery Zone</label>
                    {shippingZone ? (
                      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-sm">
                        <span className="font-semibold text-emerald-800 dark:text-emerald-300">{shippingZone}</span>
                        <span className="font-bold text-emerald-800 dark:text-emerald-300">₱{SHIPPING_ZONES[shippingZone]}</span>
                      </div>
                    ) : (
                      <div className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm text-slate-400">
                        Select your Province and City/Municipality above to detect your delivery zone.
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1">BOCOFAC delivers throughout Camarines Sur and Camarines Norte. Orders elsewhere still ship, just at the higher out-of-area rate shown above.</p>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => {
                        if (!recipientName || !recipientEmail || !streetAddress || !shippingZone) {
                          onToast('Please fill out all required fields before continuing.', 'error');
                          return;
                        }
                        setCheckoutStep(2);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center gap-2 transition"
                    >
                      Proceed to Verification <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={submitManualPayment} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {paymentMethod === 'GCash' ? 'Manual Payment Screenshot Verification' : 'Cash on Delivery'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {paymentMethod === 'GCash'
                        ? 'Due to strict rural banking configurations, BOCOFAC leverages manual verification. Scan or transfer the exact total to the accredited digital deposit value below:'
                        : 'Pay in cash to the rider once your order arrives. No online payment or screenshot needed.'}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                        Payment Option
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                          <input
                            type="radio"
                            name="payMethod"
                            checked={paymentMethod === 'GCash'}
                            onChange={() => setPaymentMethod('GCash')}
                            className="text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                          />
                          GCash Digital Wallet
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                          <input
                            type="radio"
                            name="payMethod"
                            checked={paymentMethod === 'Cash on Delivery'}
                            onChange={() => setPaymentMethod('Cash on Delivery')}
                            className="text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                          />
                          Cash on Delivery
                        </label>
                      </div>
                    </div>

                    {paymentMethod === 'GCash' ? (
                      <>
                        {/* GCash Account Information */}
                        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">GCash Official Wallet</p>
                          <p className="text-lg font-mono font-bold text-slate-900 dark:text-white">0917-889-4402</p>
                          <p className="text-[10px] text-slate-500">Account: BOCOFAC Coop Central Inc.</p>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                            Transaction Reference Number (Audit Code)
                          </label>
                          <input
                            type="text"
                            required
                            inputMode="numeric"
                            maxLength={13}
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(digitsOnly(e.target.value, 13))}
                            placeholder="13-digit GCash reference number"
                            className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 text-slate-900 dark:text-white ${validationBorderClass(referenceNumber, isValidGcashRef13(referenceNumber) && refNumberMatchesReceipt(receiptDigitRuns, referenceNumber) !== false)}`}
                          />
                          {referenceNumber && refNumberMatchesReceipt(receiptDigitRuns, referenceNumber) === false ? (
                            <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-400 font-bold">
                              This doesn't match the reference number on your attached receipt. Please double-check and correct it.
                            </p>
                          ) : (
                            <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-400 font-medium">
                              Warning: The reference number you entered must match the one shown in your receipt screenshot. Payment will not be accepted if they don't match.
                            </p>
                          )}
                        </div>

                        {/* Screenshot Interactive Drag-and-Drop Area */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                            Payment Confirmation Image Screenshot
                          </label>
                          <div className="border bg-slate-50/50 dark:bg-slate-950/20 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center hover:border-emerald-500 dark:hover:border-emerald-400 transition relative">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleReceiptUpload}
                              disabled={scanningReceipt}
                              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-wait"
                            />
                            {scanningReceipt ? (
                              <div className="space-y-2 pointer-events-none">
                                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 border text-slate-400">
                                  <Upload className="w-5 h-5 animate-pulse" />
                                </div>
                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Scanning receipt…</p>
                                <p className="text-[10px] text-slate-400">Checking that this looks like an actual payment confirmation</p>
                              </div>
                            ) : receiptPreview ? (
                              <div className="space-y-2">
                                <div className="relative inline-block">
                                  <img
                                    src={receiptPreview}
                                    alt="Receipt Screenshot Receipt Preview"
                                    className="h-32 mx-auto rounded-lg shadow-md border"
                                  />
                                </div>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1">
                                  <Check className="w-4 h-4" /> Attached: {receiptFile?.name}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setViewedAttachmentUrl(receiptPreview)}
                                  className="text-[10px] text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 underline cursor-pointer relative z-10"
                                >
                                  View full size
                                </button>
                                <p className="text-[10px] text-slate-400">Click or drag again to replace</p>
                              </div>
                            ) : (
                              <div className="space-y-2 pointer-events-none">
                                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 border text-slate-400">
                                  <Upload className="w-5 h-5 animate-bounce" />
                                </div>
                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                  Drag and drop your transaction receipt screenshot, or <span className="text-emerald-600 dark:text-emerald-400 hover:underline">browse files</span>
                                </p>
                                <p className="text-[10px] text-slate-400">Supports PNG, JPEG, GIF up to 5MB</p>
                          </div>
                        )}
                      </div>
                    </div>
                      </>
                    ) : (
                      <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">Cash on Delivery (COD)</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">No advance payment needed — settle the exact amount in cash directly to the rider when your order is delivered.</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep(1)}
                      className="px-4 py-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-900 text-sm font-medium transition"
                    >
                      Back to Delivery
                    </button>
                    <button
                      type="submit"
                      disabled={submittingOrder || scanningReceipt || (paymentMethod === 'GCash' && refNumberMatchesReceipt(receiptDigitRuns, referenceNumber) === false)}
                      title={paymentMethod === 'GCash' && refNumberMatchesReceipt(receiptDigitRuns, referenceNumber) === false ? "Your reference number doesn't match the attached receipt" : undefined}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg hover:shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submittingOrder ? 'Submitting…' : scanningReceipt ? 'Scanning receipt…' : `Confirm and Submit Order (₱${cartTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })})`}
                    </button>
                  </div>
                </form>
              )}
            </div>
        </div>

        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-8">
          {cartPanelJSX}
        </div>

      </div>
      ) : cartPanelOpen ? (
      /* Cart alone, full width and centered - the product grid is hidden
         entirely while the cart is open, rather than always sitting beside
         it as a sidebar. */
      <div id="catalog-section" className="max-w-xl mx-auto w-full space-y-6">
        {cartPanelJSX}
      </div>
      ) : (
      /* E-commerce Catalog Storefront Grid & Filters - full width with more
         columns at wider breakpoints, so cards stay a normal size instead of
         stretching to fill the space the (now hidden) cart sidebar used to take. */
      <div id="catalog-section" className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Flagship Coconut Products</h2>
            <p className="text-sm text-slate-500">Direct trade supplies of premium organic agricultural carbon, fibres and doormats.</p>
          </div>
          {/* Category filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-emerald-800 text-white dark:bg-emerald-600'
                    : 'bg-white dark:bg-slate-900 border text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product list grid - size-variant products (e.g. Coconut Husk Pole lengths) collapse into one card with a size dropdown via groupProductsForDisplay */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {groupProductsForDisplay(filteredProducts).map(({ key, variants }) => (
            <ProductCard
              key={key}
              variants={variants}
              isMember={isMember}
              memberPrice={memberPrice}
              onAddToCart={addToCart}
              onViewDetail={viewProductDetail}
            />
          ))}
        </div>
      </div>
      )}
      </div>

      {/* Model Spec Modal view on catalog detail clicks */}
      {activeProductDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 space-y-6 relative animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start">
              <span className="px-2.5 py-1 text-[10px] bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-mono uppercase font-bold">
                {activeProductDetail.category} Specifications
              </span>
              <button
                onClick={() => setActiveProductDetail(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition text-sm font-semibold p-1"
              >
                Close
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-6">
              <img
                src={resolveImageUrl(activeProductDetail.image)}
                alt={activeProductDetail.name}
                className="w-full sm:w-1/3 h-40 object-cover rounded-xl shadow border"
              />
              <div className="flex-1 space-y-3">
                <h3 className="text-xl font-bold text-slate-950 dark:text-white leading-tight">{activeProductDetail.name}</h3>
                <p className="text-xs text-slate-400 font-mono">Product ID: {activeProductDetail.id}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{activeProductDetail.description}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Technical Specs:</h4>
              <ul className="text-xs grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl font-mono">
                {activeProductDetail.specifications.map((spec, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> {spec}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <p className="text-xs text-slate-400 font-mono">Stock level</p>
                <p className="text-sm font-semibold">{activeProductDetail.stock} {activeProductDetail.unit} available</p>
              </div>
              <button
                onClick={() => {
                  addToCart(activeProductDetail);
                  setActiveProductDetail(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 dark:bg-emerald-600 text-white font-medium text-xs shadow"
              >
                Add Spec to Cart (₱{memberPrice(effectivePrice(activeProductDetail)).toLocaleString(undefined, { maximumFractionDigits: 2 })})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account-required dialog - blocks checkout for guests instead of a
          toast, since this isn't a dismiss-and-move-on notice but something
          that needs an actual decision (sign up now, or come back later). */}
      {showAccountRequiredModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 space-y-5 relative animate-in zoom-in-95 duration-200 text-center">
            <button
              onClick={() => setShowAccountRequiredModal(false)}
              aria-label="Close"
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-emerald-800 dark:text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Account Required</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Please create an account or sign in first so BOCOFAC can process your order and keep you updated on its status.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => { setShowAccountRequiredModal(false); onRequireAccount && onRequireAccount(); }}
                className="w-full py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-sm transition-colors cursor-pointer"
              >
                Sign Up / Sign In
              </button>
              <button
                onClick={() => setShowAccountRequiredModal(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Keep Browsing
              </button>
            </div>
          </div>
        </div>
      )}

      {viewedAttachmentUrl && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setViewedAttachmentUrl(null)}
        >
          <button
            onClick={() => setViewedAttachmentUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={viewedAttachmentUrl}
            alt=""
            className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain cursor-default"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  );
}
