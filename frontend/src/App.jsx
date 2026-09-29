import React, { useState, useEffect, useRef } from 'react';
import './index.css';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PublicHome from './components/PublicHome';
import Storefront from './components/Storefront';
import PublicAbout from './components/PublicAbout';
import MembershipPortal from './components/MembershipPortal';
import Toast from './components/Toast';
import CustomerMessageWidget from './components/CustomerMessageWidget';
import AdminMessageWidget from './components/AdminMessageWidget';
import DashboardPage from './pages/DashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import BoardDashboardPage from './pages/BoardDashboardPage';
import { SignupPage, SigninPage, ForgotPasswordPage } from './pages/AuthPages';
import useIdleTimeout from './hooks/useIdleTimeout';
import { registerUnauthorizedHandler } from './utils/apiInterceptor';
import { AlertTriangle, LogIn, UserPlus, X } from 'lucide-react';
import {
  INITIAL_PRODUCTS,
  INITIAL_MEMBERS,
  INITIAL_LEDGER,
  INITIAL_APPLICANTS,
  INITIAL_PMES_SESSIONS,
  INITIAL_ORDERS
} from './data/initialData';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

export default function App() {
  const [page, setPage] = useState('home');
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [bod, setBod] = useState(null);
  const [membershipAuthPromptOpen, setMembershipAuthPromptOpen] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(false);

  const [isApprovedMember, setIsApprovedMember] = useState(false);

  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('bocofac_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const [cartPanelOpen, setCartPanelOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('bocofac_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });
  const [members, setMembers] = useState(() => {
    const saved = localStorage.getItem('bocofac_members');
    return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
  });
  const [ledger, setLedger] = useState(() => {
    const saved = localStorage.getItem('bocofac_ledger');
    return saved ? JSON.parse(saved) : INITIAL_LEDGER;
  });
  const [applicants, setApplicants] = useState(() => {
    const saved = localStorage.getItem('bocofac_applicants');
    return saved ? JSON.parse(saved) : INITIAL_APPLICANTS;
  });
  const [pmesSessions, setPmesSessions] = useState(() => {
    const saved = localStorage.getItem('bocofac_pmes_sessions');
    return saved ? JSON.parse(saved) : INITIAL_PMES_SESSIONS;
  });
  const [orders, setOrders] = useState(() => {
    const saved = localStorage.getItem('bocofac_orders');
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });
  const [withdrawals, setWithdrawals] = useState([]);
  const [messageConversations, setMessageConversations] = useState([]);

  const [notifications, setNotifications] = useState([]);
  const [dashboardTab, setDashboardTab] = useState(null);
  const [openMessageWidget, setOpenMessageWidget] = useState(false);

  const [toasts, setToasts] = useState([]);
  const toastCounterRef = useRef(0);

  useEffect(() => {
    localStorage.setItem('bocofac_products', JSON.stringify(products));
  }, [products]);
  useEffect(() => {
    localStorage.setItem('bocofac_members', JSON.stringify(members));
  }, [members]);
  useEffect(() => {
    localStorage.setItem('bocofac_ledger', JSON.stringify(ledger));
  }, [ledger]);
  useEffect(() => {
    localStorage.setItem('bocofac_applicants', JSON.stringify(applicants));
  }, [applicants]);
  useEffect(() => {
    localStorage.setItem('bocofac_pmes_sessions', JSON.stringify(pmesSessions));
  }, [pmesSessions]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/pmes-sessions`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data && !cancelled) setPmesSessions(data);
      })
      .catch(() => {
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/products`);
      if (res.ok) setProducts(await res.json());
    } catch {
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/auth/me`, { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled) return;
        if (!data) return;
        if (data.role === 'admin') setAdmin(data);
        else if (data.role === 'board') setBod(data);
        else setUser(data);
      })
      .catch(() => {
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authChecked && !user && cart.length > 0) {
      setCart([]);
    }
  }, [authChecked, user]);

  useEffect(() => {
    if (!user?.email) {
      setIsApprovedMember(false);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/members/me`, { credentials: 'include' })
      .then(res => (res.ok ? res.json() : { member: null }))
      .then(data => {
        if (!cancelled) setIsApprovedMember(!!data.member);
      })
      .catch(() => {
        if (!cancelled) setIsApprovedMember(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications/mine`, { credentials: 'include' });
      if (res.ok) setNotifications(await res.json());
    } catch {
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleMarkNotificationRead = async (notificationId) => {
    setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n)));
    try {
      await fetch(`${API_BASE}/notifications/${notificationId}/read`, { method: 'PATCH', credentials: 'include' });
    } catch {
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await fetch(`${API_BASE}/notifications/read-all`, { method: 'PATCH', credentials: 'include' });
    } catch {
    }
  };

  useEffect(() => {
    localStorage.setItem('bocofac_orders', JSON.stringify(orders));
  }, [orders]);
  useEffect(() => {
    localStorage.setItem('bocofac_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  const fetchApplicants = async () => {
    try {
      const res = await fetch(`${API_BASE}/applicants`, { credentials: 'include' });
      if (res.ok) setApplicants(await res.json());
    } catch {
    }
  };
  const fetchMembers = async () => {
    try {
      const res = await fetch(`${API_BASE}/members`, { credentials: 'include' });
      if (res.ok) setMembers(await res.json());
    } catch {
    }
  };
  const fetchLedger = async () => {
    try {
      const res = await fetch(`${API_BASE}/ledger`, { credentials: 'include' });
      if (res.ok) setLedger(await res.json());
    } catch {
    }
  };
  const fetchPmesSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/pmes-sessions`, { credentials: 'include' });
      if (res.ok) setPmesSessions(await res.json());
    } catch {
    }
  };
  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_BASE}/orders`, { credentials: 'include' });
      if (res.ok) setOrders(await res.json());
    } catch {
    }
  };
  const fetchWithdrawals = async () => {
    try {
      const res = await fetch(`${API_BASE}/withdrawals`, { credentials: 'include' });
      if (res.ok) setWithdrawals(await res.json());
    } catch {
    }
  };
  const fetchMessageConversations = async () => {
    try {
      const res = await fetch(`${API_BASE}/messages/conversations`, { credentials: 'include' });
      if (res.ok) setMessageConversations(await res.json());
    } catch {
    }
  };

  useEffect(() => {
    if (!admin && !bod) return;

    fetchApplicants();
    fetchMembers();
    fetchLedger();
    fetchPmesSessions();
    fetchOrders();
    fetchWithdrawals();
    loadProducts();
    if (admin) fetchMessageConversations();

    const source = new EventSource(`${API_BASE}/events`, { withCredentials: true });
    source.addEventListener('applicants', fetchApplicants);
    source.addEventListener('members', fetchMembers);
    source.addEventListener('ledger', fetchLedger);
    source.addEventListener('pmes-sessions', fetchPmesSessions);
    source.addEventListener('orders', fetchOrders);
    source.addEventListener('withdrawals', fetchWithdrawals);
    source.addEventListener('products', loadProducts);
    if (admin) source.addEventListener('messages', fetchMessageConversations);

    return () => {
      source.close();
    };
  }, [admin, bod]);

  const addToast = (message, type = 'success') => {
    toastCounterRef.current += 1;
    const newToast = { id: `toast-${Date.now()}-${toastCounterRef.current}`, message, type };
    setToasts(prev => [...prev, newToast]);
  };
  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const clearSignedInState = () => {
    setUser(null);
    setAdmin(null);
    setBod(null);
  };

  const handleSessionExpired = (message) => {
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    clearSignedInState();
    navigate('home');
    addToast(message, 'error');
  };

  useIdleTimeout({
    active: !!(user || admin || bod),
    timeoutMs: 30 * 60 * 1000,
    onIdle: () => handleSessionExpired('Your session expired due to inactivity. Please sign in again.'),
  });

  useEffect(() => {
    return registerUnauthorizedHandler(() => {
      if (user || admin || bod) {
        handleSessionExpired('Your session has expired. Please sign in again.');
      }
    });
  }, [user, admin, bod]);

  const handleAddOrder = (newOrder) => {
    setOrders(prev => [newOrder, ...prev]);
    loadProducts();
  };

  const handleVerifyOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/verify`, {
        method: 'PATCH',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to verify order.');
      setOrders(prevOrders => prevOrders.map(ord => (ord.id === orderId ? data : ord)));
      addToast(`Order ${orderId} verified — now processing.`, 'success');
    } catch (err) {
      addToast(err.message || 'Failed to verify order.', 'error');
    }
  };

  const handleRejectOrder = async (orderId, reason) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to reject order.');
      setOrders(prevOrders => prevOrders.map(ord => (ord.id === orderId ? data : ord)));
      addToast(`Order ${orderId} rejected.`, 'success');
    } catch (err) {
      addToast(err.message || 'Failed to reject order.', 'error');
    }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update order status.');
      setOrders(prevOrders => prevOrders.map(ord => (ord.id === orderId ? data : ord)));
      const label = status === 'Shipped' ? 'Delivered to Courier' : status;
      addToast(`Order ${orderId} marked as ${label}.`, 'success');
    } catch (err) {
      addToast(err.message || 'Failed to update order status.', 'error');
    }
  };

  const handleUpdateProductStock = async (productId, newStock) => {
    try {
      const res = await fetch(`${API_BASE}/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stock: newStock }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update stock.');
      setProducts(prev => prev.map(p => (p.id === productId ? data : p)));
      addToast(`Stock updated for ${data.name}.`, 'success');
    } catch (err) {
      addToast(err.message || 'Failed to update stock.', 'error');
    }
  };

  const handleApplyPromo = async (productId, discountPercent) => {
    try {
      const res = await fetch(`${API_BASE}/products/${productId}/promo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ discountPercent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update promo.');
      setProducts(prev => prev.map(p => (p.id === productId ? data : p)));
      addToast(
        discountPercent > 0
          ? `${data.name} is now on promo: ${discountPercent}% off.`
          : `Promo cleared for ${data.name}.`,
        'success'
      );
    } catch (err) {
      addToast(err.message || 'Failed to update promo.', 'error');
    }
  };

  const handleAddProduct = async (formData) => {
    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add product.');
      setProducts(prev => [...prev, data]);
      addToast(`Product "${data.name}" added.`, 'success');
      return true;
    } catch (err) {
      addToast(err.message || 'Failed to add product.', 'error');
      return false;
    }
  };

  const handleUpdateProduct = async (productId, formData) => {
    try {
      const res = await fetch(`${API_BASE}/products/${productId}`, {
        method: 'PUT',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update product.');
      setProducts(prev => prev.map(p => (p.id === productId ? data : p)));
      addToast(`Product "${data.name}" updated.`, 'success');
      return true;
    } catch (err) {
      addToast(err.message || 'Failed to update product.', 'error');
      return false;
    }
  };

  const handleDeleteProduct = async (productId) => {
    try {
      const res = await fetch(`${API_BASE}/products/${productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete product.');
      }
      setProducts(prev => prev.filter(p => p.id !== productId));
      addToast('Product deleted.', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to delete product.', 'error');
    }
  };

  const handleAddApplicant = (applicant) => {
    setApplicants(prev => [applicant, ...prev]);
  };

  const handleUpdateApplicantStatus = async (applicantId, updates) => {
    if (updates.status === 'Approved' || updates.status === 'Rejected') {
      try {
        const res = await fetch(`${API_BASE}/applicants/${applicantId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: updates.status, reason: updates.reason, requiredShareCapital: updates.requiredShareCapital }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to update applicant status.');
        }
        const updatedApplicant = await res.json();

        setApplicants(prevApplicants =>
          prevApplicants.map(app => (app.id === applicantId ? updatedApplicant : app))
        );

        addToast(`Application ${updates.status.toLowerCase()}.`, 'success');
      } catch (err) {
        addToast(err.message || 'Could not update applicant status.', 'error');
      }
      return;
    }

    setApplicants(prevApplicants =>
      prevApplicants.map(app => (app.id === applicantId ? { ...app, ...updates } : app))
    );
  };

  const handleAddMember = async ({ name, email, requiredShareCapital }) => {
    try {
      const res = await fetch(`${API_BASE}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, requiredShareCapital }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to register shareholder.');
      setMembers(prev => [...prev, data]);
      addToast(`Cooperative shareholder profile filed for ${data.name}!`, 'success');
    } catch (err) {
      addToast(err.message || 'Failed to register shareholder.', 'error');
    }
  };

  const handleUpdateMember = async (memberId, updates) => {
    try {
      const res = await fetch(`${API_BASE}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update shareholder profile.');
      setMembers(prev => prev.map(m => (m.id === memberId ? data : m)));
      addToast('Shareholder information sheet updated.', 'success');
      return data;
    } catch (err) {
      addToast(err.message || 'Failed to update shareholder profile.', 'error');
      throw err;
    }
  };

  const handleAddLedgerEntry = async ({ memberId, amount, referenceId, paymentMethod }) => {
    try {
      const res = await fetch(`${API_BASE}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ memberId, amount, referenceId, paymentMethod }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to log contribution.');
      const member = members.find(m => m.id === memberId);
      const entryWithName = { ...data, memberName: member ? member.name : data.memberName };
      setLedger(prev => [entryWithName, ...prev]);
      addToast(
        data.status === 'Verified'
          ? `Payment of ₱${data.amount.toLocaleString()} recorded and verified (OR: ${data.orNumber}).`
          : `Payment of ₱${data.amount.toLocaleString()} logged as Pending - another admin or board member must verify it.`,
        'success'
      );
    } catch (err) {
      addToast(err.message || 'Failed to log contribution.', 'error');
    }
  };

  const handleVerifyLedgerEntry = async (entryId) => {
    try {
      const res = await fetch(`${API_BASE}/ledger/${entryId}/verify`, {
        method: 'PATCH',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to verify payment.');
      setLedger(prev => prev.map(entry => (
        entry.id === entryId ? { ...entry, ...data, memberName: entry.memberName } : entry
      )));
      addToast(`Payment ${entryId} verified and added to the share capital total.`, 'success');
    } catch (err) {
      addToast(err.message || 'Failed to verify payment.', 'error');
    }
  };

  const handleSendWithdrawal = async (withdrawalId, { sentAmount, reference }) => {
    try {
      const res = await fetch(`${API_BASE}/withdrawals/${withdrawalId}/send`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sentAmount, reference }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to record the released withdrawal.');
      setWithdrawals(prev => prev.map(w => (w.id === withdrawalId ? { ...w, ...data, memberName: w.memberName } : w)));
      addToast(`Withdrawal ${withdrawalId} marked as released.`, 'success');
    } catch (err) {
      addToast(err.message || 'Failed to record the released withdrawal.', 'error');
    }
  };

  const handleApproveWithdrawal = async (withdrawalId) => {
    try {
      const res = await fetch(`${API_BASE}/withdrawals/${withdrawalId}/approve`, {
        method: 'PATCH',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to approve the withdrawal request.');
      setWithdrawals(prev => prev.map(w => (w.id === withdrawalId ? { ...w, ...data, memberName: w.memberName } : w)));
      addToast(`Withdrawal ${withdrawalId} approved. The member can now claim it at the office.`, 'success');
    } catch (err) {
      addToast(err.message || 'Failed to approve the withdrawal request.', 'error');
    }
  };

  const handleRejectWithdrawal = async (withdrawalId, note) => {
    try {
      const res = await fetch(`${API_BASE}/withdrawals/${withdrawalId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ note: note || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to reject the withdrawal request.');
      setWithdrawals(prev => prev.map(w => (w.id === withdrawalId ? { ...w, ...data, memberName: w.memberName } : w)));
      addToast(`Withdrawal ${withdrawalId} rejected.`, 'success');
    } catch (err) {
      addToast(err.message || 'Failed to reject the withdrawal request.', 'error');
    }
  };

  const handleAddPmesSession = async (session) => {
    try {
      const res = await fetch(`${API_BASE}/pmes-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(session),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add PMES session.');
      setPmesSessions(prev => [...prev, data]);
      addToast(`PMES session "${data.title}" added.`, 'success');
      return true;
    } catch (err) {
      addToast(err.message || 'Failed to add PMES session.', 'error');
      return false;
    }
  };

  const handleUpdatePmesSession = async (sessionId, updates) => {
    try {
      const res = await fetch(`${API_BASE}/pmes-sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update PMES session.');
      setPmesSessions(prev => prev.map(s => (s.id === sessionId ? data : s)));
      addToast(`PMES session "${data.title}" updated.`, 'success');
    } catch (err) {
      addToast(err.message || 'Failed to update PMES session.', 'error');
    }
  };

  const handleDeletePmesSession = async (sessionId) => {
    try {
      const res = await fetch(`${API_BASE}/pmes-sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete PMES session.');
      }
      setPmesSessions(prev => prev.filter(s => s.id !== sessionId));
      addToast('PMES session removed.', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to delete PMES session.', 'error');
    }
  };

  const hideNav = ['signup', 'signin', 'admin-dashboard', 'bod-dashboard'].includes(page);

  const navigate = (target) => {
    if (target === 'membership' && !user) {
      setMembershipAuthPromptOpen(true);
      return;
    }
    if (target === 'dashboard' && !user) {
      setPage('signin');
      return;
    }
    if (target === 'admin-dashboard' && !admin) {
      setPage('signin');
      return;
    }
    if (target === 'bod-dashboard' && !bod) {
      setPage('signin');
      return;
    }
    if (target === 'products') {
      setCartPanelOpen(false);
    }
    setPage(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToDashboardTab = (tab) => {
    setDashboardTab(tab);
    navigate('dashboard');
  };

  const handleCustomerLogout = () => {
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
    navigate('home');
  };

  const pagesWithFooter = ['home', 'products', 'about', 'membership', 'dashboard'];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }} className="flex flex-col">
      {!hideNav && (
        <Navbar
          page={page}
          setPage={navigate}
          cartCount={cartCount}
          onOpenCart={() => { navigate('products'); setCartPanelOpen(true); }}
          user={user}
          admin={admin}
          bod={bod}
          isApprovedMember={isApprovedMember}
          notifications={notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onNotificationNavigate={goToDashboardTab}
          onOpenMessages={() => setOpenMessageWidget(true)}
          onLogout={handleCustomerLogout}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        />
      )}

      {membershipAuthPromptOpen && !user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4" role="dialog" aria-modal="true" aria-labelledby="membership-auth-title">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setMembershipAuthPromptOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 id="membership-auth-title" className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
              Create an account to apply
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Please sign up or sign in first before opening the BOCOFAC membership application.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => { setMembershipAuthPromptOpen(false); navigate('signin'); }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMembershipAuthPromptOpen(false); navigate('signup'); }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
              >
                <UserPlus className="h-4 w-4" />
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1" style={pagesWithFooter.includes(page) ? { paddingBottom: 'var(--footer-h, 0px)' } : undefined}>

      {page === 'home' && (
        <PublicHome
          products={products}
          memberCount={members.length}
          onShopNow={() => navigate('products')}
          onApplyMembership={() => navigate('membership')}
        />
      )}
      {page === 'products' && (
        <Storefront
          user={user}
          products={products}
          cart={cart}
          setCart={setCart}
          onAddOrder={handleAddOrder}
          onToast={addToast}
          cartPanelOpen={cartPanelOpen}
          onCloseCart={() => setCartPanelOpen(false)}
          onRequireAccount={() => navigate('signin')}
        />
      )}
      {page === 'about' && <PublicAbout onApplyMembership={() => navigate('membership')} />}
      {page === 'membership' && user && (
        <div className="max-w-[1680px] mx-auto w-full p-4 sm:p-8">
          <MembershipPortal
            user={user}
            applicants={applicants}
            sessions={pmesSessions}
            onSessionsRefresh={fetchPmesSessions}
            onAddApplicant={handleAddApplicant}
            onUpdateApplicantStatus={handleUpdateApplicantStatus}
            onToast={addToast}
            onGoToDashboard={() => navigate('dashboard')}
            onGoHome={() => navigate('home')}
          />
        </div>
      )}
      {page === 'dashboard' && user && (
        <DashboardPage
          user={user}
          setUser={setUser}
          setPage={navigate}
          pmesSessions={pmesSessions}
          onPmesSessionsRefresh={fetchPmesSessions}
          focusTab={dashboardTab}
          onFocusTabConsumed={() => setDashboardTab(null)}
          onToast={addToast}
        />
      )}
      {page === 'admin-dashboard' && admin && (
        <AdminDashboardPage
          admin={admin}
          setAdmin={setAdmin}
          setPage={navigate}
          products={products}
          orders={orders}
          onVerifyOrder={handleVerifyOrder}
          onRejectOrder={handleRejectOrder}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onUpdateProductStock={handleUpdateProductStock}
          onApplyPromo={handleApplyPromo}
          onAddProduct={handleAddProduct}
          onUpdateProduct={handleUpdateProduct}
          onDeleteProduct={handleDeleteProduct}
          members={members}
          ledger={ledger}
          onAddMember={handleAddMember}
          onUpdateMember={handleUpdateMember}
          onAddLedgerEntry={handleAddLedgerEntry}
          onVerifyLedgerEntry={handleVerifyLedgerEntry}
          withdrawals={withdrawals}
          onApproveWithdrawal={handleApproveWithdrawal}
          onSendWithdrawal={handleSendWithdrawal}
          onRejectWithdrawal={handleRejectWithdrawal}
          applicants={applicants}
          pmesSessions={pmesSessions}
          onAddPmesSession={handleAddPmesSession}
          onUpdatePmesSession={handleUpdatePmesSession}
          onDeletePmesSession={handleDeletePmesSession}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          onToast={addToast}
        />
      )}
      {page === 'signup' && (
        <SignupPage setPage={setPage} onToast={addToast} />
      )}
      {page === 'signin' && (
        <SigninPage setPage={setPage} setUser={setUser} setAdmin={setAdmin} setBod={setBod} onToast={addToast} />
      )}
      {page === 'forgot-password' && (
        <ForgotPasswordPage setPage={setPage} onToast={addToast} />
      )}
      {page === 'bod-dashboard' && bod && (
        <BoardDashboardPage
          bod={bod}
          setBod={setBod}
          setPage={navigate}
          products={products}
          orders={orders}
          members={members}
          applicants={applicants}
          onUpdateApplicantStatus={handleUpdateApplicantStatus}
          pmesSessions={pmesSessions}
          ledger={ledger}
          onVerifyLedgerEntry={handleVerifyLedgerEntry}
          withdrawals={withdrawals}
          onToast={addToast}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        />
      )}

      </div>

      {pagesWithFooter.includes(page) && <Footer />}

      {user && (
        <CustomerMessageWidget
          user={user}
          onToast={addToast}
          forceOpen={openMessageWidget}
          onForceOpenConsumed={() => setOpenMessageWidget(false)}
        />
      )}
      {admin && (
        <AdminMessageWidget
          conversations={messageConversations}
          onRefetchConversations={fetchMessageConversations}
          onToast={addToast}
        />
      )}

      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[80] space-y-2 pointer-events-none w-[calc(100%-2rem)] max-w-xs sm:max-w-sm">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} onClose={removeToast} />
          </div>
        ))}
      </div>
    </div>
  );
}
