// src/components/Navbar.jsx
import React, { useState } from 'react';
import { ShoppingCart, ShieldCheck, UserCircle, Landmark, Menu, X, Sun, Moon, Bell } from 'lucide-react';
import bocofacLogo from '../assets/bocofac-logo.jpg';

// Every customer notification message is one of a fixed handful of strings
// this app itself generates server-side (see notifyUser/notifyByMemberId/
// notifyByEmail call sites in backend/src/routes, and messages.routes.js for
// the "new message" one) - matching on their stable prefixes tells us where
// the notification is actually about, the same way the admin notification
// bell already carries an explicit tab per notification. A "new message"
// notification isn't a Dashboard tab at all - it's about the chat widget
// (CustomerMessageWidget, floating on every page), so it opens that instead.
function resolveNotificationTarget(message) {
  if (message.startsWith('You have a new message')) return { kind: 'messages' };
  if (message.startsWith('Your order')) return { kind: 'tab', tab: 'orders' };
  return { kind: 'tab', tab: 'membership' };
}

// "Just now" / "5m ago" / "3h ago" / "2d ago" - notifications skew recent, so
// a relative label reads better here than a full timestamp.
function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Navbar({
  page, setPage, cartCount, onOpenCart, user, admin, bod, isApprovedMember,
  notifications = [], onMarkNotificationRead, onMarkAllNotificationsRead,
  onNotificationNavigate, onOpenMessages, isDarkMode, onToggleDarkMode,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Jumps straight to whatever the notification is actually about - the
  // Dashboard tab, or the message widget - same as clicking an admin
  // notification jumps straight to its tab, via setPage's in-app page state
  // or the widget's own open flag, never a hardcoded URL (so it works the
  // same wherever this app is actually hosted, not just on a local dev
  // server, and on every page since both the bell and the widget are global).
  const openNotification = (n) => {
    onMarkNotificationRead(n.id);
    setNotifOpen(false);
    const target = resolveNotificationTarget(n.message);
    if (target.kind === 'messages') {
      onOpenMessages?.();
    } else {
      onNotificationNavigate?.(target.tab);
    }
  };

  // Already-approved members apply/track nothing new on that page anymore -
  // their contribution status now lives on the Dashboard - so the public
  // "apply for membership" link no longer belongs in their nav.
  const navLinks = [
    { key: 'home', label: 'Home' },
    { key: 'products', label: 'Products' },
    ...(isApprovedMember ? [] : [{ key: 'membership', label: 'Membership' }]),
    { key: 'about', label: 'About' },
  ];

  const go = (target) => {
    setPage(target);
    setMobileMenuOpen(false);
  };

  // Single account entry point: routes to whichever role is currently
  // signed in. A guest is assumed to be a new customer, so it opens
  // Create Account first (Sign In / Admin / Board of Directors are all
  // reachable from there).
  const accountTarget = admin ? 'admin-dashboard' : bod ? 'bod-dashboard' : user ? 'dashboard' : 'signin';
  const accountLabel = admin ? 'Admin' : bod ? 'Board' : user ? 'Me' : 'Sign Up';
  const AccountIcon = admin ? ShieldCheck : bod ? Landmark : UserCircle;
  // Already standing on the page this button leads to (e.g. a signed-in
  // member viewing their own Dashboard) - showing "Me" there just points
  // back at the page you're already on, so it's dropped from the navbar.
  const showAccountButton = page !== accountTarget;

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-[1680px] mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
        {/* Brand */}
        <button onClick={() => go('home')} className="flex items-center gap-2.5 cursor-pointer shrink-0">
          <img
            src={bocofacLogo}
            alt="BOCOFAC"
            className="w-11 h-11 rounded-full object-cover shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
          />
          <span className="font-serif font-extrabold tracking-tight text-slate-900 dark:text-white text-2xl hidden sm:inline">BOCOFAC</span>
        </button>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(link => (
            <button
              key={link.key}
              onClick={() => go(link.key)}
              className={`px-4 py-2 rounded-lg text-base font-semibold cursor-pointer transition ${
                page === link.key
                  ? 'text-emerald-800 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400'
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900 transition cursor-pointer"
          >
            {isDarkMode ? <Sun className="w-4.5 h-4.5 text-amber-500" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
          {user && (
            <div className="relative">
              <button
                onClick={() => setNotifOpen(v => !v)}
                className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900 transition cursor-pointer"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4.5 h-4.5 min-w-[1.125rem] px-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Notifications</p>
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button
                          onClick={onMarkAllNotificationsRead}
                          className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                      <button onClick={() => setNotifOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-10 px-4">No notifications yet.</p>
                    ) : (
                      notifications.map(n => (
                        <button
                          key={n.id}
                          onClick={() => openNotification(n)}
                          className={`w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0 cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                            n.isRead ? '' : 'bg-emerald-50/60 dark:bg-emerald-950/20'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                              n.isRead ? 'bg-transparent' :
                              n.type === 'error' ? 'bg-rose-500' : n.type === 'success' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`} />
                            <div>
                              <p className="text-xs text-slate-700 dark:text-slate-200 leading-snug">{n.message}</p>
                              <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => (onOpenCart ? onOpenCart() : go('products'))}
            className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900 transition cursor-pointer"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4.5 h-4.5 min-w-[1.125rem] px-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
          {showAccountButton && (
            <button
              onClick={() => setPage(accountTarget)}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#313826] hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wide transition cursor-pointer"
            >
              <AccountIcon className="w-3.5 h-3.5" /> {accountLabel}
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 px-4 py-3 space-y-1 bg-white dark:bg-slate-950">
          {navLinks.map(link => (
            <button
              key={link.key}
              onClick={() => go(link.key)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition ${
                page === link.key
                  ? 'bg-[#313826] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              {link.label}
            </button>
          ))}
          {showAccountButton && (
            <button
              onClick={() => { setPage(accountTarget); setMobileMenuOpen(false); }}
              className="w-full flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-sm font-bold cursor-pointer"
            >
              <AccountIcon className="w-4 h-4" /> {accountLabel}
            </button>
          )}
        </div>
      )}
    </header>
  );
}
