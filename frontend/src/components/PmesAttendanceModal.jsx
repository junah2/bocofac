// src/components/PmesAttendanceModal.jsx
// Shared by AdminDashboardPage and BoardDashboardPage, but the two roles see
// different things: admin runs the physical roll-call (mark present, enroll
// walk-ins) and never sends certificates; the board never checks anyone in -
// they only ever see whoever admin already marked present (the backend
// filters the roster itself for board, not just this UI) and their only
// action is Send Certificate. Both restrictions are enforced server-side too.
import React, { useEffect, useState } from 'react';
import { Check, X, UserPlus, Mail, Send, AlertTriangle } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

export default function PmesAttendanceModal({ session, role, onClose, onToast }) {
  const isAdmin = role === 'admin';
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [walkInForm, setWalkInForm] = useState({ fullName: '', email: '' });
  const [addingWalkIn, setAddingWalkIn] = useState(false);
  // Confirms before an actual, hard-to-undo certificate email goes out - a
  // stray/accidental click on "Send Certificate" would otherwise email the
  // wrong person immediately with no way to recall it.
  const [confirmSend, setConfirmSend] = useState(null);
  // Board's send-certificate list splits into Pending/Sent (mirrors the
  // Active/History pattern used for Orders elsewhere) so a long roster of
  // already-sent names doesn't bury the people still waiting.
  const [sendView, setSendView] = useState('pending');
  // Clearing a name here only hides it from this board view (saved per
  // session in the browser) - it never deletes the actual attendance /
  // certificate-sent record, which stays as the cooperative's real audit
  // trail of who was actually emailed a certificate.
  const [dismissedSentIds, setDismissedSentIds] = useState([]);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  // Cleared names are never actually gone - this reveals them again so the
  // board can always prove a certificate really was sent, and undo a clear.
  const [showCleared, setShowCleared] = useState(false);
  // Confirms before toggling attendance - a stray click on "Mark Present"
  // would otherwise instantly check someone in (which can unlock sending
  // them a certificate) with no prompt to double-check it's the right name.
  const [confirmAttendance, setConfirmAttendance] = useState(null);
  const dismissedStorageKey = `bocofac_pmes_dismissed_sent_${session.id}`;

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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(dismissedStorageKey);
      setDismissedSentIds(raw ? JSON.parse(raw) : []);
    } catch {
      setDismissedSentIds([]);
    }
  }, [session.id, dismissedStorageKey]);

  const persistDismissed = (ids) => {
    setDismissedSentIds(ids);
    try {
      window.localStorage.setItem(dismissedStorageKey, JSON.stringify(ids));
    } catch { /* best-effort only */ }
  };
  const dismissSentEntry = (id) => persistDismissed([...dismissedSentIds, id]);
  const restoreSentEntry = (id) => persistDismissed(dismissedSentIds.filter((x) => x !== id));

  const pendingEntries = entries.filter((e) => !e.certificateSentAt);
  const sentEntriesAll = entries.filter((e) => e.certificateSentAt);
  const sentEntries = sentEntriesAll.filter((e) => !dismissedSentIds.includes(e.id));
  const clearedEntries = sentEntriesAll.filter((e) => dismissedSentIds.includes(e.id));
  const visibleEntries = isAdmin ? entries : (sendView === 'pending' ? pendingEntries : sentEntries);

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

        {!isAdmin && (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setSendView('pending')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                  sendView === 'pending' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Pending ({pendingEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setSendView('sent')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                  sendView === 'sent' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Sent ({sentEntries.length})
              </button>
            </div>
            {sendView === 'sent' && (
              <div className="flex items-center gap-3">
                {sentEntries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
                {clearedEntries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCleared((v) => !v)}
                    className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
                  >
                    {showCleared ? 'Hide' : 'Show'} cleared ({clearedEntries.length})
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {sendView === 'sent' && showCleared && clearedEntries.length > 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-3 space-y-2 bg-slate-50/50 dark:bg-slate-950/20">
            <p className="text-[11px] text-slate-500">
              Cleared from view only - the certificate-sent record is still intact. Restore any of these back into the Sent list:
            </p>
            {clearedEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">{entry.name || 'Unknown'}</p>
                  <p className="text-xs text-slate-400">{entry.email} · sent {entry.certificateSentAt ? new Date(entry.certificateSentAt).toLocaleString() : ''}</p>
                </div>
                <button
                  type="button"
                  onClick={() => restoreSentEntry(entry.id)}
                  className="px-3 py-1 rounded-lg border text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-8">Loading roster…</p>
        ) : visibleEntries.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            {isAdmin
              ? 'No registrations yet.'
              : sendView === 'pending'
                ? 'No one is waiting on a certificate right now.'
                : 'No certificates sent yet.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleEntries.map((entry) => (
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
                      onClick={() => setConfirmAttendance(entry)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1 ${
                        entry.attended
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" /> {entry.attended ? 'Present' : 'Mark Present'}
                    </button>
                  )}
                  {!isAdmin && sendView === 'pending' && (
                    <button
                      type="button"
                      disabled={busyId === entry.id}
                      onClick={() => setConfirmSend(entry)}
                      className="px-3 py-1.5 rounded-lg bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-950/50 dark:text-sky-400 text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" /> Send Certificate
                    </button>
                  )}
                  {!isAdmin && sendView === 'sent' && (
                    <>
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 text-xs font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Sent
                      </span>
                      <button
                        type="button"
                        onClick={() => dismissSentEntry(entry.id)}
                        title="Remove from this list (keeps the certificate-sent record)"
                        className="p-1.5 rounded-lg border text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
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

      {confirmAttendance && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 space-y-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              confirmAttendance.attended ? 'bg-rose-100 dark:bg-rose-950/50' : 'bg-emerald-100 dark:bg-emerald-950/50'
            }`}>
              {confirmAttendance.attended ? (
                <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              ) : (
                <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {confirmAttendance.attended ? 'Unmark' : 'Mark'} {confirmAttendance.name || 'this attendee'} as present?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {confirmAttendance.attended
                  ? 'They will no longer show as checked in for this session. Only do this to correct a mistake.'
                  : 'This confirms they are physically here right now. Make sure this is the right person before confirming - being checked in is what lets the Board later send them a certificate.'}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmAttendance(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-slate-700 font-semibold text-sm transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const entry = confirmAttendance;
                  setConfirmAttendance(null);
                  toggleAttended(entry);
                }}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition text-white cursor-pointer ${
                  confirmAttendance.attended ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {confirmAttendance.attended ? 'Yes, Unmark' : 'Yes, Mark Present'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmSend && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-sky-100 dark:bg-sky-950/50">
              <AlertTriangle className="w-6 h-6 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Send certificate to {confirmSend.name || 'this attendee'}?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                This immediately emails a Certificate of Attendance to <span className="font-semibold">{confirmSend.email}</span> and can&apos;t be undone. Double-check this is the right person before sending.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmSend(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-slate-700 font-semibold text-sm transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const entry = confirmSend;
                  setConfirmSend(null);
                  sendCertificate(entry);
                }}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm transition text-white bg-sky-600 hover:bg-sky-500 cursor-pointer"
              >
                Yes, Send Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmClearAll && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-rose-100 dark:bg-rose-950/50">
              <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Clear all {sentEntries.length} name{sentEntries.length === 1 ? '' : 's'} from this list?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                This only removes them from your Sent view - it does not delete the actual certificate-sent record, and they won&apos;t receive another email.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmClearAll(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-slate-700 font-semibold text-sm transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  persistDismissed([...dismissedSentIds, ...sentEntries.map((e) => e.id)]);
                  setConfirmClearAll(false);
                }}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm transition text-white bg-rose-600 hover:bg-rose-500 cursor-pointer"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
