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
import ApplicantDetailModal from '../components/ApplicantDetailModal';
import MobileScrollHint from '../components/MobileScrollHint';
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
  // Full-size preview for the small avatar thumbnail in Settings - clicking
  // it opens the actual photo instead of leaving it stuck at 48x48px.
  const [viewedAvatarUrl, setViewedAvatarUrl] = useState(null);

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
                            a.status === 'Approved' ? 'bg-emerald-600 text-white' :
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

              <MobileScrollHint />
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
                            a.status === 'Approved' ? 'bg-emerald-600 text-white' :
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
              <MobileScrollHint />
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

              <MobileScrollHint />
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
                    <img
                      src={resolveImageUrl(bod.avatarUrl)}
                      alt=""
                      onClick={() => setViewedAvatarUrl(resolveImageUrl(bod.avatarUrl))}
                      title="View full photo"
                      className="w-12 h-12 rounded-full object-cover cursor-pointer hover:opacity-80 transition"
                    />
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

