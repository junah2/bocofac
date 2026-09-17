// src/components/CustomerMessageWidget.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Package } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
const POLL_MS = 6000;

function timeLabel(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Floating Messenger-style bubble for a signed-in customer to ask the co-op
// questions - especially about an order, since an admin reply can carry an
// order tag (message.orderId) even though the thread itself is a single
// ongoing conversation, not one thread per order.
export default function CustomerMessageWidget({ user, onToast }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const unreadCount = messages.filter((m) => m.senderRole === 'admin' && !m.readByCustomer).length;

  const fetchThread = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/messages/mine`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
      // Network hiccup - keep showing the last known thread.
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchThread();
    const interval = setInterval(fetchThread, POLL_MS);
    return () => clearInterval(interval);
  }, [user, fetchThread]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (!open || unreadCount === 0) return;
    fetch(`${API_BASE}/messages/mine/read`, { method: 'PATCH', credentials: 'include' })
      .then(() => setMessages((prev) => prev.map((m) => (m.senderRole === 'admin' ? { ...m, readByCustomer: true } : m))))
      .catch(() => {});
  }, [open, unreadCount]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/messages/mine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to send message.');
      setMessages((prev) => [...prev, data]);
      setDraft('');
    } catch (err) {
      onToast && onToast(err.message || 'Failed to send message.', 'error');
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50">
      {open && (
        <div className="mb-3 w-96 max-w-[90vw] h-[32rem] max-h-[70vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-[#313826] text-white">
            <p className="text-sm font-bold">Message BOCOFAC</p>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-slate-50 dark:bg-slate-950">
            {messages.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-10 px-4">
                Ask us anything about your order, or send a question to get started.
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.senderRole === 'customer' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    m.senderRole === 'customer'
                      ? 'bg-emerald-700 text-white rounded-br-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm'
                  }`}>
                    {m.orderId && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold mb-1 px-1.5 py-0.5 rounded ${
                        m.senderRole === 'customer' ? 'bg-emerald-800/60 text-emerald-50' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}>
                        <Package className="w-3 h-3" /> {m.orderId}
                      </span>
                    )}
                    <p className="text-sm leading-snug whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`text-[10px] mt-1 ${m.senderRole === 'customer' ? 'text-emerald-100' : 'text-slate-400'}`}>
                      {timeLabel(m.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 flex items-end gap-2 bg-white dark:bg-slate-900">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              rows={1}
              maxLength={2000}
              className="flex-1 resize-none rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-600"
            />
            <button
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className="p-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white cursor-pointer transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-14 h-14 rounded-full bg-[#313826] hover:bg-emerald-800 text-white shadow-xl flex items-center justify-center cursor-pointer transition"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 min-w-[1.25rem] px-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
