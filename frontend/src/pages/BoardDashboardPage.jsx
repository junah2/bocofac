import React, { useState, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  FileText,
  Users,
  PhilippinePeso,
  Settings as SettingsIcon,
  LogOut,
  TrendingUp,
  ClipboardList,
  Printer,
  Moon,
  Sun,
  Check,
  X,
  Menu,
  Calendar,
  Camera,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { lastNMonths, lastNQuarters, bucketOrderRevenue } from '../utils/dateBuckets';
import { formatDate } from '../utils/formatDate';
import { getPmesDisplayStatus } from '../utils/pmesStatus';
import { displayApplicantStatus } from '../utils/applicantStatus';
import { printSalesReport, printMembershipReport, printInventoryReport } from '../utils/printDocument';
import ShareCapitalLedger from '../components/ShareCapitalLedger';
import PmesAttendanceModal from '../components/PmesAttendanceModal';
import Footer from '../components/Footer';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import bocofacLogo from '../assets/bocofac-logo.jpg';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
const PIE_COLORS = { Approved: '#6b7c52', Pending: '#f59e0b', Rejected: '#ef4444' };
const LOW_STOCK_THRESHOLD = 20;

export default function BoardDashboardPage({
  bod,
  setBod,
  setPage,
  products,
  orders,
  members,
  applicants,
  onUpdateApplicantStatus,
  pmesSessions,
  ledger,
  onVerifyLedgerEntry,
  withdrawals,
  onToast,
  isDarkMode,
  onToggleDarkMode,
}) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [reportRange, setReportRange] = useState('Monthly');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [viewedApplicant, setViewedApplicant] = useState(null);
  const [attendanceSession, setAttendanceSession] = useState(null);
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
      setBod(data);
      onToast?.('Profile photo updated.', 'success');
    } catch (err) {
      onToast?.(err.message || 'Failed to update profile photo.', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = () => {
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setBod(null);
    setPage('home');
  };

  // ── Stat calculations (real, derived from app data) ──
  const realizedOrders = useMemo(() => orders.filter(o => o.status !== 'Pending Verification' && o.status !== 'Rejected' && o.status !== 'Cancelled'), [orders]);
  const totalFinancial = useMemo(() => realizedOrders.reduce((sum, o) => sum + o.totalAmount, 0), [realizedOrders]);
  const totalSales = useMemo(() => products.reduce((sum, p) => sum + p.ordersCount, 0), [products]);
  const activeMembers = useMemo(() => members.filter(m => m.status === 'Active'), [members]);
  const newMembersThisMonth = useMemo(() => {
    const now = new Date();
    return members.filter(m => {
      const d = new Date(m.joinedDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [members]);
  const pendingApplicants = useMemo(() => applicants.filter(a => a.status !== 'Approved' && a.status !== 'Rejected').length, [applicants]);
  const approvedApplicants = useMemo(() => applicants.filter(a => a.status === 'Approved').length, [applicants]);
  const rejectedApplicants = useMemo(() => applicants.filter(a => a.status === 'Rejected').length, [applicants]);
  const delinquentMembers = useMemo(() => members.filter(m => m.status !== 'Active').length, [members]);

  // ── Reports tab breakdowns ──
  const pendingVerificationOrders = useMemo(() => orders.filter(o => o.status === 'Pending Verification').length, [orders]);
  const rejectedCancelledOrders = useMemo(() => orders.filter(o => o.status === 'Rejected' || o.status === 'Cancelled').length, [orders]);
  const avgOrderValue = useMemo(() => (realizedOrders.length ? totalFinancial / realizedOrders.length : 0), [realizedOrders, totalFinancial]);
  const lowStockProducts = useMemo(() => products.filter(p => p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD), [products]);
  const outOfStockProducts = useMemo(() => products.filter(p => p.stock === 0), [products]);

  // ── Financial Report chart data ──
  const financialChartData = useMemo(() => {
    const buckets = reportRange === 'Monthly' ? lastNMonths(6) : lastNQuarters(4);
    return bucketOrderRevenue(realizedOrders, buckets, reportRange);
  }, [realizedOrders, reportRange]);

  // ── Application status donut data ──
  const applicationStatusData = [
    { name: 'Pending', value: pendingApplicants },
    { name: 'Approved', value: approvedApplicants },
    { name: 'Rejected', value: rejectedApplicants },
  ].filter(d => d.value > 0);

  const recentApplicants = useMemo(
    () => [...applicants].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, 5),
    [applicants]
  );
  const recentMembers = useMemo(
    () => [...members].sort((a, b) => new Date(b.joinedDate) - new Date(a.joinedDate)).slice(0, 5),
    [members]
  );

  const lastUpdated = new Date();

  const NAV_ITEMS = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'reports', label: 'Reports', icon: FileText },
    { key: 'membership', label: 'Membership Management', icon: Users },
    { key: 'pmes', label: 'PMES Attendance', icon: Calendar },
    { key: 'ledger', label: 'Share Capital', icon: PhilippinePeso },
    { key: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const SidebarNav = ({ onNavigate }) => (
    <>
      <div className="px-6 pt-8 pb-7 flex items-center gap-3.5 border-b border-white/10">
        <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-md overflow-hidden">
          <img src={bocofacLogo} alt="BOCOFAC" className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0">
          <h1 className="font-serif text-white font-extrabold tracking-tight text-2xl leading-tight">BOCOFAC</h1>
          <p className="text-emerald-100/80 text-sm font-semibold uppercase tracking-wider">Board of Directors</p>
        </div>
      </div>
      <nav className="flex-1 flex flex-col gap-2 px-3.5 py-5">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => { setActiveTab(item.key); onNavigate?.(); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold cursor-pointer transition text-left ${
                isActive ? 'bg-white text-emerald-700 shadow-md' : 'text-emerald-50/90 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
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
    <div className="min-h-screen flex bg-[#faf8f4] dark:bg-slate-950 text-slate-900 dark:text-slate-100">

      {/* Desktop sidebar: fixed to the viewport (like the footer) so it never scrolls with the page */}
      <aside className="hidden md:flex w-72 bg-gradient-to-b from-emerald-600 to-emerald-700 dark:from-emerald-800 dark:to-emerald-950 flex-col shrink-0 select-none fixed top-0 left-0 z-20 h-[calc(100vh-var(--footer-h,0px))] overflow-y-auto">
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

      <div className="flex-1 min-w-0 md:ml-72">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3.5 bg-emerald-600 text-white sticky top-0 z-40">
          <span className="font-bold text-sm">BOCOFAC Board of Director</span>
          <button onClick={() => setMobileMenuOpen(true)}><Menu className="w-5 h-5" /></button>
        </div>

        <main className="p-4 sm:p-8 space-y-6" style={{ paddingBottom: 'calc(var(--footer-h, 0px) + 2rem)' }}>

          {activeTab === 'dashboard' && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Last updated: {lastUpdated.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="inline-flex rounded-xl bg-slate-200 dark:bg-slate-800 p-1 gap-1 w-fit">
                  {['Monthly', 'Quarterly'].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setReportRange(opt)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        reportRange === opt
                          ? 'bg-emerald-600 text-white shadow'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold">₱</div>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white">₱{totalFinancial.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Financial</p>
                  <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> vs last {reportRange === 'Monthly' ? 'month' : 'quarter'}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{totalSales.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Sales</p>
                  <p className="text-xs font-semibold text-emerald-600">Units sold to date</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-700 dark:text-amber-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{activeMembers.length}</p>
                  <p className="text-xs text-slate-400">Active Member</p>
                  <p className="text-xs font-semibold text-amber-600">+{newMembersThisMonth} new this month</p>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/50 flex items-center justify-center text-sky-700 dark:text-sky-400">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{applicants.length}</p>
                  <p className="text-xs text-slate-400">Application</p>
                  <p className="text-xs font-semibold text-slate-500">
                    <span className="text-amber-600">{pendingApplicants} pending</span>{'  '}
                    <span className="text-emerald-600">{approvedApplicants} Approved</span>
                  </p>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 dark:text-white">Financial Report</h3>
                    <button onClick={() => window.print()} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <LineChart data={financialChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString()} />
                        <Tooltip formatter={(v) => [`₱${v.toLocaleString()}`, 'Revenue']} />
                        <Line type="monotone" dataKey="amount" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4, fill: '#ef4444' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
                  <h3 className="font-bold text-slate-900 dark:text-white mb-4">Application Status</h3>
                  {applicationStatusData.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-10">No applications yet.</p>
                  ) : (
                    <>
                      <div style={{ width: '100%', height: 180 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={applicationStatusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                              {applicationStatusData.map((entry) => (
                                <Cell key={entry.name} fill={PIE_COLORS[entry.name]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2 mt-4">
                        {applicationStatusData.map(d => (
                          <div key={d.name} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[d.name] }} />
                              {d.name}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Recent activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 dark:text-white">Recent Applications</h3>
                    <button onClick={() => setActiveTab('membership')} className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer">View all</button>
                  </div>
                  {recentApplicants.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-10">No applications yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {recentApplicants.map(a => (
                        <div key={a.id} className="flex items-center justify-between gap-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{a.fullName}</p>
                            <p className="text-xs text-slate-400">{a.agriculturalType}</p>
                          </div>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                            a.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                            a.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>{a.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 dark:text-white">Recently Joined Members</h3>
                    <button onClick={() => setActiveTab('membership')} className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer">View all</button>
                  </div>
                  {recentMembers.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-10">No members yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {recentMembers.map(m => (
                        <div key={m.id} className="flex items-center justify-between gap-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{m.name}</p>
                            <p className="text-xs text-slate-400">Joined {formatDate(m.joinedDate)}</p>
                          </div>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                            m.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>{m.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Reports</h2>
                <p className="text-xs text-slate-500 mt-1">Snapshot as of {lastUpdated.toLocaleString('en-PH')}. Each report prints as a standalone document with a full itemized breakdown.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                    </div>
                    <span className="text-2xl font-extrabold text-slate-900 dark:text-white">₱{totalFinancial.toLocaleString()}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Sales & Financial Report</h3>
                    <p className="text-[11px] text-slate-400">Total realized revenue, verified orders only</p>
                  </div>
                  <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <ReportStatRow label="Verified Orders" value={realizedOrders.length} />
                    <ReportStatRow label="Average Order Value" value={`₱${avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                    <ReportStatRow label="Pending Verification" value={pendingVerificationOrders} tone={pendingVerificationOrders > 0 ? 'warn' : undefined} />
                    <ReportStatRow label="Rejected / Cancelled" value={rejectedCancelledOrders} tone={rejectedCancelledOrders > 0 ? 'danger' : undefined} />
                  </div>
                  <button onClick={() => printSalesReport(realizedOrders)} className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-xl py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer">
                    <Printer className="w-3.5 h-3.5" /> Print Report
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
                      <Users className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                    </div>
                    <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{activeMembers.length}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Membership Report</h3>
                    <p className="text-[11px] text-slate-400">Active members, out of {members.length} total</p>
                  </div>
                  <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <ReportStatRow label="New This Month" value={newMembersThisMonth} />
                    <ReportStatRow label="Delinquent Members" value={delinquentMembers} tone={delinquentMembers > 0 ? 'warn' : undefined} />
                    <ReportStatRow label="Pending Applications" value={pendingApplicants} tone={pendingApplicants > 0 ? 'warn' : undefined} />
                    <ReportStatRow label="Approved / Rejected" value={`${approvedApplicants} / ${rejectedApplicants}`} />
                  </div>
                  <button onClick={() => printMembershipReport(members, pendingApplicants)} className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-xl py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer">
                    <Printer className="w-3.5 h-3.5" /> Print Report
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-sky-700 dark:text-sky-400" />
                    </div>
                    <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{products.length}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Inventory Report</h3>
                    <p className="text-[11px] text-slate-400">Listed products, {totalSales.toLocaleString()} units sold to date</p>
                  </div>
                  <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <ReportStatRow label="Low Stock (< 20 units)" value={lowStockProducts.length} tone={lowStockProducts.length > 0 ? 'warn' : undefined} />
                    <ReportStatRow label="Out of Stock" value={outOfStockProducts.length} tone={outOfStockProducts.length > 0 ? 'danger' : undefined} />
                    <ReportStatRow label="Total Units Sold" value={totalSales.toLocaleString()} />
                  </div>
                  <button onClick={() => printInventoryReport(products, LOW_STOCK_THRESHOLD)} className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 rounded-xl py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer">
                    <Printer className="w-3.5 h-3.5" /> Print Report
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'membership' && (
            <div className="space-y-6">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Membership Management</h2>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
                      <th className="p-4 font-bold">Applicant</th>
                      <th className="p-4 font-bold">Agricultural Type</th>
                      <th className="p-4 font-bold">PMES</th>
                      <th className="p-4 font-bold">Status</th>
                      <th className="p-4 font-bold text-right">Actions</th>
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
                          {a.pmesAttended
                            ? <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Attended</span>
                            : <span className="text-xs text-slate-400">Not yet</span>}
                        </td>
                        <td className="p-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            a.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                            a.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>{displayApplicantStatus(a.status)}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end">
                            <button
                              onClick={() => setViewedApplicant(a)}
                              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer text-xs font-bold"
                            >
                              View Details
                            </button>
                          </div>
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

          {activeTab === 'pmes' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">PMES Attendance</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Open a session to see who Admin has already checked in as present and send each one their Certificate of
                  Attendance. The roll-call itself is Admin's job - this view only shows confirmed attendees.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-left text-xs uppercase text-slate-400">
                      <th className="p-4 font-bold">Session</th>
                      <th className="p-4 font-bold">Date</th>
                      <th className="p-4 font-bold">Venue</th>
                      <th className="p-4 font-bold">Registered</th>
                      <th className="p-4 font-bold">Status</th>
                      <th className="p-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pmesSessions || []).map(s => (
                      <tr key={s.id} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                        <td className="p-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{s.title}</p>
                          <p className="text-xs text-slate-400">{s.speaker}</p>
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{formatDate(s.date)}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{s.venue || '—'}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">{s.registeredCount} / {s.capacity}</td>
                        <td className="p-4">
                          {(() => {
                            const displayStatus = getPmesDisplayStatus(s);
                            return (
                              <span className={`text-xs font-semibold ${
                                displayStatus === 'Completed' ? 'text-slate-500 dark:text-slate-400' :
                                displayStatus === 'Cancelled' ? 'text-rose-600 dark:text-rose-400' :
                                'text-amber-600 dark:text-amber-400'
                              }`}>{displayStatus}</span>
                            );
                          })()}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setAttendanceSession(s)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 cursor-pointer text-xs font-bold"
                          >
                            Take Attendance
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!pmesSessions || pmesSessions.length === 0) && (
                      <tr><td colSpan={6} className="p-8 text-center text-sm text-slate-400">No PMES sessions scheduled yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {attendanceSession && (
                <PmesAttendanceModal
                  session={attendanceSession}
                  role="board"
                  onClose={() => setAttendanceSession(null)}
                  onToast={onToast}
                />
              )}
            </div>
          )}

          {activeTab === 'ledger' && (
            <ShareCapitalLedger
              members={members}
              ledger={ledger}
              onVerifyLedgerEntry={onVerifyLedgerEntry}
              withdrawals={withdrawals}
              onToast={onToast}
              currentUserId={bod.id}
              canManage={false}
            />
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-lg">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Settings</h2>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                  {bod?.avatarUrl ? (
                    <img src={resolveImageUrl(bod.avatarUrl)} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold uppercase">
                      {(bod?.name || 'BD').slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{bod?.name || 'Board Member'}</p>
                    <p className="text-xs text-slate-400">{bod?.email}</p>
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
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 text-xs text-slate-500 leading-relaxed">
                BOCOFAC Coconut Farmers Cooperative is operated under the Cooperative Development Authority (CDA) with a democratically elected Board of Directors overseeing GAAP-compliant share capital and financial reporting.
              </div>
            </div>
          )}

        </main>

        <Footer />
      </div>

      {viewedApplicant && (
        <ApplicantDetailModal
          applicant={viewedApplicant}
          onClose={() => setViewedApplicant(null)}
          onUpdateApplicantStatus={onUpdateApplicantStatus}
          onToast={onToast}
        />
      )}
    </div>
  );
}

function ReportStatRow({ label, value, tone }) {
  const toneClass = tone === 'warn'
    ? 'text-amber-600 dark:text-amber-400'
    : tone === 'danger'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-slate-900 dark:text-white';
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`font-bold ${toneClass}`}>{value}</span>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{value || value === 0 ? value : '—'}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-2">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}

// Mirrors backend/src/utils/shareCapital.js - every member's required share
// capital target must fall inside this range.
const MIN_REQUIRED_SHARE_CAPITAL = 4000;
const MAX_REQUIRED_SHARE_CAPITAL = 10000;

function ApplicantDetailModal({ applicant: a, onClose, onUpdateApplicantStatus, onToast }) {
  const docs = a.documentsUploaded || {};
  const [rejectReasonDraft, setRejectReasonDraft] = useState('');
  const [requiredShareCapitalDraft, setRequiredShareCapitalDraft] = useState('10000');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <p className="text-xs text-slate-400 font-mono">{a.id}</p>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{a.fullName}</h3>
            <p className="text-xs text-slate-500">{a.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              a.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
              a.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
              'bg-amber-100 text-amber-800'
            }`}>{displayApplicantStatus(a.status)}</span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <Section title="Personal Data Sheet">
            <Field label="First Name" value={a.firstName} />
            <Field label="Middle Name" value={a.middleName} />
            <Field label="Family Name" value={a.lastName} />
            <Field label="Suffix" value={a.suffix} />
            <Field label="Birthday" value={a.birthdate ? new Date(a.birthdate).toLocaleDateString() : null} />
            <Field label="Birthplace" value={a.birthplace} />
            <Field label="Gender" value={a.gender} />
            <Field label="Civil Status" value={a.civilStatus} />
            <Field label="Mobile / CP #" value={a.phone || a.cpNumber} />
            <Field label="Email" value={a.email} />
          </Section>

          <Section title="Address & Background">
            <Field label="Address #" value={a.addressNumber} />
            <Field label="Street" value={a.street} />
            <Field label="Zone" value={a.zone} />
            <Field label="Barangay" value={a.barangay} />
            <Field label="Mun. / City" value={a.munCity} />
            <Field label="Facebook" value={a.facebook} />
            <Field label="Occupation" value={a.occupation} />
            <Field label="Employer" value={a.employer} />
            <Field label="Annual Income" value={a.annualIncome != null ? `₱${Number(a.annualIncome).toLocaleString()}` : null} />
            <Field label="Business Owned / Connected" value={a.businessOwned} />
            <Field label="TIN" value={a.tin} />
            <Field label="Religion" value={a.religion} />
          </Section>

          <Section title="Family & Dependents">
            <Field label="Spouse / Contact Person" value={a.spouseContactPerson} />
            <Field label="CP #s" value={a.spouseCpNumber} />
            <Field label="No. of Dependents" value={a.noOfDependents ?? 0} />
          </Section>
          {a.dependents && a.dependents.length > 0 && (
            <div className="border rounded-xl overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-[10px] uppercase text-slate-400">
                    <th className="p-2.5 font-bold">Name</th>
                    <th className="p-2.5 font-bold">Birthdate</th>
                    <th className="p-2.5 font-bold">Age</th>
                    <th className="p-2.5 font-bold">Sex</th>
                  </tr>
                </thead>
                <tbody>
                  {a.dependents.map((d, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300">{d.name}</td>
                      <td className="p-2.5 text-slate-500">{d.birthdate ? new Date(d.birthdate).toLocaleDateString() : '—'}</td>
                      <td className="p-2.5 text-slate-500">{d.age ?? '—'}</td>
                      <td className="p-2.5 text-slate-500">{d.sex || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Section title="Farm & Education">
            <Field label="Educational Attainment" value={a.eduAttainment} />
          </Section>

          {a.farmProfile && (
            <>
              <Section title="Coconut">
                <Field label="Area (ha)" value={a.farmProfile.coconut?.areaHa} />
                <Field label="Bearing" value={a.farmProfile.coconut?.bearing} />
                <Field label="Non-Bearing" value={a.farmProfile.coconut?.nonBearing} />
                <Field label="Months / Harvest" value={a.farmProfile.coconut?.monthsPerHarvest} />
                <Field label="Ave Nuts / Harvest" value={a.farmProfile.coconut?.aveNutsHarvest} />
                <Field label="Last Harvest" value={a.farmProfile.coconut?.lastHarvest ? new Date(a.farmProfile.coconut.lastHarvest).toLocaleDateString() : null} />
                <Field label="Ave Kopra Sold (kg)" value={a.farmProfile.coconut?.aveKopraSoldKg} />
                <Field label="Ave Harvest Charcoal" value={a.farmProfile.coconut?.aveHarvestCharcoal} />
              </Section>

              <Section title="Swine">
                <Field label="Sow" value={a.farmProfile.swine?.sow} />
                <Field label="Piglets" value={a.farmProfile.swine?.piglets} />
                <Field label="Farrowing Date" value={a.farmProfile.swine?.farrowingDate ? new Date(a.farmProfile.swine.farrowingDate).toLocaleDateString() : null} />
                <Field label="Fattening" value={a.farmProfile.swine?.fattening} />
              </Section>

              <Section title="Livestock">
                <Field label="Cow - Male" value={a.farmProfile.livestock?.cowMale} />
                <Field label="Cow - Female" value={a.farmProfile.livestock?.cowFemale} />
                <Field label="Goat" value={a.farmProfile.livestock?.goat} />
                <Field label="Carabao - Female" value={a.farmProfile.livestock?.carabaoFemale} />
                <Field label="Carabao - Male" value={a.farmProfile.livestock?.carabaoMale} />
                <Field label="Others" value={a.farmProfile.livestock?.others} />
              </Section>

              <Section title="Cacao">
                <Field label="Area (ha/sqm)" value={a.farmProfile.cacao?.areaHaSqm} />
                <Field label="Bearing" value={a.farmProfile.cacao?.bearing} />
                <Field label="Non-Bearing" value={a.farmProfile.cacao?.nonBearing} />
                <Field label="Harvest Cycle" value={a.farmProfile.cacao?.harvestCycle} />
                <Field label="Ave Nuts / Harvest" value={a.farmProfile.cacao?.aveNutsHarvest} />
                <Field label="Last Harvest" value={a.farmProfile.cacao?.lastHarvest ? new Date(a.farmProfile.cacao.lastHarvest).toLocaleDateString() : null} />
                <Field label="Total / Harvest" value={a.farmProfile.cacao?.totalHarvest} />
                <Field label="Unit Price" value={a.farmProfile.cacao?.unitPrice} />
                <Field label="Ave Beans Sold (kg)" value={a.farmProfile.cacao?.aveBeansSoldKg} />
              </Section>

              <Section title="Rice & Corn">
                <Field label="Rice Area (ha/sqm)" value={a.farmProfile.rice?.areaHaSqm} />
                <Field label="Rice Location" value={a.farmProfile.rice?.location} />
                <Field label="Corn Area (ha/sqm)" value={a.farmProfile.corn?.areaHaSqm} />
                <Field label="Corn Location" value={a.farmProfile.corn?.location} />
              </Section>

              {a.farmProfile.otherCrops && a.farmProfile.otherCrops.length > 0 && (
                <div className="border rounded-xl overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-[10px] uppercase text-slate-400">
                        <th className="p-2.5 font-bold">Crop</th>
                        <th className="p-2.5 font-bold">Area (ha/sqm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.farmProfile.otherCrops.map((c, i) => (
                        <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300">{c.crop}</td>
                          <td className="p-2.5 text-slate-500">{c.areaHaSqm || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {a.farmProfile.otherRemarks && (
                <Section title="Other Remarks">
                  <div className="sm:col-span-3">
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{a.farmProfile.otherRemarks}</p>
                  </div>
                </Section>
              )}
            </>
          )}

          <Section title="Requirements & Documents">
            <Field label="EDUCOM Chairperson" value={a.educomChairperson} />
            <Field label="ID Type" value={a.idType} />
            <Field label="ID #" value={a.idNumber} />
            <Field label="ID Date Issued" value={a.idDateIssued ? new Date(a.idDateIssued).toLocaleDateString() : null} />
            <Field label="ID Place Issued" value={a.idPlaceIssued} />
          </Section>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Valid ID', 'valid_id', docs.validId],
              ['Farm Declaration', 'farm_declaration', docs.farmDeclaration],
              ['Barangay Clearance', 'barangay_clearance', docs.barangayClearance],
              ['PMES Certificate', 'pmes_certificate', docs.pmesCertificate],
              ['Payment Receipt', 'registration_fee_receipt', docs.registrationFeeReceipt],
            ].map(([label, docType, uploaded]) => {
              if (!uploaded) {
                return (
                  <div key={label} className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 aspect-[4/3] flex flex-col items-center justify-center gap-1 text-slate-400">
                    <X className="w-5 h-5" />
                    <p className="text-[11px] font-semibold text-center px-1">{label}</p>
                  </div>
                );
              }
              const url = `${API_BASE}/applicants/${a.id}/documents/${docType}`;
              return (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:border-emerald-500 transition"
                >
                  <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden relative">
                    <img
                      src={url}
                      alt={label}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                    />
                    <div className="hidden absolute inset-0 items-center justify-center text-slate-400">
                      <FileText className="w-8 h-8" />
                    </div>
                  </div>
                  <p className="px-2 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3 shrink-0" /> {label}
                  </p>
                </a>
              );
            })}
          </div>

          <Section title="PMES & Membership">
            <Field label="PMES Attended" value={a.pmesAttended ? `Yes (${a.pmesDate ? new Date(a.pmesDate).toLocaleDateString() : ''})` : 'Not yet'} />
            <Field label="Registration Fee Paid" value={a.registrationFeePaid ? 'Yes' : 'No'} />
            <Field label="Payment Reference #" value={a.referenceNumber} />
            <Field label="Membership Fee" value={a.membershipFee != null ? `₱${Number(a.membershipFee).toFixed(2)}` : '₱300.00'} />
            <Field label="Subscribed Share" value={a.subscribedShare != null ? `₱${a.subscribedShare}` : null} />
            <Field label="Paid-up Capital" value={a.paidUpCapital != null ? `₱${a.paidUpCapital}` : null} />
            <Field label="OR #" value={a.orNumber} />
            <Field label="Submitted At" value={a.submittedAt ? new Date(a.submittedAt).toLocaleString() : null} />
          </Section>

          <div className="pt-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800">
            {a.pmesAttended ? (
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> PMES attendance confirmed{a.pmesDate ? ` on ${new Date(a.pmesDate).toLocaleDateString()}` : ''} - certificate sent from the session roster.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Not yet confirmed. PMES attendance is now checked in from the actual session roster
                (<span className="font-semibold text-slate-700 dark:text-slate-300">PMES Attendance</span> tab) rather than here,
                so the certificate is only sent once someone is checked in as physically present.
              </p>
            )}
          </div>
        </div>

        {a.status === 'Rejected' && a.rejectionReason && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-400 mb-1">Rejection Reason</p>
              <p className="text-sm text-rose-800 dark:text-rose-300">{a.rejectionReason}</p>
            </div>
          </div>
        )}

        {a.status !== 'Rejected' && a.status !== 'Approved' && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Required Share Capital (₱{MIN_REQUIRED_SHARE_CAPITAL.toLocaleString()}–₱{MAX_REQUIRED_SHARE_CAPITAL.toLocaleString()}, required to approve)
              </label>
              <input
                type="number"
                min={MIN_REQUIRED_SHARE_CAPITAL}
                max={MAX_REQUIRED_SHARE_CAPITAL}
                step={500}
                value={requiredShareCapitalDraft}
                onChange={(e) => setRequiredShareCapitalDraft(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Rejection Reason (required to reject)
              </label>
              <textarea
                value={rejectReasonDraft}
                onChange={(e) => setRejectReasonDraft(e.target.value)}
                placeholder="E.g., incomplete requirements, ID does not match records, duplicate application..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm resize-none"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900">
          {a.status !== 'Rejected' && (
            <button
              onClick={() => {
                if (!rejectReasonDraft.trim()) {
                  onToast?.('Please provide a rejection reason.', 'error');
                  return;
                }
                onUpdateApplicantStatus(a.id, { status: 'Rejected', reason: rejectReasonDraft.trim() });
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/60 font-bold text-sm cursor-pointer"
            >
              Reject
            </button>
          )}
          {a.status !== 'Approved' && (
            <button
              onClick={() => {
                const capital = Number(requiredShareCapitalDraft);
                if (!Number.isFinite(capital) || capital < MIN_REQUIRED_SHARE_CAPITAL || capital > MAX_REQUIRED_SHARE_CAPITAL) {
                  onToast?.(`Required share capital must be between ₱${MIN_REQUIRED_SHARE_CAPITAL.toLocaleString()} and ₱${MAX_REQUIRED_SHARE_CAPITAL.toLocaleString()}.`, 'error');
                  return;
                }
                onUpdateApplicantStatus(a.id, { status: 'Approved', requiredShareCapital: capital });
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer"
            >
              Approve
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
