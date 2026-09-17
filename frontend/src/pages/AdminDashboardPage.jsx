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
} from 'lucide-react';
import { formatDate } from '../utils/formatDate';
import { displayApplicantStatus } from '../utils/applicantStatus';
import { printSalesReport, printMembershipReport, printInventoryReport } from '../utils/printDocument';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import bocofacLogo from '../assets/bocofac-logo.jpg';
import ExecDashboard from '../components/ExecDashboard';
import ShareCapitalLedger from '../components/ShareCapitalLedger';
import PmesAttendanceModal from '../components/PmesAttendanceModal';
import Footer from '../components/Footer';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
const LOW_STOCK_THRESHOLD = 20;
// Mirrors the CHECK constraint on products.category in backend/src/db/schema.sql.
const PRODUCT_CATEGORIES = ['Charcoal', 'Fertilizer', 'Fibre & Coir', 'Handicraft'];
const EMPTY_PRODUCT_FORM = { name: '', category: PRODUCT_CATEGORIES[0], description: '', price: '', stock: '', unit: '', specifications: '', imageFile: null, variantGroup: '', variantLabel: '', discountPercent: '' };

// The cooperative doesn't track courier hand-off in stages - once payment is
// verified an order sits as 'Processing' until admin hands it to the
// courier, which is the one action exposed in the UI. That action still
// writes the backend's existing 'Shipped' value (no schema/API change) but
// is only ever presented and labeled as "Delivered to Courier". 'Out for
// Delivery' and 'Delivered' remain valid legacy values (orders placed before
// this simplification) but are no longer reachable from the UI.
const ORDER_FULFILLMENT_STATUSES = ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'];
const ORDER_STATUS_LABELS = { Shipped: 'Delivered to Courier' };
const getOrderStatusLabel = (status) => ORDER_STATUS_LABELS[status] || status;
// The payment decision (verify or reject) is the only thing "active" about
// an order - once that's made, it's a settled record, not something to act
// on, so it moves to "History" (read-only there, see the receipt modal's
// status check below) instead of cluttering the default "Active" view.
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
  const [rejectReasonDraft, setRejectReasonDraft] = useState('');
  // Branded stand-in for window.confirm() on the reject/confirm-payment
  // actions below - shape: { tone: 'danger'|'success', title, message,
  // confirmLabel, onConfirm }.
  const [confirmPrompt, setConfirmPrompt] = useState(null);
  // Orders tab defaults to only orders still needing action - otherwise
  // completed/rejected orders pile up and bury the ones that actually need
  // attention as new orders come in. History stays one click away, not
  // deleted or moved out of the database, just filtered out of the default
  // view.
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

  // ── Real stat calculations ──
  const realizedOrders = useMemo(() => orders.filter(o => o.status !== 'Pending Verification' && o.status !== 'Rejected' && o.status !== 'Cancelled'), [orders]);
  const totalSales = useMemo(() => realizedOrders.reduce((sum, o) => sum + o.totalAmount, 0), [realizedOrders]);
  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'Pending Verification').length, [orders]);
  const visibleOrders = useMemo(
    () => orders.filter(o => ORDER_HISTORY_STATUSES.includes(o.status) === (orderView === 'history')),
    [orders, orderView]
  );
  const pendingApplicants = useMemo(() => applicants.filter(a => a.status !== 'Approved' && a.status !== 'Rejected').length, [applicants]);
  const lowStockProducts = useMemo(() => products.filter(p => p.stock < LOW_STOCK_THRESHOLD), [products]);

  // Same three underlying counts power both the sidebar's per-tab red dots
  // and the notification bell dropdown below, so they never disagree. These
  // are real unresolved-item counts (not a "seen/unseen" flag) - a dot only
  // clears once the item is actually acted on (verified/rejected/approved/
  // restocked), not just by navigating to or glancing at the tab.
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
      if (editingProductId) {
        formData.append('discountPercent', productForm.discountPercent || '0');
        await onUpdateProduct(editingProductId, formData);
      } else {
        formData.append('stock', productForm.stock || '0');
        await onAddProduct(formData);
      }
      closeProductForm();
    } finally {
      setSavingProduct(false);
    }
  };
  const handleDeleteProduct = (product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    onDeleteProduct(product.id);
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
        <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-md overflow-hidden">
          <img src={bocofacLogo} alt="BOCOFAC" className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0">
          <h1 className="font-serif text-white font-extrabold tracking-tight text-2xl leading-tight">BOCOFAC</h1>
          <p className="text-emerald-100/80 text-sm font-semibold uppercase tracking-wider">Admin Panel</p>
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

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-72 bg-gradient-to-b from-emerald-600 to-emerald-700 dark:from-emerald-800 dark:to-emerald-950 flex-col shrink-0 select-none sticky top-0 h-[calc(100vh-var(--footer-h,0px))] overflow-y-auto">
        <SidebarNav />
      </aside>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-72 bg-gradient-to-b from-emerald-600 to-emerald-700 dark:from-emerald-800 dark:to-emerald-950 flex flex-col h-full">
            <SidebarNav onNavigate={() => setMobileMenuOpen(false)} />
          </div>
          <div className="flex-1 bg-slate-950/50" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">

        {/* Top header */}
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
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden z-50">
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
            <div className="flex items-center gap-2.5">
              {admin?.avatarUrl ? (
                <img src={resolveImageUrl(admin.avatarUrl)} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                  {(admin?.name || 'AD').slice(0, 1)}
                </div>
              )}
              <div className="hidden sm:block text-left">
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{admin?.name || 'Admin User'}</p>
                <p className="text-xs text-slate-400 leading-tight">Administrator</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-grow p-4 sm:p-8 overflow-y-auto w-full space-y-6" style={{ paddingBottom: 'calc(var(--footer-h, 0px) + 2rem)' }}>

          {adminTab === 'analytics' && (
            <>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Overview</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Total Sales</p>
                    <p className="text-2xl font-extrabold text-emerald-600">₱{totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs font-semibold text-emerald-600 mt-1">Verified revenue to date</p>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Total Orders</p>
                    <p className="text-2xl font-extrabold text-sky-600">{orders.length}</p>
                    <p className="text-xs font-semibold text-sky-600 mt-1">{pendingOrders} pending</p>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-sky-100 dark:bg-sky-950/50 flex items-center justify-center text-sky-700 dark:text-sky-400 shrink-0">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Total Members</p>
                    <p className="text-2xl font-extrabold text-violet-600">{members.length}</p>
                    <p className="text-xs font-semibold text-violet-600 mt-1">{pendingApplicants} pending applications</p>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center text-violet-700 dark:text-violet-400 shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Low Stock Alert</p>
                    <p className="text-2xl font-extrabold text-rose-600">{lowStockProducts.length}</p>
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

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
                      <th className="p-4 font-bold">Product</th>
                      <th className="p-4 font-bold">Category</th>
                      <th className="p-4 font-bold">Price</th>
                      <th className="p-4 font-bold">Stock</th>
                      <th className="p-4 font-bold text-right">Restock</th>
                      <th className="p-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                        <td className="p-4 font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-3">
                            <img src={resolveImageUrl(p.image)} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0" />
                            <span>
                              {p.name}
                              {p.variantGroup && (
                                <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400 align-middle">
                                  SIZE: {p.variantLabel}
                                </span>
                              )}
                            </span>
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
                      <td className="p-4">
                        <span className={`text-xs font-bold ${ORDER_STATUS_COLORS[o.status] || ORDER_STATUS_COLORS['Pending Verification']}`}>{getOrderStatusLabel(o.status)}</span>
                        {o.status === 'Processing' && (
                          <button
                            onClick={() => onUpdateOrderStatus(o.id, 'Shipped')}
                            className="mt-1 block text-xs px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 font-bold cursor-pointer"
                          >
                            Mark as Delivered to Courier
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

          {/* Receipt Verification Modal - shows the reference number and
              the uploaded payment screenshot side by side so staff can
              actually confirm the transfer before hitting Verify. */}
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
                    className="w-full max-h-56 object-contain rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                  <p className="hidden text-sm text-slate-400 text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    No receipt screenshot on file for this order.
                  </p>
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

          {/* Branded confirmation prompt, replacing window.confirm() for the
              reject/confirm-payment actions above. Sits on top of the
              receipt modal (higher z-index) rather than replacing it, so
              cancelling just drops back to the receipt without losing the
              in-progress rejection reason draft. */}
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-auto min-h-[calc(100vh-11rem)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
                    <th className="p-4 font-bold">Product</th>
                    <th className="p-4 font-bold">Unit</th>
                    <th className="p-4 font-bold">Stock Level</th>
                    <th className="p-4 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                      <td className="p-4 font-semibold text-slate-900 dark:text-white">{p.name}</td>
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
                        {p.stock < LOW_STOCK_THRESHOLD ? (
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-rose-100 text-rose-800">Low Stock</span>
                        ) : (
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">In Stock</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {adminTab === 'membership' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
                <Users className="w-4 h-4 shrink-0" />
                <p>View-only. Applications are reviewed and approved by the Board of Directors.</p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
                      <th className="p-4 font-bold">Applicant</th>
                      <th className="p-4 font-bold">Agricultural Type</th>
                      <th className="p-4 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applicants.map(a => (
                      <tr key={a.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                        <td className="p-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{a.fullName}</p>
                          <p className="text-xs text-slate-400">{a.email}</p>
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{a.agriculturalType}</td>
                        <td className="p-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            a.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                            a.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>{displayApplicantStatus(a.status)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="font-bold text-slate-900 dark:text-white">Active Shareholders</h3>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
                      <th className="p-4 font-bold">Member</th>
                      <th className="p-4 font-bold">Joined</th>
                      <th className="p-4 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                <p className="text-xs text-slate-500">{members.length} members, {pendingApplicants} pending applications.</p>
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
                    <img src={resolveImageUrl(admin.avatarUrl)} alt="" className="w-12 h-12 rounded-full object-cover" />
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
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 font-bold text-sm cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          )}

        </main>

        <Footer />
      </div>
    </div>
  );
}
