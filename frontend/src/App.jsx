// src/App.jsx
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

  // Whether the signed-in customer already has a board-approved membership -
  // once true, the public "Membership" (apply) nav link no longer applies to
  // them, since contribution tracking lives on their Dashboard instead.
  const [isApprovedMember, setIsApprovedMember] = useState(false);

  // Cart must survive navigating away from the Products page - Storefront
  // used to own this as local state, which React wipes on unmount the
  // moment `page` changes away from 'products'. Lifting it here (and
  // persisting like the other cooperative data below) fixes that.
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('bocofac_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  // Basket panel on the Products page starts closed - it only opens when the
  // navbar cart icon is clicked, so browsing the catalog isn't cluttered with
  // an always-visible cart sidebar.
  const [cartPanelOpen, setCartPanelOpen] = useState(false);
  // True once the session-restore check below has actually run - lets the
  // guest-cart-clearing effect further down tell "definitely signed out"
  // apart from "still checking on page load", so it doesn't wipe a
  // returning customer's cart during that brief window before /auth/me
  // resolves.
  const [authChecked, setAuthChecked] = useState(false);

  // Core cooperative data, persisted to localStorage
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
  // Earnings withdrawal requests - admin/board-only view, fetched fresh from
  // the backend (like members/ledger below) rather than seeded/persisted
  // locally, since this feature has no legacy localStorage demo data.
  const [withdrawals, setWithdrawals] = useState([]);
  // Admin-only customer message threads, backing AdminMessageWidget's
  // conversation list - fetched fresh (not localStorage-seeded) like
  // withdrawals above, and refreshed off the shared admin SSE stream below.
  const [messageConversations, setMessageConversations] = useState([]);

  // Customer-facing notification bell feed (payment/order/withdrawal/
  // membership updates) - polled while a customer is signed in, same spirit
  // as the admin/board SSE fetchers above but scoped to this one account.
  const [notifications, setNotifications] = useState([]);
  // Which Dashboard sidebar tab to land on next time the Dashboard mounts/
  // updates - set when a notification is clicked (see resolveNotificationTarget
  // in Navbar.jsx) so it opens straight to the relevant section, the same way
  // an admin notification jumps to its tab.
  const [dashboardTab, setDashboardTab] = useState(null);
  // Asks CustomerMessageWidget to pop open - set when a "new message"
  // notification is clicked (see resolveNotificationTarget in Navbar.jsx).
  const [openMessageWidget, setOpenMessageWidget] = useState(false);

  const [toasts, setToasts] = useState([]);
  // Date.now() alone collides when addToast fires twice in the same
  // millisecond (e.g. rapid "Add to Cart" clicks) - two toasts sharing a
  // React key breaks their independent auto-dismiss timers, so they'd get
  // stuck on screen instead of clearing themselves. A monotonic counter
  // guarantees a unique id every call regardless of timing.
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

  // PMES schedule is admin-managed and shared across everyone viewing the
  // membership portal, so it comes from the backend rather than staying
  // purely localStorage-local like the seed/demo data above.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/pmes-sessions`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data && !cancelled) setPmesSessions(data);
      })
      .catch(() => {
        // Network hiccup - keep showing the last known/seed schedule.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Product catalog/stock is admin-managed and shared across every shopper,
  // so it comes from the backend rather than staying purely localStorage-
  // local like the seed/demo data above (same reasoning as pmesSessions).
  const loadProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/products`);
      if (res.ok) setProducts(await res.json());
    } catch {
      // Network hiccup - keep showing the last known/seed catalog.
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Restore the signed-in session on page load/refresh. The auth cookie
  // (httpOnly, 7-day) survives a refresh even though this component's state
  // doesn't - without this, reloading the page always looked logged-out
  // regardless of role, even with a perfectly valid session server-side.
  // Role branching mirrors SigninPage's handleSubmit (AuthPages.jsx).
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
        // No valid session / network hiccup - stay signed out.
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A cart only ever makes sense tied to a signed-in customer account now
  // (Storefront blocks Add to Cart for guests) - so once we know for sure
  // there's no customer session (not mid-restore-check), any cart items
  // left over from before that requirement, or from a previous customer's
  // session on this browser, get cleared rather than shown to whoever's
  // browsing next.
  useEffect(() => {
    if (authChecked && !user && cart.length > 0) {
      setCart([]);
    }
  }, [authChecked, user]);

  // Mirrors the same /members/me lookup DashboardPage uses, so the navbar
  // can tell an approved member apart from a guest/applicant without
  // duplicating the membership form's own by-email lookup.
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
      // Network hiccup - keep showing the last known list.
    }
  };

  // Polled (not SSE) since notifications are per-account rather than a topic
  // every connected admin/board client cares about - a plain interval avoids
  // having to thread user identity through the shared EventSource stream.
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
      // Best-effort - the next poll will reconcile if this silently failed.
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await fetch(`${API_BASE}/notifications/read-all`, { method: 'PATCH', credentials: 'include' });
    } catch {
      // Best-effort - the next poll will reconcile if this silently failed.
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

  // Admin/Board views must show the real applicant/member/ledger/PMES/order/
  // product registry - a customer submitting a form, paying share capital,
  // reserving a PMES slot, or buying stock in a different browser/session
  // would otherwise never appear here, since local state only ever echoed
  // the submitter's own copy. Each fetcher below reloads just its own slice
  // so the SSE listeners further down can refresh only what actually changed.
  const fetchApplicants = async () => {
    try {
      const res = await fetch(`${API_BASE}/applicants`, { credentials: 'include' });
      if (res.ok) setApplicants(await res.json());
    } catch {
      // Network hiccup - keep showing the last known list.
    }
  };
  const fetchMembers = async () => {
    try {
      const res = await fetch(`${API_BASE}/members`, { credentials: 'include' });
      if (res.ok) setMembers(await res.json());
    } catch {
      // Network hiccup - keep showing the last known list.
    }
  };
  const fetchLedger = async () => {
    try {
      const res = await fetch(`${API_BASE}/ledger`, { credentials: 'include' });
      if (res.ok) setLedger(await res.json());
    } catch {
      // Network hiccup - keep showing the last known list.
    }
  };
  const fetchPmesSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/pmes-sessions`, { credentials: 'include' });
      if (res.ok) setPmesSessions(await res.json());
    } catch {
      // Network hiccup - keep showing the last known list.
    }
  };
  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_BASE}/orders`, { credentials: 'include' });
      if (res.ok) setOrders(await res.json());
    } catch {
      // Network hiccup - keep showing the last known list.
    }
  };
  const fetchWithdrawals = async () => {
    try {
      const res = await fetch(`${API_BASE}/withdrawals`, { credentials: 'include' });
      if (res.ok) setWithdrawals(await res.json());
    } catch {
      // Network hiccup - keep showing the last known list.
    }
  };
  // Admin-only (see /api/messages/conversations) - a board session must not
  // call this, so it's fetched/listened-for only when `admin` is set below.
  const fetchMessageConversations = async () => {
    try {
      const res = await fetch(`${API_BASE}/messages/conversations`, { credentials: 'include' });
      if (res.ok) setMessageConversations(await res.json());
    } catch {
      // Network hiccup - keep showing the last known list.
    }
  };

  // Realtime feed: the backend pushes an `event: <topic>` the instant
  // something changes server-side (new order, verified payment, approved
  // applicant, updated stock, etc.), so the matching fetcher above reloads
  // immediately instead of waiting on a polling timer. EventSource
  // reconnects on its own if the connection drops.
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

  // Clears whichever of the three auth states is currently set, regardless
  // of role - shared by both the 30-minute idle timeout and the global 401
  // interceptor below, since both cases mean "the session is no longer
  // valid," just discovered two different ways (a client-side timer vs. the
  // server actually rejecting a request).
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

  // Global fallback for the case the idle timer doesn't catch: the server
  // rejects a request as 401 (idle-timed-out session, revoked session,
  // expired cookie) while this tab's state still thinks someone's signed in.
  // registerUnauthorizedHandler wires into a single wrapped window.fetch
  // (see utils/apiInterceptor.js) rather than touching the ~56 existing
  // fetch() call sites individually.
  useEffect(() => {
    return registerUnauthorizedHandler(() => {
      if (user || admin || bod) {
        handleSessionExpired('Your session has expired. Please sign in again.');
      }
    });
  }, [user, admin, bod]);

  // E-Commerce Order Handler - the backend already deducted stock
  // transactionally when it created this order, so re-fetch the real
  // catalog rather than re-deriving stock numbers client-side (which would
  // drift from whatever the backend actually committed).
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

  // formData carries an optional image file, so these go over multipart
  // rather than JSON (see uploadProductImage in backend/src/middleware/upload.js).
  // Both return a plain boolean (never throw) so the Add/Edit Product form
  // can tell success from failure and only close itself on success - it
  // used to close either way, since the toast-and-swallow catch here meant
  // the form's own await never saw the failure.
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

  // Also auto-registers approved candidates as Shareholders.
  // Board Approve/Reject decisions must be persisted to the backend (this is
  // what the customer's "Check Application Status" lookup actually reads),
  // not just written to local/localStorage state.
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

        // The backend already creates/links the Member record transactionally
        // as part of approval (see applicants.routes.js) - the admin/board
        // members poll above will pick it up on its next tick, so there's no
        // need (and no correct way, without duplicating server logic and ID
        // generation) to fabricate a local member here.
        addToast(`Application ${updates.status.toLowerCase()}.`, 'success');
      } catch (err) {
        addToast(err.message || 'Could not update applicant status.', 'error');
      }
      return;
    }

    // Local-state-only sync (e.g. MembershipPortal already persisted the
    // change itself, such as after a PMES certificate upload, and is just
    // syncing this component's copy of the applicant).
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
      // The single-row POST response has no member JOIN (unlike the list
      // endpoint), so fill in the display name from what's already loaded.
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

  // Confirms a member-submitted GCash/bank reference actually matches a real
  // remittance before it counts toward that member's share-capital balance.
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

  // Admin has actually sent the money (GCash/bank, outside the system) and is
  // now recording it against the member's earnings withdrawal request.
  const handleSendWithdrawal = async (withdrawalId, { sentAmount, reference }) => {
    try {
      const res = await fetch(`${API_BASE}/withdrawals/${withdrawalId}/send`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sentAmount, reference }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to record the sent withdrawal.');
      setWithdrawals(prev => prev.map(w => (w.id === withdrawalId ? { ...w, ...data, memberName: w.memberName } : w)));
      addToast(`Withdrawal ${withdrawalId} marked as sent.`, 'success');
    } catch (err) {
      addToast(err.message || 'Failed to record the sent withdrawal.', 'error');
    }
  };

  const handleRejectWithdrawal = async (withdrawalId) => {
    try {
      const res = await fetch(`${API_BASE}/withdrawals/${withdrawalId}/reject`, {
        method: 'PATCH',
        credentials: 'include',
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

  // Admin/Board dashboards have their own dedicated sidebar layout, and the
  // auth pages (sign up/in) are full-screen takeovers, so the public navbar
  // stays hidden on all of them.
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
    // Clicking the "Products" nav link should always land on the catalog,
    // even if the cart panel was left open from an earlier visit - without
    // this, clicking it while already on the Products page changes nothing
    // (React sees the same page value) and the cart panel just sits there
    // looking unresponsive. onOpenCart re-opens it right after this call
    // when the click was actually on the cart icon, not this link.
    if (target === 'products') {
      setCartPanelOpen(false);
    }
    setPage(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Jumps straight to a Dashboard tab - used by the notification bell (which
  // mirrors the admin notification bell jumping straight to its tab, instead
  // of just popping up the message text) and by the mobile Navbar's profile
  // menu (the customer Dashboard's own sidebar is hidden on phones).
  const goToDashboardTab = (tab) => {
    setDashboardTab(tab);
    navigate('dashboard');
  };

  // Shared by the mobile Navbar's profile menu - mirrors DashboardPage's own
  // logout button, since that sidebar (and the logout button on it) is
  // hidden on phones now.
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
            onAddApplicant={handleAddApplicant}
            onUpdateApplicantStatus={handleUpdateApplicantStatus}
            onToast={addToast}
            onGoToDashboard={() => navigate('dashboard')}
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
        // Raw setPage, not the guarded `navigate` - navigate('dashboard')
        // would read the `user` state from this render's stale closure
        // (still null, since setUser() hasn't re-rendered yet) and bounce
        // the freshly-authenticated customer straight back to signup.
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

      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none w-80">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} onClose={removeToast} />
          </div>
        ))}
      </div>
    </div>
  );
}
