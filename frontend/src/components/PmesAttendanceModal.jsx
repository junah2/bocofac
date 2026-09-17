// src/components/PmesAttendanceModal.jsx
// Shared by AdminDashboardPage and BoardDashboardPage, but the two roles see
// different things: admin runs the physical roll-call (mark present, enroll
// walk-ins) and never sends certificates; the board never checks anyone in -
// they only ever see whoever admin already marked present (the backend
// filters the roster itself for board, not just this UI) and their only
// action is Send Certificate. Both restrictions are enforced server-side too.
import React, { useEffect, useState } from 'react';
import { Check, X, UserPlus, Mail, Send } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

export default function PmesAttendanceModal({ session, role, onClose, onToast }) {
  const isAdmin = role === 'admin';
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [walkInForm, setWalkInForm] = useState({ fullName: '', email: '' });
  const [addingWalkIn, setAddingWalkIn] = useState(false);

  const loadRoster = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/pmes-sessions/${session.id}/registrations`, { credentials: 'include' });
      setEntries(res.ok ? await res.json() : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRoster(); }, [session.id]);

  const toggleAttended = async (entry) => {
    setBusyId(entry.id);
    try {
      const res = await fetch(`${API_BASE}/pmes-sessions/${session.id}/registrations/${entry.id}/attended`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ attended: !entry.attended }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update attendance.');
      }
      const updated = await res.json();
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } catch (err) {
      onToast?.(err.message || 'Failed to update attendance.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const sendCertificate = async (entry) => {
    setBusyId(entry.id);
    try {
      const res = await fetch(`${API_BASE}/pmes-sessions/${session.id}/registrations/${entry.id}/send-certificate`, {
        method: 'PATCH',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to send certificate.');
      setEntries((prev) => prev.map((e) => (e.id === data.id ? data : e)));
      if (data.emailIsTest) {
        onToast?.(`Certificate sent (TEST inbox - no real SMTP configured). Preview: ${data.emailPreviewUrl || '(see server console)'}`, 'success');
      } else {
        onToast?.(`Certificate emailed to ${entry.email}.`, 'success');
      }
    } catch (err) {
      onToast?.(err.message || 'Failed to send certificate.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const submitWalkIn = async (e) => {
    e.preventDefault();
    if (!walkInForm.fullName.trim() || !walkInForm.email.trim()) {
      onToast?.('Full name and email are required to enroll a walk-in.', 'error');
      return;
    }
    setAddingWalkIn(true);
    try {
      const res = await fetch(`${API_BASE}/pmes-sessions/${session.id}/registrations/walk-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(walkInForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to enroll walk-in.');
      setEntries((prev) => [...prev, data]);
      setWalkInForm({ fullName: '', email: '' });
      onToast?.(`${data.name} checked in as a walk-in attendee.`, 'success');
    } catch (err) {
      onToast?.(err.message || 'Failed to enroll walk-in.', 'error');
    } finally {
      setAddingWalkIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto my-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">PMES Attendance</h3>
            <p className="text-xs text-slate-400">{session.title}{session.venue ? ` · ${session.venue}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5">
          {isAdmin
            ? 'Call out each registered name below and mark them Present as they confirm attendance. Attended but not on the list? Enroll them as a walk-in at the bottom. Sending the certificate is the Board’s call once attendance is checked in.'
            : 'This list only shows attendees Admin has already checked in as Present. Send each one their Certificate of Attendance below.'}
        </p>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading roster…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            {isAdmin ? 'No registrations yet.' : 'No one has been checked in as present yet.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {entries.map((entry) => (
              <div key={entry.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    {entry.name || 'Unknown'}
                    {entry.walkIn && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">Walk-in</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">{entry.email}</p>
                  {entry.certificateSentAt && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Certificate sent</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={busyId === entry.id}
                      onClick={() => toggleAttended(entry)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1 ${
                        entry.attended
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" /> {entry.attended ? 'Present' : 'Mark Present'}
                    </button>
                  )}
                  {!isAdmin && (
                    <button
                      type="button"
                      disabled={busyId === entry.id || !!entry.certificateSentAt}
                      onClick={() => sendCertificate(entry)}
                      className="px-3 py-1.5 rounded-lg bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-950/50 dark:text-sky-400 text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" /> {entry.certificateSentAt ? 'Sent' : 'Send Certificate'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <form onSubmit={submitWalkIn} className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Enroll a walk-in attendee
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Full name"
                value={walkInForm.fullName}
                onChange={(e) => setWalkInForm((f) => ({ ...f, fullName: e.target.value }))}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={walkInForm.email}
                  onChange={(e) => setWalkInForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={addingWalkIn}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {addingWalkIn ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
