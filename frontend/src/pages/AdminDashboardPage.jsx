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
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  History,
} from 'lucide-react';
import bocofacLogo from '../assets/bocofac-logo.jpg';
import { formatDate } from '../utils/formatDate';
import { printSalesReport, printMembershipReport, printInventoryReport } from '../utils/printDocument';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import { productCode } from '../utils/productCode';
import { isLowStock, reorderLevelOf, DEFAULT_REORDER_LEVEL } from '../utils/stock';
import ApplicantDetailModal from '../components/ApplicantDetailModal';
import MemberDetailModal from '../components/MemberDetailModal';
import MobileScrollHint from '../components/MobileScrollHint';
import ExecDashboard from '../components/ExecDashboard';
import ImageLightbox from '../components/ImageLightbox';
import SearchBar, { matchesSearch } from '../components/SearchBar';
import SalesForecast from '../components/SalesForecast';
import SalesRecords from '../components/SalesRecords';
import StockModal from '../components/StockModal';
import ShareCapitalLedger from '../components/ShareCapitalLedger';
import PmesAttendanceModal from '../components/PmesAttendanceModal';
import Footer from '../components/Footer';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
const PRODUCT_CATEGORIES = ['Charcoal', 'Fertilizer', 'Fibre & Coir', 'Handicraft'];
const EMPTY_PRODUCT_FORM = { name: '', category: PRODUCT_CATEGORIES[0], description: '', price: '', stock: '', unit: '', specifications: '', imageFile: null, variantGroup: '', variantLabel: '', discountPercent: '', reorderLevel: '' };

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

