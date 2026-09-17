// src/components/AdminMessageWidget.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, X, Send, Package, ArrowLeft, ChevronDown } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

function timeLabel(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatOrderBlock(order) {
  const itemsLine = order.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ');
  return `Order ${order.id}\nStatus: ${order.status}\nItems: ${itemsLine || 'N/A'}\nTotal: ₱${order.totalAmount.toLocaleString()}`;
}

// Floating admin counterpart to CustomerMessageWidget - a two-level panel
// (conversation list, then a selected thread) since an admin has many
// customers rather than one thread. The conversation list itself is owned by
// App.jsx (same pattern as orders/members/etc.) and pushed in as a prop so
// it refreshes on the shared admin SSE stream; only the opened thread's
// detail is fetched locally here, same as any other transient dashboard view.
export default function AdminMessageWidget({ conversations = [], onRefetchConversations, onToast }) {
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [thread, setThread] = useState(null);
  const [draft, setDraft] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const fetchThread = useCallback(async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/messages/conversations/${userId}`, { credentials: 'include' });
      if (res.ok) setThread(await res.json());
    } catch {
      // Network hiccup - keep showing the last known thread.
    }
  }, []);

  const openConversation = async (userId) => {
    setSelectedUserId(userId);
    setThread(null);
    await fetchThread(userId);
    try {
      await fetch(`${API_BASE}/messages/conversations/${userId}/read`, { method: 'PATCH', credentials: 'include' });
      onRefetchConversations && onRefetchConversations();
    } catch {
      // Best-effort - the next SSE-triggered refetch will reconcile.
    }
  };

  // The shared admin SSE stream (App.jsx) refreshes the `conversations` prop
  // the instant any customer's message activity changes - if a thread is
  // currently open, pull its detail again too so a reply shows up live.
  useEffect(() => {
    if (selectedUserId) fetchThread(selectedUserId);
  }, [conversations, selectedUserId, fetchThread]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [thread]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending || !selectedUserId) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/messages/conversations/${selectedUserId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to send message.');
      setThread((prev) => (prev ? { ...prev, messages: [...prev.messages, data] } : prev));
      setDraft('');
    } catch (err) {
      onToast && onToast(err.message || 'Failed to send message.', 'error');
    } finally {
      setSending(false);
    }
  };

  const attachOrder = (order) => {
    setDraft((prev) => (prev ? `${prev}\n\n${formatOrderBlock(order)}` : formatOrderBlock(order)));
    setAttachOpen(false);
  };

  const backToList = () => {
    setSelectedUserId(null);
    setThread(null);
    setDraft('');
    setAttachOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-3 w-96 max-w-[90vw] h-[34rem] max-h-[75vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-[#313826] text-white">
            <div className="flex items-center gap-2 min-w-0">
              {selectedUserId && (
                <button onClick={backToList} className="text-white/80 hover:text-white cursor-pointer shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <p className="text-sm font-bold truncate">
                {selectedUserId ? (thread?.customer?.name || 'Customer') : 'Customer Messages'}
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white cursor-pointer shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {!selectedUserId ? (
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-10 px-4">No customer messages yet.</p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openConversation(c.userId)}
                    className="w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0 cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{c.customerName}</p>
                      {c.unreadCount > 0 && (
                        <span className="w-4.5 h-4.5 min-w-[1.125rem] px-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {c.unreadCount > 9 ? '9+' : c.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {c.lastMessageSenderRole === 'admin' ? 'You: ' : ''}{c.lastMessageBody || 'No messages yet'}
                    </p>
                  </button>
                ))
              )}
            </div>
          ) : (
            <>
              <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-slate-50 dark:bg-slate-950">
                {!thread ? (
                  <p className="text-center text-xs text-slate-400 py-10">Loading...</p>
                ) : thread.messages.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-10 px-4">No messages yet.</p>
                ) : (
                  thread.messages.map((m) => (
                    <div key={m.id} className={`flex ${m.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                        m.senderRole === 'admin'
                          ? 'bg-emerald-700 text-white rounded-br-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm'
                      }`}>
                        {m.orderId && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold mb-1 px-1.5 py-0.5 rounded ${
                            m.senderRole === 'admin' ? 'bg-emerald-800/60 text-emerald-50' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}>
                            <Package className="w-3 h-3" /> {m.orderId}
                          </span>
                        )}
                        <p className="text-sm leading-snug whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`text-[10px] mt-1 ${m.senderRole === 'admin' ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {timeLabel(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                {thread?.orders?.length > 0 && (
                  <div className="relative px-2.5 pt-2">
                    <button
                      onClick={() => setAttachOpen((v) => !v)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 cursor-pointer"
                    >
                      <Package className="w-3.5 h-3.5" /> Attach order details <ChevronDown className="w-3 h-3" />
                    </button>
                    {attachOpen && (
                      <div className="absolute bottom-full left-2.5 mb-1 w-72 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10">
                        {thread.orders.map((order) => (
                          <button
                            key={order.id}
                            onClick={() => attachOrder(order)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-b-0 cursor-pointer"
                          >
                            <span className="font-semibold text-slate-800 dark:text-slate-100">{order.id}</span>
                            <span className="text-slate-400"> • {order.status} • ₱{order.totalAmount.toLocaleString()}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="p-2.5 flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type a reply..."
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
            </>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-14 h-14 rounded-full bg-[#313826] hover:bg-emerald-800 text-white shadow-xl flex items-center justify-center cursor-pointer transition"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 min-w-[1.25rem] px-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>
    </div>
  );
}
