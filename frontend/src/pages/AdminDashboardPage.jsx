import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Box,
  ShoppingBag,
  Boxes,
  Users,
  PhilippinePeso,
  BarChart3,
  FileText,
  Settings as SettingsIcon,
  Bell,
  LogOut,
  TrendingUp,
  AlertTriangle,
  Check,
  Printer,
  Moon,
  Sun,
  Menu,
  Calendar,
  Pencil,
  Trash2,
  Plus,
  X,
  Eye,
  Camera,
  Truck,
} from 'lucide-react';
import { formatDate } from '../utils/formatDate';
import { displayApplicantStatus } from '../utils/applicantStatus';
import { printSalesReport, printMembershipReport, printInventoryReport } from '../utils/printDocument';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import { productCode } from '../utils/productCode';
import ApplicantDetailModal from '../components/ApplicantDetailModal';
import MemberDetailModal from '../components/MemberDetailModal';
import MobileScrollHint from '../components/MobileScrollHint';
import ExecDashboard from '../components/ExecDashboard';
import ImageLightbox from '../components/ImageLightbox';
import SearchBar, { matchesSearch } from '../components/SearchBar';
import CoopInsights from '../components/CoopInsights';
import ShareCapitalLedger from '../components/ShareCapitalLedger';
import PmesAttendanceModal from '../components/PmesAttendanceModal';
import Footer from '../components/Footer';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
const LOW_STOCK_THRESHOLD = 20;
const PRODUCT_CATEGORIES = ['Charcoal', 'Fertilizer', 'Fibre & Coir', 'Handicraft'];
const EMPTY_PRODUCT_FORM = { name: '', category: PRODUCT_CATEGORIES[0], description: '', price: '', stock: '', unit: '', specifications: '', imageFile: null, variantGroup: '', variantLabel: '', discountPercent: '' };

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

const ORDER_FULFILLMENT_STATUSES = ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'];
const ORDER_STATUS_LABELS = { Shipped: 'Delivered to Courier' };
const getOrderStatusLabel = (status) => ORDER_STATUS_LABELS[status] || status;
const ORDER_HISTORY_STATUSES = [...ORDER_FULFILLMENT_STATUSES, 'Completed', 'Rejected', 'Cancelled'];
const ORDER_STATUS_COLORS = {
  'Pending Verification': 'text-amber-700 dark:text-amber-400',
  Processing: 'text-blue-700 dark:text-blue-400',
  Shipped: 'text-indigo-700 dark:text-indigo-400',
  'Out for Delivery': 'text-purple-700 dark:text-purple-400',
  Delivered: 'text-emerald-700 dark:text-emerald-400',
  Completed: 'text-emerald-700 dark:text-emerald-400',
  Rejected: 'text-rose-700 dark:text-rose-400',
  Cancelled: 'text-slate-500 dark:text-slate-400',
};