const NAV_SECTIONS = [
  {
    label: 'Store',
    items: [
      { key: 'products', label: 'Products', icon: Box },
      { key: 'orders', label: 'Orders', icon: ShoppingBag },
      { key: 'sales', label: 'Sales Records', icon: Receipt },
      { key: 'inventory', label: 'Inventory', icon: Boxes },
    ],
  },
  {
    label: 'Cooperative',
    items: [
      { key: 'membership', label: 'Membership', icon: Users },
      { key: 'pmes', label: 'PMES Schedule', icon: Calendar },
      { key: 'ledger', label: 'Share Capital', icon: PhilippinePeso },
    ],
  },
  {
    label: 'Insights',
    items: [
      { key: 'analytics', label: 'Analytics', icon: BarChart3 },
      { key: 'reports', label: 'Reports', icon: FileText },
    ],
  },
  {
    label: 'System',
    items: [
      { key: 'settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
];
const SIDEBAR_COLLAPSED_KEY = 'bocofac.adminSidebarCollapsed';

const STOCK_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Low Stock' },
  { key: 'out', label: 'Out of Stock' },
  { key: 'in', label: 'In Stock' },
];
const STOCK_FILTER_TESTS = {
  all: () => true,
  low: p => p.stock > 0 && isLowStock(p),
  out: p => p.stock === 0,
  in: p => !isLowStock(p),
};
const STOCK_SORTS = {
  'stock-asc': (a, b) => a.stock - b.stock || a.name.localeCompare(b.name),
  'stock-desc': (a, b) => b.stock - a.stock || a.name.localeCompare(b.name),
  name: (a, b) => a.name.trim().localeCompare(b.name.trim()),
  category: (a, b) => a.category.localeCompare(b.category) || a.stock - b.stock,
};

// [UI] Hanay ng filter buttons na may bilang; pula ang bilang ng mga kailangang asikasuhin
function FilterChips({ options, value, onChange, label }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map(f => {
        const active = value === f.key;
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            aria-pressed={active}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer transition-colors ${
              active
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {f.label}
            <span className={`px-1.5 rounded-full text-[10px] tabular-nums ${
              active ? 'bg-white/25 text-white' : f.alert && f.count > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}>
              {f.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// [INVENTORY] Filter ayon sa stock + search + sort (Products at Inventory tabs)
function StockFilterBar({ filter, onFilter, counts, search, onSearch, sort, onSort }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
      <FilterChips
        label="Filter by stock status"
        value={filter}
        onChange={onFilter}
        options={STOCK_FILTERS.map(f => ({ ...f, count: counts[f.key], alert: f.key === 'low' || f.key === 'out' }))}
      />
      <div className="flex flex-col sm:flex-row gap-2 lg:ml-auto lg:w-auto">
        <SearchBar value={search} onChange={onSearch} placeholder="Search ID or product" />
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value)}
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
  );
}

// [MEMBERSHIP] Nakadalo na sa PMES = handa na para sa desisyon ng Board
const isReadyForBoard = (a) => a.status === 'Pending Review';

// [MEMBERSHIP] Progress ng application: Applied → PMES Seminar → Board Review
function ApplicationProgress({ ready, pmesDate }) {
  const steps = ['Applied', 'PMES', 'Board'];
  const current = ready ? 2 : 1;
  return (
    <div className="min-w-[180px]">
      <div className="flex items-center">
        {steps.map((step, i) => (
          <React.Fragment key={step}>
            {i > 0 && <span className={`h-0.5 flex-1 ${i <= current ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />}
            <span
              title={step}
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                i < current ? 'bg-emerald-600 text-white'
                  : i === current ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
              }`}
            >
              {i < current ? '✓' : i + 1}
            </span>
          </React.Fragment>
        ))}
      </div>
      <p className={`mt-1.5 text-xs font-bold ${ready ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
        {ready ? 'Ready for Board approval' : 'Waiting for PMES seminar'}
      </p>
      {ready && pmesDate && <p className="text-[11px] text-slate-400">Attended PMES {formatDate(pmesDate)}</p>}
    </div>
  );
}

function ProductRow({ variants, onOpenStock, openEditProduct, handleDeleteProduct }) {
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
      <td className="p-4 whitespace-nowrap">
        <span className={isLowStock(p) ? 'text-rose-600 font-bold' : 'text-slate-700 dark:text-slate-300'}>
          {p.stock} {p.unit}
        </span>
        <span className="block text-[10px] text-slate-400">Reorder at {reorderLevelOf(p)}</span>
      </td>
      <td className="p-4">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onOpenStock(p.id, 'update')}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
          >
            Update Stock
          </button>
          <button
            onClick={() => onOpenStock(p.id, 'history')}
            title="Stock history"
            aria-label={`Stock history of ${p.name}`}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
          >
            <History className="w-4 h-4" />
          </button>
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
  onWalkInRecorded,
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
  // [UI] Naaalala ang liit/laki ng sidebar sa browser na ito
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  const toggleSidebar = () => {
    setSidebarCollapsed(c => {
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, c ? '0' : '1'); } catch { /* storage off - session lang */ }
      return !c;
    });
  };
  // [INVENTORY] Bukas na stock modal: { productId, view: 'update' | 'history' }
  const [stockModal, setStockModal] = useState(null);
  const stockModalProduct = stockModal && products.find(p => p.id === stockModal.productId);
  const openStockModal = (productId, view) => setStockModal({ productId, view });
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

  // [MEMBERSHIP] Ang na-approve na applicant ay nasa Members na, kaya wala na sa listahan ng applications
  const [applicantFilter, setApplicantFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');
  // [MEMBERSHIP] Naghihintay lang ang nasa listahan: ang Approved ay nasa Members na, ang Rejected ay nakatago
  // (makikita sa "View rejected"). Dalawa ang yugto: hinihintay pang dumalo sa PMES, o handa na para sa Board.
  const [showRejectedApplicants, setShowRejectedApplicants] = useState(false);
  const openApplicants = useMemo(() => filteredApplicants
    .filter(a => a.status !== 'Approved' && a.status !== 'Rejected')
    .sort((a, b) => (isReadyForBoard(b) - isReadyForBoard(a)) || (new Date(a.submittedAt) - new Date(b.submittedAt))),
  [filteredApplicants]);
  const rejectedApplicants = useMemo(() => filteredApplicants.filter(a => a.status === 'Rejected'), [filteredApplicants]);
  const applicantFilters = useMemo(() => [
    { key: 'all', label: 'All', test: () => true },
    { key: 'pmes', label: 'Waiting for PMES', test: a => !isReadyForBoard(a) },
    { key: 'board', label: 'Ready for Board Review', test: isReadyForBoard, alert: true },
  ].map(f => ({ ...f, count: openApplicants.filter(f.test).length })), [openApplicants]);
  const applicantRows = showRejectedApplicants ? rejectedApplicants : openApplicants.filter(applicantFilters.find(f => f.key === applicantFilter).test);
  const memberFilters = useMemo(() => [
    { key: 'all', label: 'All', test: () => true },
    { key: 'Active', label: 'Active', test: m => m.status === 'Active' },
    { key: 'Delinquent', label: 'Delinquent', test: m => m.status === 'Delinquent', alert: true },
    { key: 'Removed', label: 'Removed', test: m => m.status === 'Removed' },
  ].map(f => ({ ...f, count: filteredMembers.filter(f.test).length })), [filteredMembers]);
  const memberRows = filteredMembers.filter(memberFilters.find(f => f.key === memberFilter).test);

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
  const lowStockProducts = useMemo(() => products.filter(isLowStock), [products]);

  // [INVENTORY] Filter + search + sort; default: pinakamababang stock muna para magkakasunod ang low stock
  const [inventoryFilter, setInventoryFilter] = useState('all');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventorySort, setInventorySort] = useState('stock-asc');
  const inventoryCounts = useMemo(() => ({
    all: products.length,
    low: products.filter(STOCK_FILTER_TESTS.low).length,
    out: products.filter(p => p.stock === 0).length,
    in: products.filter(STOCK_FILTER_TESTS.in).length,
  }), [products, lowStockProducts]);
  const inventoryRows = useMemo(() => products
    .filter(p => STOCK_FILTER_TESTS[inventoryFilter](p) && matchesSearch(inventorySearch, productCode(p), p.id, p.name, p.category, p.unit))
    .sort(STOCK_SORTS[inventorySort]),
  [products, inventoryFilter, inventorySearch, inventorySort]);

  // [PRODUCTS] Parehong filter/sort; ang may sukat (variants) ay naka-grupo,
  // at ang grupo ay inaayos ayon sa variant na pinakakaunti/pinakamarami ang stock
  const [productFilter, setProductFilter] = useState('all');
  const [productSearch, setProductSearch] = useState('');
  const [productSort, setProductSort] = useState('stock-asc');
  const productGroups = useMemo(() => {
    const compare = STOCK_SORTS[productSort];
    const matching = products
      .filter(p => STOCK_FILTER_TESTS[productFilter](p) && matchesSearch(productSearch, productCode(p), p.id, p.name, p.category, p.unit))
      .sort(compare);
    return groupProductsForDisplay(matching);
  }, [products, productFilter, productSearch, productSort]);

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
      reorderLevel: String(reorderLevelOf(p)),
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
    formData.append('reorderLevel', productForm.reorderLevel === '' ? String(DEFAULT_REORDER_LEVEL) : productForm.reorderLevel);
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
    sales: 'Sales Records',
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

  // [UI] Sidebar: nakagrupo bawat section; kapag collapsed, icons lang (may tooltip)
  const SidebarNav = ({ onNavigate, collapsed = false, onToggle }) => (
    <>
      <div className={`h-20 flex items-center gap-2.5 border-b border-slate-200/80 dark:border-slate-800 shrink-0 ${collapsed ? 'justify-center px-2' : 'px-4'}`}>
        {!collapsed && (
          <>
            <img src={bocofacLogo} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
            <span className="font-serif font-extrabold tracking-tight text-lg text-slate-900 dark:text-white truncate">BOCOFAC</span>
          </>
        )}
        {onToggle && (
          <button
            onClick={onToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer transition-colors ${collapsed ? '' : 'ml-auto'}`}
          >
            {collapsed ? <PanelLeftOpen className="w-[18px] h-[18px]" /> : <PanelLeftClose className="w-[18px] h-[18px]" />}
          </button>
        )}
      </div>
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-5 ${collapsed ? 'px-2' : 'px-3'}`}>
        {NAV_SECTIONS.map(section => (
          <div key={section.label} className="space-y-0.5">
            {collapsed ? (
              <div className="mx-auto mb-2 w-6 border-t border-slate-200 dark:border-slate-800" />
            ) : (
              <p className="px-2.5 pb-1.5 text-[10.5px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{section.label}</p>
            )}
            {section.items.map(item => {
              const Icon = item.icon;
              const isActive = adminTab === item.key;
              const badgeCount = navBadgeCounts[item.key] || 0;
              return (
                <button
                  key={item.key}
                  onClick={() => { setAdminTab(item.key); onNavigate?.(); }}
                  title={collapsed ? `${item.label}${badgeCount > 0 ? ` (${badgeCount})` : ''}` : undefined}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative w-full flex items-center gap-2.5 h-9 rounded-lg text-[13.5px] cursor-pointer transition-colors text-left ${
                    collapsed ? 'justify-center px-0' : 'px-2.5'
                  } ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 font-semibold dark:bg-emerald-900/40 dark:text-emerald-200'
                      : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-white'
                  }`}
                >
                  {isActive && !collapsed && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-emerald-600 dark:bg-emerald-400" />}
                  <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.9} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {badgeCount > 0 && (collapsed ? (
                    <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                  ) : (
                    <span className="ml-auto rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 px-1.5 py-0.5 text-[10.5px] font-bold leading-none tabular-nums">
                      {badgeCount}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className={`border-t border-slate-200/80 dark:border-slate-800 p-3 flex items-center gap-2.5 shrink-0 ${collapsed ? 'flex-col' : ''}`}>
        {admin?.avatarUrl ? (
          <img
            src={resolveImageUrl(admin.avatarUrl)}
            alt=""
            onClick={() => setViewedAvatarUrl(resolveImageUrl(admin.avatarUrl))}
            title="View full photo"
            className="w-8 h-8 rounded-full object-cover shrink-0 cursor-pointer hover:opacity-80 transition"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-sm">
            {(admin?.name || 'A').slice(0, 1)}
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold leading-tight text-slate-800 dark:text-slate-100">{admin?.name || 'Admin User'}</p>
            <p className="truncate text-[11px] leading-tight text-slate-400">{admin?.email || 'Administrator'}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          title="Logout"
          aria-label="Logout"
          className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 cursor-pointer transition-colors shrink-0"
        >
          <LogOut className="w-[18px] h-[18px]" />
        </button>
      </div>
    </>
  );

  return (
    <div className="h-screen flex bg-[#faf8f4] dark:bg-slate-950 text-slate-900 dark:text-slate-100">

      <aside className={`hidden md:flex ${sidebarCollapsed ? 'w-[68px]' : 'w-60'} transition-[width] duration-200 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 flex-col shrink-0 select-none sticky top-0 h-[calc(100vh-var(--footer-h,0px))]`}>
        <SidebarNav collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </aside>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-white dark:bg-slate-900 flex flex-col h-full shadow-xl">
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
                  <div>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder={`Reorder level (default ${DEFAULT_REORDER_LEVEL})`}
                      aria-label="Reorder level"
                      value={productForm.reorderLevel}
                      onChange={(e) => setProductForm(prev => ({ ...prev, reorderLevel: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Marked Low Stock when the stock reaches this number.</p>
                  </div>
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

              <StockFilterBar
                filter={productFilter}
                onFilter={setProductFilter}
                counts={inventoryCounts}
                search={productSearch}
                onSearch={setProductSearch}
                sort={productSort}
                onSort={setProductSort}
              />
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
                      <th className="p-4 font-bold text-right">Stock</th>
                      <th className="p-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productGroups.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-sm text-slate-400">
                          {productSearch ? `No products match "${productSearch}".` : 'No products in this group.'}
                        </td>
                      </tr>
                    )}
                    {productGroups.map(({ key, variants }) => (
                      <ProductRow
                        key={key}
                        variants={variants}
                        onOpenStock={openStockModal}
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

          {stockModalProduct && (
            <StockModal
              key={stockModalProduct.id}
              product={stockModalProduct}
              initialView={stockModal.view}
              onClose={() => setStockModal(null)}
              onSubmit={onUpdateProductStock}
            />
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

          {adminTab === 'sales' && (
            <SalesRecords orders={orders} products={products} onWalkInRecorded={onWalkInRecorded} />
          )}

          {adminTab === 'inventory' && (
            <>
              <StockFilterBar
                filter={inventoryFilter}
                onFilter={setInventoryFilter}
                counts={inventoryCounts}
                search={inventorySearch}
                onSearch={setInventorySearch}
                sort={inventorySort}
                onSort={setInventorySort}
              />
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
                    <th className="p-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-sm text-slate-400">
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
                            className={`h-full ${p.stock === 0 ? 'bg-rose-500' : isLowStock(p) ? 'bg-amber-400' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, (p.stock / 400) * 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{p.stock} {p.unit} · reorder at {reorderLevelOf(p)}</p>
                      </td>
                      <td className="p-4">
                        {p.stock === 0 ? (
                          <span className="text-sm font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">Out of Stock</span>
                        ) : isLowStock(p) ? (
                          <span className="text-sm font-bold text-amber-500 dark:text-amber-400 whitespace-nowrap">Low Stock</span>
                        ) : (
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">In Stock</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openStockModal(p.id, 'update')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
                          >
                            Update
                          </button>
                          <button
                            onClick={() => openStockModal(p.id, 'history')}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-xs font-bold cursor-pointer flex items-center gap-1"
                          >
                            <History className="w-3.5 h-3.5" /> History
                          </button>
                        </div>
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <h3 className="font-bold text-slate-900 dark:text-white">{showRejectedApplicants ? 'Rejected Applications' : 'Applications'}</h3>
                {showRejectedApplicants ? (
                  <button
                    type="button"
                    onClick={() => setShowRejectedApplicants(false)}
                    className="self-start px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    ← Back to waiting applications
                  </button>
                ) : (
                  <FilterChips label="Filter applications" value={applicantFilter} onChange={setApplicantFilter} options={applicantFilters} />
                )}
              </div>
              <p className="text-xs text-slate-400 -mt-3">
                {showRejectedApplicants
                  ? 'Applications the Board did not approve. Kept for reference only.'
                  : 'Applicants still waiting. Approved ones move to Members below; the Board approves or rejects them.'}
              </p>
              <MobileScrollHint />
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
                      <th className="p-4 font-bold">Applicant</th>
                      <th className="p-4 font-bold">Agricultural Type</th>
                      <th className="p-4 font-bold">Applied</th>
                      <th className="p-4 font-bold">{showRejectedApplicants ? 'Status' : 'Progress'}</th>
                      <th className="p-4 font-bold text-right">Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applicantRows.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-sm text-slate-400">
                        {memberSearch ? `No applicants match "${memberSearch}".` : showRejectedApplicants ? 'No rejected applications.' : 'No one is waiting right now.'}
                      </td></tr>
                    )}
                    {applicantRows.map(a => (
                      <tr key={a.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                        <td className="p-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{a.fullName}</p>
                          <p className="text-xs text-slate-400">{a.email}</p>
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{a.agriculturalType || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                        <td className="p-4 whitespace-nowrap">
                          <p className="text-slate-700 dark:text-slate-200">{a.submittedAt ? formatDate(a.submittedAt) : '—'}</p>
                          {a.submittedAt && (() => {
                            const days = Math.max(0, Math.floor((Date.now() - new Date(a.submittedAt)) / 86400000));
                            return <p className={`text-[11px] ${days >= 30 && !showRejectedApplicants ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>{days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'} ago`}</p>;
                          })()}
                        </td>
                        <td className="p-4">
                          {showRejectedApplicants ? (
                            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Rejected</span>
                          ) : (
                            <ApplicationProgress ready={isReadyForBoard(a)} pmesDate={a.pmesDate} />
                          )}
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

              {!showRejectedApplicants && rejectedApplicants.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowRejectedApplicants(true)}
                  className="-mt-3 self-start text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:underline cursor-pointer"
                >
                  View rejected applications ({rejectedApplicants.length})
                </button>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                <h3 className="font-bold text-slate-900 dark:text-white">Members</h3>
                <FilterChips label="Filter members" value={memberFilter} onChange={setMemberFilter} options={memberFilters} />
              </div>
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
                    {memberRows.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-sm text-slate-400">
                        {memberSearch ? `No members match "${memberSearch}".` : 'No members here.'}
                      </td></tr>
                    )}
                    {memberRows.map(m => (
                      <tr key={m.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                        <td className="p-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{m.name}</p>
                          <p className="text-xs text-slate-400">{m.email}</p>
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{formatDate(m.joinedDate)}</td>
                        <td className="p-4">
                          <span className={`text-xs font-bold whitespace-nowrap ${
                            m.status === 'Active' ? 'text-emerald-700 dark:text-emerald-400' :
                            m.status === 'Delinquent' ? 'text-amber-600 dark:text-amber-400' :
                            'text-rose-600 dark:text-rose-400'
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
            <SalesForecast orders={orders} products={products} isDarkMode={isDarkMode}>
              <ExecDashboard products={products} orders={orders} isDarkMode={isDarkMode} />
            </SalesForecast>
          )}

          {adminTab === 'reports' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-3">
                <FileText className="w-6 h-6 text-emerald-700" />
                <h3 className="font-bold text-slate-900 dark:text-white">Sales Report</h3>
                <p className="text-xs text-slate-500">₱{totalSales.toLocaleString()} verified revenue across {realizedOrders.length} orders.</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <button onClick={() => printSalesReport(realizedOrders)} className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline cursor-pointer">
                    <Printer className="w-3.5 h-3.5" /> Print All
                  </button>
                  <button onClick={() => setAdminTab('sales')} className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline cursor-pointer">
                    <Calendar className="w-3.5 h-3.5" /> By date range
                  </button>
                </div>
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
                <p className="text-xs text-slate-500">{products.length} products, {lowStockProducts.length} at or below their reorder level.</p>
                <button onClick={() => printInventoryReport(products)} className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline cursor-pointer">
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