const NAV_ITEMS = [
  { key: 'products', label: 'Products', icon: Box },
  { key: 'orders', label: 'Orders', icon: ShoppingBag },
  { key: 'inventory', label: 'Inventory', icon: Boxes },
  { key: 'membership', label: 'Membership', icon: Users },
  { key: 'pmes', label: 'PMES Schedule', icon: Calendar },
  { key: 'ledger', label: 'Share Capital', icon: PhilippinePeso },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

function ProductRow({ variants, restockDrafts, setRestockDrafts, startRestock, submitRestock, openEditProduct, handleDeleteProduct }) {
  const [selectedId, setSelectedId] = useState(variants[0].id);
  const p = variants.find(v => v.id === selectedId) || variants[0];
  const hasSizes = variants.length > 1;
  const baseName = hasSizes ? variants[0].name.replace(/\s*\([^)]*\)\s*$/, '') : p.name;

  return (
    <tr className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
      <td className="p-4 whitespace-nowrap"><span className="font-mono text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{productCode(p)}</span></td>
      <td className="p-4 font-semibold text-slate-900 dark:text-white">
        <div className="flex items-center gap-3">
          <img src={resolveImageUrl(p.image)} alt={baseName} className="w-10 h-10 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0" />
          <div>
            <span>{baseName}</span>
            {hasSizes && (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="block mt-1 px-1.5 py-0.5 text-[11px] rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 cursor-pointer"
              >
                {variants.map(v => (
                  <option key={v.id} value={v.id}>{v.variantLabel}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </td>
      <td className="p-4 text-slate-500">{p.category}</td>
      <td className="p-4 font-bold">
        {p.discountPercent > 0 ? (
          <div className="flex flex-col">
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-700 dark:text-emerald-400">₱{p.salePrice.toLocaleString()}</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
                -{p.discountPercent}%
              </span>
            </span>
            <span className="text-[10px] text-slate-400 line-through font-normal">₱{p.price.toLocaleString()}</span>
          </div>
        ) : (
          <span className="text-emerald-700 dark:text-emerald-400">₱{p.price.toLocaleString()}</span>
        )}
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <span className={p.stock < LOW_STOCK_THRESHOLD ? 'text-rose-600 font-bold' : 'text-slate-700 dark:text-slate-300'}>
            {p.stock} {p.unit}
          </span>
          {p.stock === 0 ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">Out of Stock</span>
          ) : p.stock < LOW_STOCK_THRESHOLD ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">Low Stock</span>
          ) : null}
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center justify-end gap-2">
          {restockDrafts[p.id] !== undefined ? (
            <>
              <input
                type="number"
                value={restockDrafts[p.id]}
                onChange={(e) => setRestockDrafts(prev => ({ ...prev, [p.id]: e.target.value }))}
                className="w-20 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <button onClick={() => submitRestock(p.id)} className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer">
                <Check className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => startRestock(p.id, p.stock)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
            >
              Update Stock
            </button>
          )}
        </div>
      </td>
      <td className="p-4">
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => openEditProduct(p)} className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => handleDeleteProduct(p)} className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/60 cursor-pointer">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminDashboardPage({
  admin,
  setAdmin,
  setPage,
  products,
  orders,
  onVerifyOrder,
  onRejectOrder,
  onUpdateOrderStatus,
  onUpdateProductStock,
  onApplyPromo,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  members,
  ledger,
  onAddMember,
  onUpdateMember,
  onAddLedgerEntry,
  onVerifyLedgerEntry,
  withdrawals,
  onApproveWithdrawal,
  onSendWithdrawal,
  onRejectWithdrawal,
  applicants,
  pmesSessions,
  onAddPmesSession,
  onUpdatePmesSession,
  onDeletePmesSession,
  isDarkMode,
  onToggleDarkMode,
  onToast,
}) {
  const [adminTab, setAdminTab] = useState('analytics');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [restockDrafts, setRestockDrafts] = useState({});
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
  const [savingProduct, setSavingProduct] = useState(false);
  const [showAddSession, setShowAddSession] = useState(false);
  const [sessionForm, setSessionForm] = useState({ title: '', date: '', time: '', venue: '', speaker: '', capacity: '' });
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [sessionEditDraft, setSessionEditDraft] = useState({});
  const [viewingReceiptOrder, setViewingReceiptOrder] = useState(null);
  const [viewedReceiptUrl, setViewedReceiptUrl] = useState(null);
  // [SEARCH] Pag-filter ng applicants at members base sa hinahanap
  const [memberSearch, setMemberSearch] = useState('');
  const filteredApplicants = useMemo(() => applicants.filter(a => matchesSearch(memberSearch, a.fullName, a.email, a.id, a.phone, a.cpNumber)), [applicants, memberSearch]);
  const filteredMembers = useMemo(() => members.filter(m => matchesSearch(memberSearch, m.name, m.email, m.id, m.mobileNumber)), [members, memberSearch]);

  const [viewedApplicant, setViewedApplicant] = useState(null);
  const [viewedMember, setViewedMember] = useState(null);
  const [viewedAvatarUrl, setViewedAvatarUrl] = useState(null);
  const [rejectReasonDraft, setRejectReasonDraft] = useState('');
  const [confirmPrompt, setConfirmPrompt] = useState(null);
  const [orderView, setOrderView] = useState('active');
  const [attendanceSession, setAttendanceSession] = useState(null);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const notifRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await fetch(`${API_BASE}/auth/me/avatar`, {
        method: 'PATCH',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update profile photo.');
      setAdmin(data);
      onToast?.('Profile photo updated.', 'success');
    } catch (err) {
      onToast?.(err.message || 'Failed to update profile photo.', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = () => {
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setAdmin(null);
    setPage('home');
  };

  useEffect(() => {
    const onClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const realizedOrders = useMemo(() => orders.filter(o => o.status !== 'Pending Verification' && o.status !== 'Rejected' && o.status !== 'Cancelled'), [orders]);
  // [ANALYTICS] Total Sales = sum ng completed / in-progress orders
  const totalSales = useMemo(() => realizedOrders.reduce((sum, o) => sum + o.totalAmount, 0), [realizedOrders]);
  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'Pending Verification').length, [orders]);
  const visibleOrders = useMemo(
    () => orders.filter(o => ORDER_HISTORY_STATUSES.includes(o.status) === (orderView === 'history')),
    [orders, orderView]
  );
  const pendingApplicants = useMemo(() => applicants.filter(a => a.status !== 'Approved' && a.status !== 'Rejected').length, [applicants]);
  const lowStockProducts = useMemo(() => products.filter(p => p.stock < LOW_STOCK_THRESHOLD), [products]);

  // [INVENTORY] Filter + search + sort; default: pinakamababang stock muna para magkakasunod ang low stock
  const [inventoryFilter, setInventoryFilter] = useState('all');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventorySort, setInventorySort] = useState('stock-asc');
  const inventoryCounts = useMemo(() => ({
    all: products.length,
    low: lowStockProducts.length,
    out: products.filter(p => p.stock === 0).length,
    in: products.length - lowStockProducts.length,
  }), [products, lowStockProducts]);
  const inventoryRows = useMemo(() => {
    const matchesFilter = {
      all: () => true,
      low: p => p.stock < LOW_STOCK_THRESHOLD,
      out: p => p.stock === 0,
      in: p => p.stock >= LOW_STOCK_THRESHOLD,
    }[inventoryFilter];
    const compare = {
      'stock-asc': (a, b) => a.stock - b.stock || a.name.localeCompare(b.name),
      'stock-desc': (a, b) => b.stock - a.stock || a.name.localeCompare(b.name),
      name: (a, b) => a.name.trim().localeCompare(b.name.trim()),
      category: (a, b) => a.category.localeCompare(b.category) || a.stock - b.stock,
    }[inventorySort];
    return products
      .filter(p => matchesFilter(p) && matchesSearch(inventorySearch, productCode(p), p.id, p.name, p.category, p.unit))
      .sort(compare);
  }, [products, inventoryFilter, inventorySearch, inventorySort]);

  const navBadgeCounts = useMemo(() => ({
    orders: pendingOrders,
    membership: pendingApplicants,
    inventory: lowStockProducts.length,
  }), [pendingOrders, pendingApplicants, lowStockProducts]);

  const notifications = useMemo(() => [
    pendingOrders > 0 && {
      key: 'orders', icon: ShoppingBag, tab: 'orders',
      label: `${pendingOrders} order${pendingOrders === 1 ? '' : 's'} awaiting payment verification`,
    },
    pendingApplicants > 0 && {
      key: 'applicants', icon: Users, tab: 'membership',
      label: `${pendingApplicants} membership application${pendingApplicants === 1 ? '' : 's'} pending review`,
    },
    lowStockProducts.length > 0 && {
      key: 'stock', icon: AlertTriangle, tab: 'inventory',
      label: `${lowStockProducts.length} product${lowStockProducts.length === 1 ? '' : 's'} low on stock`,
    },
  ].filter(Boolean), [pendingOrders, pendingApplicants, lowStockProducts]);

  const startRestock = (productId, currentStock) => {
    setRestockDrafts(prev => ({ ...prev, [productId]: currentStock }));
  };
  const submitRestock = (productId) => {
    const value = Number(restockDrafts[productId]);
    if (Number.isNaN(value) || value < 0) {
      onToast?.('Please enter a valid stock quantity.', 'error');
      return;
    }
    onUpdateProductStock(productId, value);
    setRestockDrafts(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const openAddProduct = () => {
    setEditingProductId(null);
    setProductForm(EMPTY_PRODUCT_FORM);
    setShowProductForm(true);
  };
  const openEditProduct = (p) => {
    setEditingProductId(p.id);
    setProductForm({
      name: p.name,
      category: p.category,
      description: p.description || '',
      price: String(p.price),
      stock: String(p.stock),
      unit: p.unit || '',
      specifications: (p.specifications || []).join(', '),
      imageFile: null,
      variantGroup: p.variantGroup || '',
      variantLabel: p.variantLabel || '',
      discountPercent: p.discountPercent ? String(p.discountPercent) : '',
    });
    setShowProductForm(true);
  };
  const closeProductForm = () => {
    setShowProductForm(false);
    setEditingProductId(null);
    setProductForm(EMPTY_PRODUCT_FORM);
  };
  const submitProductForm = async () => {
    if (!productForm.name || !productForm.category || !productForm.price) {
      onToast?.('Please fill in name, category, and price.', 'error');
      return;
    }
    const formData = new FormData();
    formData.append('name', productForm.name);
    formData.append('category', productForm.category);
    formData.append('description', productForm.description);
    formData.append('price', productForm.price);
    formData.append('unit', productForm.unit);
    formData.append('specifications', JSON.stringify(
      productForm.specifications.split(',').map(s => s.trim()).filter(Boolean)
    ));
    formData.append('variantGroup', productForm.variantGroup.trim());
    formData.append('variantLabel', productForm.variantLabel.trim());
    if (productForm.imageFile) formData.append('image', productForm.imageFile);

    setSavingProduct(true);
    try {
      let ok;
      if (editingProductId) {
        formData.append('discountPercent', productForm.discountPercent || '0');
        ok = await onUpdateProduct(editingProductId, formData);
      } else {
        formData.append('stock', productForm.stock || '0');
        ok = await onAddProduct(formData);
      }
      if (ok) closeProductForm();
    } finally {
      setSavingProduct(false);
    }
  };
  const handleDeleteProduct = (product) => {
    setConfirmPrompt({
      tone: 'danger',
      title: 'Delete this product?',
      message: `"${product.name}" will be removed from the store. This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: () => onDeleteProduct(product.id),
    });
  };

  const TAB_TITLES = {
    products: 'Products',
    orders: 'Orders',
    inventory: 'Inventory',
    membership: 'Membership',
    pmes: 'PMES Schedule',
    ledger: 'Share Capital',
    analytics: 'Analytics',
    reports: 'Reports',
    settings: 'Settings',
  };

  const submitNewSession = async () => {
    const { title, date, time, venue, speaker, capacity } = sessionForm;
    if (!title || !date || !time || !capacity) {
      onToast?.('Please fill in title, date, time and capacity.', 'error');
      return;
    }
    if (Number(capacity) > 40) {
      onToast?.('Capacity cannot exceed 40.', 'error');
      return;
    }
    const ok = await onAddPmesSession({ title, date, time, venue, speaker, capacity: Number(capacity) });
    if (ok) {
      setSessionForm({ title: '', date: '', time: '', venue: '', speaker: '', capacity: '' });
      setShowAddSession(false);
    }
  };

  const startEditSession = (session) => {
    setEditingSessionId(session.id);
    setSessionEditDraft({
      title: session.title,
      date: session.date,
      time: session.time,
      venue: session.venue || '',
      speaker: session.speaker || '',
      capacity: session.capacity,
    });
  };
  const submitEditSession = (sessionId) => {
    if (Number(sessionEditDraft.capacity) > 40) {
      onToast?.('Capacity cannot exceed 40.', 'error');
      return;
    }
    onUpdatePmesSession(sessionId, { ...sessionEditDraft, capacity: Number(sessionEditDraft.capacity) });
    setEditingSessionId(null);
  };

  const SidebarNav = ({ onNavigate }) => (
    <>
      <div className="px-6 pt-8 pb-7 flex items-center gap-3.5 border-b border-white/10">
        {admin?.avatarUrl ? (
          <img
            src={resolveImageUrl(admin.avatarUrl)}
            alt=""
            onClick={() => setViewedAvatarUrl(resolveImageUrl(admin.avatarUrl))}
            title="View full photo"
            className="w-14 h-14 rounded-full object-cover shrink-0 shadow-md ring-2 ring-white/70 cursor-pointer hover:opacity-80 transition"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-white text-emerald-800 flex items-center justify-center shrink-0 shadow-md font-extrabold text-xl">
            {(admin?.name || 'AD').slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-serif text-white font-extrabold tracking-tight text-2xl leading-tight">BOCOFAC</h1>
          <p className="text-emerald-100/80 text-sm font-semibold uppercase tracking-wider truncate">{admin?.name || 'Admin User'}</p>
        </div>
      </div>
      <nav className="flex-1 flex flex-col gap-2 px-3.5 py-5 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = adminTab === item.key;
          const badgeCount = navBadgeCounts[item.key] || 0;
          return (
            <button
              key={item.key}
              onClick={() => { setAdminTab(item.key); onNavigate?.(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer transition text-left ${
                isActive ? 'bg-white text-emerald-700 shadow-md' : 'text-emerald-50/90 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
              {badgeCount > 0 && (
                <span className="ml-auto w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              )}
            </button>
          );
        })}
      </nav>
      <div className="p-3.5 pb-6 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer transition text-left text-emerald-50/90 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="h-screen flex bg-[#faf8f4] dark:bg-slate-950 text-slate-900 dark:text-slate-100">

      <aside className="hidden md:flex w-72 bg-gradient-to-b from-emerald-600 to-emerald-700 dark:from-emerald-800 dark:to-emerald-950 flex-col shrink-0 select-none sticky top-0 h-[calc(100vh-var(--footer-h,0px))] overflow-y-auto">
        <SidebarNav />
      </aside>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-72 bg-gradient-to-b from-emerald-600 to-emerald-700 dark:from-emerald-800 dark:to-emerald-950 flex flex-col h-full">
            <SidebarNav onNavigate={() => setMobileMenuOpen(false)} />
          </div>
          <div className="flex-1 bg-slate-950/50" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">

        <header className="h-20 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{TAB_TITLES[adminTab]}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifMenuOpen(o => !o)}
                className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500" />
                )}
              </button>
              {notifMenuOpen && (
                <div className="fixed top-[5.25rem] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm sm:absolute sm:top-auto sm:left-auto sm:translate-x-0 sm:right-0 sm:mt-2 sm:w-72 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden z-50">
                  <p className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    Notifications
                  </p>
                  {notifications.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-slate-400 text-center">You're all caught up.</p>
                  ) : (
                    notifications.map(n => (
                      <button
                        key={n.key}
                        onClick={() => { setAdminTab(n.tab); setNotifMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-left cursor-pointer"
                      >
                        <n.icon className="w-4 h-4 text-rose-500 shrink-0" /> {n.label}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setPage('home')}
              title="Back to Home"
              aria-label="Back to Home"
              className="px-3 py-2 sm:px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors"
            >
              Back to Home
            </button>
          </div>
        </header>

        <main className="flex-grow p-4 sm:p-8 overflow-y-auto w-full space-y-6" style={{ paddingBottom: 'calc(var(--footer-h, 0px) + 2rem)' }}>

          {adminTab === 'analytics' && (
            <>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Overview</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-500">Total Sales</p>
                    <p className="text-lg font-extrabold text-emerald-600 break-words">₱{totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs font-semibold text-emerald-600 mt-1">Verified revenue to date</p>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-500">Total Orders</p>
                    <p className="text-2xl font-extrabold text-sky-600 break-words">{orders.length}</p>
                    <p className="text-xs font-semibold text-sky-600 mt-1">{pendingOrders} pending</p>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-sky-100 dark:bg-sky-950/50 flex items-center justify-center text-sky-700 dark:text-sky-400 shrink-0">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-500">Total Members</p>
                    <p className="text-2xl font-extrabold text-violet-600 break-words">{members.filter(m => m.status !== 'Removed').length}</p>
                    <p className="text-xs font-semibold text-violet-600 mt-1">{pendingApplicants} pending applications</p>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center text-violet-700 dark:text-violet-400 shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-500">Low Stock Alert</p>
                    <p className="text-2xl font-extrabold text-rose-600 break-words">{lowStockProducts.length}</p>
                    <p className="text-xs font-semibold text-rose-600 mt-1">Products below {LOW_STOCK_THRESHOLD} units</p>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-700 dark:text-rose-400 shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 flex flex-col">
                  <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4.5 h-4.5 text-rose-500" /> Low Stock Products
                  </h3>
                  {lowStockProducts.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-10">All products are well stocked.</p>
                  ) : (
                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[260px] pr-1">
                      {lowStockProducts.slice(0, 6).map(p => (
                        <button
                          key={p.id}
                          onClick={() => setAdminTab('inventory')}
                          className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-left cursor-pointer transition"
                        >
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{p.name}</span>
                          <span className="text-xs font-bold text-rose-600 shrink-0">{p.stock} {p.unit}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 dark:text-white">Recent Orders</h3>
                    <button onClick={() => setAdminTab('orders')} className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer">View all</button>
                  </div>
                  {orders.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-10">No orders yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1 overflow-y-auto max-h-[260px] pr-1">
                      {orders.slice(0, 5).map(o => (
                        <div key={o.id} className="flex items-center justify-between gap-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{o.items.map(i => i.productName).join(', ')}</p>
                            <p className="text-xs text-slate-400">{formatDate(o.orderedAt)}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">₱{o.totalAmount.toLocaleString()}</span>
                            <span className={`text-xs font-bold ${ORDER_STATUS_COLORS[o.status] || ORDER_STATUS_COLORS['Pending Verification']}`}>{getOrderStatusLabel(o.status)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {adminTab === 'products' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 max-w-md">Manage the product catalog shown on the storefront.</p>
                <button
                  onClick={() => (showProductForm ? closeProductForm() : openAddProduct())}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  {showProductForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {showProductForm ? 'Cancel' : 'Add Product'}
                </button>
              </div>

              {showProductForm && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    placeholder="Product name"
                    value={productForm.name}
                    onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                    className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm(prev => ({ ...prev, category: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  >
                    {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    placeholder="Unit (e.g. 1 kg, Piece, Sack)"
                    value={productForm.unit}
                    onChange={(e) => setProductForm(prev => ({ ...prev, unit: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Price (₱)"
                    value={productForm.price}
                    onChange={(e) => setProductForm(prev => ({ ...prev, price: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  {!editingProductId && (
                    <input
                      type="number"
                      placeholder="Starting stock"
                      value={productForm.stock}
                      onChange={(e) => setProductForm(prev => ({ ...prev, stock: e.target.value }))}
                      className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                    />
                  )}
                  {editingProductId && (
                    <div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Promo discount % (0 = none)"
                        value={productForm.discountPercent}
                        onChange={(e) => setProductForm(prev => ({ ...prev, discountPercent: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Set 0 to remove the promo. Applies instantly on the storefront.</p>
                    </div>
                  )}
                  <textarea
                    placeholder="Description"
                    value={productForm.description}
                    onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                    className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                    rows={2}
                  />
                  <input
                    placeholder="Specifications (comma-separated, optional)"
                    value={productForm.specifications}
                    onChange={(e) => setProductForm(prev => ({ ...prev, specifications: e.target.value }))}
                    className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Size group key (optional)</label>
                      <input
                        placeholder="e.g. coconut-husk-pole"
                        value={productForm.variantGroup}
                        onChange={(e) => setProductForm(prev => ({ ...prev, variantGroup: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Give two or more products the exact same key to merge them into one storefront card with a size dropdown.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Size label (optional)</label>
                      <input
                        placeholder="e.g. 1 ft"
                        value={productForm.variantLabel}
                        onChange={(e) => setProductForm(prev => ({ ...prev, variantLabel: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">What shows in the dropdown for this specific size (required if a size group key is set).</p>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Product photo (optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setProductForm(prev => ({ ...prev, imageFile: e.target.files[0] || null }))}
                      className="w-full text-sm"
                    />
                  </div>
                  <button
                    onClick={submitProductForm}
                    disabled={savingProduct}
                    className="sm:col-span-2 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 cursor-pointer disabled:opacity-60"
                  >
                    {savingProduct ? 'Saving...' : editingProductId ? 'Save Changes' : 'Add Product'}
                  </button>
                </div>
              )}

              <MobileScrollHint />
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
                      <th className="p-4 font-bold">ID</th>
                      <th className="p-4 font-bold">Product</th>
                      <th className="p-4 font-bold">Category</th>
                      <th className="p-4 font-bold">Price</th>
                      <th className="p-4 font-bold">Stock</th>
                      <th className="p-4 font-bold text-right">Restock</th>
                      <th className="p-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupProductsForDisplay(products).map(({ key, variants }) => (
                      <ProductRow
                        key={key}
                        variants={variants}
                        restockDrafts={restockDrafts}
                        setRestockDrafts={setRestockDrafts}
                        startRestock={startRestock}
                        submitRestock={submitRestock}
                        openEditProduct={openEditProduct}
                        handleDeleteProduct={handleDeleteProduct}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminTab === 'orders' && (
            <div className="space-y-4">
              <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button
                  onClick={() => setOrderView('active')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                    orderView === 'active' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setOrderView('history')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                    orderView === 'history' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  History
                </button>
              </div>

              <MobileScrollHint />
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-auto max-h-[70vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
                    <th className="p-4 font-bold">Order</th>
                    <th className="p-4 font-bold">Buyer</th>
                    <th className="p-4 font-bold">Ship To</th>
                    <th className="p-4 font-bold">Total</th>
                    <th className="p-4 font-bold">Payment</th>
                    <th className="p-4 font-bold">Reference #</th>
                    <th className="p-4 font-bold">Status</th>
                    <th className="p-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-sm text-slate-400">
                        {orderView === 'history' ? 'No completed, rejected, or cancelled orders yet.' : 'No active orders right now.'}
                      </td>
                    </tr>
                  )}
                  {visibleOrders.map(o => (
                    <tr key={o.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                      <td className="p-4 font-mono text-xs text-slate-500">
                        {o.id}
                        {o.status === 'Rejected' && (
                          <p className="mt-1 font-sans text-[10px] font-bold text-rose-600 dark:text-rose-400">Rejected</p>
                        )}
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-slate-900 dark:text-white">{o.buyerName}</p>
                        <p className="text-xs text-slate-400">{o.buyerEmail}</p>
                      </td>
                      <td className="p-4 max-w-[220px]">
                        {o.shippingZone && (
                          <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mb-1">
                            {o.shippingZone}
                          </span>
                        )}
                        <p className="text-xs text-slate-600 dark:text-slate-300 truncate" title={o.shippingAddress || ''}>
                          {o.shippingAddress || '—'}
                        </p>
                        <p className="text-[11px] text-slate-400">{o.phone || 'No contact number'}</p>
                      </td>
                      <td className="p-4 font-bold text-emerald-700 dark:text-emerald-400">₱{o.totalAmount.toLocaleString()}</td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">{o.paymentMethod}</td>
                      <td className="p-4 font-mono text-xs text-slate-600 dark:text-slate-300">{o.referenceNumber || '—'}</td>
                      <td className="p-4 whitespace-nowrap">
                        <span className={`text-xs font-bold ${ORDER_STATUS_COLORS[o.status] || ORDER_STATUS_COLORS['Pending Verification']}`}>{getOrderStatusLabel(o.status)}</span>
                        {o.status === 'Processing' && (
                          <button
                            onClick={() => onUpdateOrderStatus(o.id, 'Shipped')}
                            title="Mark as Delivered to Courier"
                            className="mt-1.5 flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70 font-bold cursor-pointer transition"
                          >
                            <Truck className="w-3.5 h-3.5 shrink-0" /> Send to Courier
                          </button>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => { setViewingReceiptOrder(o); setRejectReasonDraft(''); }}
                          aria-label="View receipt"
                          title="View receipt"
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {viewingReceiptOrder && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Payment Verification</h3>
                  <button
                    onClick={() => { setViewingReceiptOrder(null); setRejectReasonDraft(''); }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Order</p>
                    <p className="font-mono font-semibold text-slate-900 dark:text-white">{viewingReceiptOrder.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Buyer</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{viewingReceiptOrder.buyerName}</p>
                    <p className="text-xs text-slate-400">{viewingReceiptOrder.buyerEmail}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Contact Number</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{viewingReceiptOrder.phone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Payment Method</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{viewingReceiptOrder.paymentMethod}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Reference #</p>
                    <p className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {viewingReceiptOrder.referenceNumber || '—'}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-400">Delivery Zone</p>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {viewingReceiptOrder.shippingZone || '—'}
                      {viewingReceiptOrder.shippingZone && (
                        <span className="ml-2 text-xs font-normal text-slate-500">(₱{viewingReceiptOrder.shippingFee?.toLocaleString()} shipping fee)</span>
                      )}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-400">Shipping Address</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{viewingReceiptOrder.shippingAddress || '—'}</p>
                  </div>
                </div>

                {viewingReceiptOrder.items?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Items Ordered</p>
                    <ul className="text-sm divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                      {viewingReceiptOrder.items.map((item, i) => (
                        <li key={i} className="flex items-center justify-between px-3 py-1.5">
                          <span className="text-slate-700 dark:text-slate-300">{item.productName} × {item.quantity}</span>
                          <span className="font-semibold text-slate-900 dark:text-white">₱{(item.price * item.quantity).toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="text-xs text-slate-400 mb-2">Payment Screenshot</p>
                  <img
                    src={`${API_BASE}/orders/${viewingReceiptOrder.id}/receipt`}
                    alt={`Receipt for ${viewingReceiptOrder.id}`}
                    title="Click to view full size"
                    onClick={(e) => setViewedReceiptUrl(e.currentTarget.src)}
                    className="w-full max-h-56 object-contain rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-zoom-in"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                  <p className="hidden text-sm text-slate-400 text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    No receipt screenshot on file for this order.
                  </p>
                  <ImageLightbox url={viewedReceiptUrl} alt="GCash receipt" onClose={() => setViewedReceiptUrl(null)} />
                </div>

                {viewingReceiptOrder.status === 'Rejected' ? (
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900">
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-400 mb-1">Rejection Reason</p>
                    <p className="text-sm text-rose-800 dark:text-rose-300">{viewingReceiptOrder.rejectionReason}</p>
                  </div>
                ) : viewingReceiptOrder.status === 'Pending Verification' && (
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Rejection Reason (required to reject)
                      </label>
                      <textarea
                        value={rejectReasonDraft}
                        onChange={(e) => setRejectReasonDraft(e.target.value)}
                        placeholder="E.g., Reference number does not match any received payment, screenshot is unreadable, amount mismatch..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm resize-none"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          if (!rejectReasonDraft.trim()) {
                            onToast?.('Please provide a rejection reason.', 'error');
                            return;
                          }
                          const orderId = viewingReceiptOrder.id;
                          const reason = rejectReasonDraft.trim();
                          setConfirmPrompt({
                            tone: 'danger',
                            title: 'Reject this order?',
                            message: `Order ${orderId} will be marked Rejected and the buyer will be notified. This cannot be undone.`,
                            confirmLabel: 'Reject Order',
                            onConfirm: () => {
                              onRejectOrder(orderId, reason);
                              setViewingReceiptOrder(null);
                              setRejectReasonDraft('');
                            },
                          });
                        }}
                        className="px-5 py-2.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 font-semibold text-sm transition"
                      >
                        Reject Order
                      </button>
                      <button
                        onClick={() => {
                          const orderId = viewingReceiptOrder.id;
                          setConfirmPrompt({
                            tone: 'success',
                            title: 'Confirm this payment?',
                            message: `Double-check the reference number and screenshot above match before confirming order ${orderId}.`,
                            confirmLabel: 'Confirm Payment',
                            onConfirm: () => {
                              onVerifyOrder(orderId);
                              setViewingReceiptOrder(null);
                            },
                          });
                        }}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition"
                      >
                        Confirm Payment
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {confirmPrompt && (
            <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 space-y-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  confirmPrompt.tone === 'danger' ? 'bg-rose-100 dark:bg-rose-950/50' : 'bg-emerald-100 dark:bg-emerald-950/50'
                }`}>
                  {confirmPrompt.tone === 'danger' ? (
                    <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                  ) : (
                    <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{confirmPrompt.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{confirmPrompt.message}</p>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setConfirmPrompt(null)}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-slate-700 font-semibold text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      confirmPrompt.onConfirm();
                      setConfirmPrompt(null);
                    }}
                    className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition text-white ${
                      confirmPrompt.tone === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    {confirmPrompt.confirmLabel}
                  </button>
                </div>
              </div>
            </div>
          )}

          {attendanceSession && (
            <PmesAttendanceModal
              session={attendanceSession}
              role="admin"
              onClose={() => setAttendanceSession(null)}
              onToast={onToast}
            />
          )}

          {adminTab === 'inventory' && (
            <>
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by stock status">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'low', label: 'Low Stock' },
                    { key: 'out', label: 'Out of Stock' },
                    { key: 'in', label: 'In Stock' },
                  ].map(f => {
                    const active = inventoryFilter === f.key;
                    const alert = (f.key === 'low' || f.key === 'out') && inventoryCounts[f.key] > 0;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setInventoryFilter(f.key)}
                        aria-pressed={active}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-colors ${
                          active
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {f.label}
                        <span className={`px-1.5 rounded-full text-[10px] tabular-nums ${
                          active ? 'bg-white/25 text-white' : alert ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {inventoryCounts[f.key]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 lg:ml-auto lg:w-auto">
                  <SearchBar value={inventorySearch} onChange={setInventorySearch} placeholder="Search ID or product" />
                  <select
                    value={inventorySort}
                    onChange={(e) => setInventorySort(e.target.value)}
                    aria-label="Sort products"
                    className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="stock-asc">Lowest stock first</option>
                    <option value="stock-desc">Highest stock first</option>
                    <option value="name">Name (A–Z)</option>
                    <option value="category">Category</option>
                  </select>
                </div>
              </div>
              <MobileScrollHint />
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-auto min-h-[calc(100vh-15rem)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
                    <th className="p-4 font-bold">ID</th>
                    <th className="p-4 font-bold">Product</th>
                    <th className="p-4 font-bold">Unit</th>
                    <th className="p-4 font-bold">Stock Level</th>
                    <th className="p-4 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-sm text-slate-400">
                        {inventorySearch ? `No products match "${inventorySearch}".` : 'No products in this group.'}
                      </td>
                    </tr>
                  )}
                  {inventoryRows.map(p => (
                    <tr key={p.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                      <td className="p-4 whitespace-nowrap"><span className="font-mono text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{productCode(p)}</span></td>
                      <td className="p-4">
                        <p className="font-semibold text-slate-900 dark:text-white">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.category}</p>
                      </td>
                      <td className="p-4 text-slate-500">{p.unit}</td>
                      <td className="p-4">
                        <div className="w-40 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full ${p.stock < LOW_STOCK_THRESHOLD ? 'bg-rose-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, (p.stock / 400) * 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{p.stock} {p.unit}</p>
                      </td>
                      <td className="p-4">
                        {p.stock === 0 ? (
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-rose-600 text-white whitespace-nowrap">Out of Stock</span>
                        ) : p.stock < LOW_STOCK_THRESHOLD ? (
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-rose-100 text-rose-800 whitespace-nowrap">Low Stock</span>
                        ) : (
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">In Stock</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}

          {adminTab === 'membership' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
                <Users className="w-4 h-4 shrink-0" />
                <p>View-only. Applications are reviewed and approved by the Board of Directors.</p>
              </div>
              <SearchBar value={memberSearch} onChange={setMemberSearch} placeholder="Search by name, email, ID, or mobile number" />
              <MobileScrollHint />
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
                      <th className="p-4 font-bold">Applicant</th>
                      <th className="p-4 font-bold">Agricultural Type</th>
                      <th className="p-4 font-bold">Status</th>
                      <th className="p-4 font-bold text-right">Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberSearch && filteredApplicants.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-sm text-slate-400">No applicants match "{memberSearch}".</td></tr>
                    )}
                    {filteredApplicants.map(a => (
                      <tr key={a.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                        <td className="p-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{a.fullName}</p>
                          <p className="text-xs text-slate-400">{a.email}</p>
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{a.agriculturalType}</td>
                        <td className="p-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            a.status === 'Approved' ? 'bg-emerald-600 text-white' :
                            a.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>{displayApplicantStatus(a.status)}</span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setViewedApplicant(a)}
                            aria-label="View profile"
                            title="View profile"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="font-bold text-slate-900 dark:text-white">Active Shareholders</h3>
              <MobileScrollHint />
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
                      <th className="p-4 font-bold">Member</th>
                      <th className="p-4 font-bold">Joined</th>
                      <th className="p-4 font-bold">Status</th>
                      <th className="p-4 font-bold text-right">Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberSearch && filteredMembers.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-sm text-slate-400">No members match "{memberSearch}".</td></tr>
                    )}
                    {filteredMembers.map(m => (
                      <tr key={m.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                        <td className="p-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{m.name}</p>
                          <p className="text-xs text-slate-400">{m.email}</p>
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{formatDate(m.joinedDate)}</td>
                        <td className="p-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            m.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>{m.status}</span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setViewedMember(m)}
                            aria-label="View profile"
                            title="View profile"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewedApplicant && (
            <ApplicantDetailModal applicant={viewedApplicant} onClose={() => setViewedApplicant(null)} />
          )}
          {viewedMember && (
            <MemberDetailModal member={viewedMember} onClose={() => setViewedMember(null)} onToast={onToast} />
          )}
          {viewedAvatarUrl && (
            <div
              className="fixed inset-0 z-[70] bg-slate-950/80 flex items-center justify-center p-4 cursor-pointer"
              onClick={() => setViewedAvatarUrl(null)}
            >
              <button
                onClick={() => setViewedAvatarUrl(null)}
                className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={viewedAvatarUrl}
                alt=""
                className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain cursor-default"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {adminTab === 'pmes' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 max-w-md">Manage the PMES orientation schedule shown to applicants on the Membership Portal.</p>
                <button
                  onClick={() => setShowAddSession(o => !o)}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  {showAddSession ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {showAddSession ? 'Cancel' : 'Add Session'}
                </button>
              </div>

              {showAddSession && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    placeholder="Title (e.g. PMES Orientation Batch 1)"
                    value={sessionForm.title}
                    onChange={(e) => setSessionForm(prev => ({ ...prev, title: e.target.value }))}
                    className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  <input
                    type="date"
                    value={sessionForm.date}
                    onChange={(e) => setSessionForm(prev => ({ ...prev, date: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  <input
                    placeholder="Time (e.g. 09:00 - 12:00 PHT)"
                    value={sessionForm.time}
                    onChange={(e) => setSessionForm(prev => ({ ...prev, time: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  <input
                    placeholder="Venue"
                    value={sessionForm.venue}
                    onChange={(e) => setSessionForm(prev => ({ ...prev, venue: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  <input
                    placeholder="Speaker / Facilitator"
                    value={sessionForm.speaker}
                    onChange={(e) => setSessionForm(prev => ({ ...prev, speaker: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  <input
                    type="number"
                    max={40}
                    placeholder="Capacity (max 40)"
                    value={sessionForm.capacity}
                    onChange={(e) => setSessionForm(prev => ({ ...prev, capacity: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                  />
                  <button
                    onClick={submitNewSession}
                    className="sm:col-span-2 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 cursor-pointer"
                  >
                    Save Session
                  </button>
                </div>
              )}

              <MobileScrollHint />
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
                      <th className="p-4 font-bold">Title</th>
                      <th className="p-4 font-bold">Date &amp; Time</th>
                      <th className="p-4 font-bold">Venue</th>
                      <th className="p-4 font-bold">Speaker</th>
                      <th className="p-4 font-bold">Attending / Capacity</th>
                      <th className="p-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pmesSessions.map(s => {
                      const isEditing = editingSessionId === s.id;
                      return (
                        <tr key={s.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 align-top">
                          {isEditing ? (
                            <>
                              <td className="p-4">
                                <input
                                  value={sessionEditDraft.title}
                                  onChange={(e) => setSessionEditDraft(prev => ({ ...prev, title: e.target.value }))}
                                  className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                                />
                              </td>
                              <td className="p-4 space-y-1.5">
                                <input
                                  type="date"
                                  value={sessionEditDraft.date}
                                  onChange={(e) => setSessionEditDraft(prev => ({ ...prev, date: e.target.value }))}
                                  className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                                />
                                <input
                                  value={sessionEditDraft.time}
                                  onChange={(e) => setSessionEditDraft(prev => ({ ...prev, time: e.target.value }))}
                                  className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                                />
                              </td>
                              <td className="p-4">
                                <input
                                  value={sessionEditDraft.venue}
                                  onChange={(e) => setSessionEditDraft(prev => ({ ...prev, venue: e.target.value }))}
                                  className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                                />
                              </td>
                              <td className="p-4">
                                <input
                                  value={sessionEditDraft.speaker}
                                  onChange={(e) => setSessionEditDraft(prev => ({ ...prev, speaker: e.target.value }))}
                                  className="w-full px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                                />
                              </td>
                              <td className="p-4">
                                <input
                                  type="number"
                                  max={40}
                                  value={sessionEditDraft.capacity}
                                  onChange={(e) => setSessionEditDraft(prev => ({ ...prev, capacity: e.target.value }))}
                                  className="w-20 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                                />
                              </td>
                              <td className="p-4">
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => submitEditSession(s.id)} className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer">
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setEditingSessionId(null)} className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-4 font-semibold text-slate-900 dark:text-white">{s.title}</td>
                              <td className="p-4 text-slate-600 dark:text-slate-300">{s.date} | {s.time}</td>
                              <td className="p-4 text-slate-600 dark:text-slate-300">{s.venue || '—'}</td>
                              <td className="p-4 text-slate-600 dark:text-slate-300">{s.speaker || '—'}</td>
                              <td className="p-4 text-slate-600 dark:text-slate-300">{s.registeredCount} / {s.capacity}</td>
                              <td className="p-4">
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => setAttendanceSession(s)} className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer" title="Attendance / Roster">
                                    <Users className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => startEditSession(s)} className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer">
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => onDeletePmesSession(s.id)} className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/60 cursor-pointer">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminTab === 'ledger' && (
            <ShareCapitalLedger
              members={members}
              ledger={ledger}
              onAddMember={onAddMember}
              onUpdateMember={onUpdateMember}
              onAddLedgerEntry={onAddLedgerEntry}
              onVerifyLedgerEntry={onVerifyLedgerEntry}
              withdrawals={withdrawals}
              onApproveWithdrawal={onApproveWithdrawal}
              onSendWithdrawal={onSendWithdrawal}
              onRejectWithdrawal={onRejectWithdrawal}
              onToast={onToast}
              currentUserId={admin.id}
            />
          )}

          {adminTab === 'analytics' && (
            <ExecDashboard
              products={products}
              orders={orders}
              members={members}
              ledger={ledger}
              onVerifyOrder={onVerifyOrder}
              onUpdateProductStock={onUpdateProductStock}
              onApplyPromo={onApplyPromo}
              onToast={onToast}
              isDarkMode={isDarkMode}
            />
          )}

          {adminTab === 'analytics' && (
            <CoopInsights
              members={members}
              ledger={ledger}
              withdrawals={withdrawals}
              orders={orders}
              applicants={applicants}
              isDarkMode={isDarkMode}
            />
          )}

          {adminTab === 'reports' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-3">
                <FileText className="w-6 h-6 text-emerald-700" />
                <h3 className="font-bold text-slate-900 dark:text-white">Sales Report</h3>
                <p className="text-xs text-slate-500">₱{totalSales.toLocaleString()} verified revenue across {realizedOrders.length} orders.</p>
                <button onClick={() => printSalesReport(realizedOrders)} className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline cursor-pointer">
                  <Printer className="w-3.5 h-3.5" /> Print Report
                </button>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-3">
                <Users className="w-6 h-6 text-violet-700" />
                <h3 className="font-bold text-slate-900 dark:text-white">Membership Report</h3>
                <p className="text-xs text-slate-500">{members.filter(m => m.status !== 'Removed').length} members, {pendingApplicants} pending applications.</p>
                <button onClick={() => printMembershipReport(members, pendingApplicants)} className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline cursor-pointer">
                  <Printer className="w-3.5 h-3.5" /> Print Report
                </button>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-3">
                <Boxes className="w-6 h-6 text-rose-700" />
                <h3 className="font-bold text-slate-900 dark:text-white">Inventory Report</h3>
                <p className="text-xs text-slate-500">{products.length} products, {lowStockProducts.length} below {LOW_STOCK_THRESHOLD} units.</p>
                <button onClick={() => printInventoryReport(products, LOW_STOCK_THRESHOLD)} className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline cursor-pointer">
                  <Printer className="w-3.5 h-3.5" /> Print Report
                </button>
              </div>
            </div>
          )}

          {adminTab === 'settings' && (
            <div className="max-w-lg space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                  {admin?.avatarUrl ? (
                    <img
                      src={resolveImageUrl(admin.avatarUrl)}
                      alt=""
                      onClick={() => setViewedAvatarUrl(resolveImageUrl(admin.avatarUrl))}
                      title="View full photo"
                      className="w-12 h-12 rounded-full object-cover cursor-pointer hover:opacity-80 transition"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold uppercase">
                      {(admin?.name || 'AD').slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{admin?.name || 'Admin User'}</p>
                    <p className="text-xs text-slate-400">{admin?.email}</p>
                  </div>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="ml-auto px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" /> {uploadingAvatar ? 'Uploading…' : 'Change Photo'}
                  </button>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{isDarkMode ? 'Dark Mode' : 'Light Mode'}</p>
                    <p className="text-xs text-slate-400">Toggle the site-wide color theme.</p>
                  </div>
                  <button
                    onClick={onToggleDarkMode}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    {isDarkMode ? <Sun className="w-4.5 h-4.5 text-amber-500" /> : <Moon className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>

        <Footer />
      </div>
    </div>
  );
}
