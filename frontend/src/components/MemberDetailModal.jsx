// src/components/MemberDetailModal.jsx
// Read-only shareholder profile for the Admin Membership tab - the fuller
// editable version (plus ledger/withdrawal history) lives in
// ShareCapitalLedger.jsx's own "viewedMember" drawer; this covers the same
// Member's Information Sheet fields for a quick look without leaving the
// Membership tab. Delinquent members additionally get two escalating
// actions here: nudge them first (Send Reminder), and only fall back to
// Remove Membership if that goes unheeded - both need a final confirmation
// since the account only surfaces this modal for someone already flagged.
import React, { useState } from 'react';
import { X, AlertTriangle, Bell, UserX } from 'lucide-react';
import { Field, Section } from './ProfileField';
import { formatDate } from '../utils/formatDate';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

export default function MemberDetailModal({ member: m, onClose, onToast }) {
  const [confirmAction, setConfirmAction] = useState(null);
  const [busy, setBusy] = useState(false);

  const sendReminder = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/members/${m.id}/remind`, {
        method: 'PATCH',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to send reminder.');
      onToast?.(`Reminder sent to ${m.name}.`, 'success');
      setConfirmAction(null);
      onClose();
    } catch (err) {
      onToast?.(err.message || 'Failed to send reminder.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeMembership = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/members/${m.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'Removed' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to remove membership.');
      onToast?.(`${m.name}'s membership was removed.`, 'success');
      setConfirmAction(null);
      onClose();
    } catch (err) {
      onToast?.(err.message || 'Failed to remove membership.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <p className="text-xs text-slate-400 font-mono">{m.id}</p>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{m.name}</h3>
            <p className="text-xs text-slate-500">{m.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              m.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
              m.status === 'Removed' ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
              'bg-rose-100 text-rose-800'
            }`}>{m.status}</span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <Section title="Membership">
            <Field label="Joined" value={m.joinedDate ? formatDate(m.joinedDate) : null} />
            <Field label="Required Share Capital" value={m.requiredShareCapital != null ? `₱${Number(m.requiredShareCapital).toLocaleString()}` : null} />
            <Field label="Civic/Org Affiliation" value={m.civicOrgAffiliation} />
          </Section>

          <Section title="Member's Information Sheet">
            <Field label="Address" value={m.address} />
            <Field label="Mobile Number" value={m.mobileNumber} />
            <Field label="NCFRS ID" value={m.ncfrsId} />
            <Field label="RSBSA ID" value={m.rsbsaId} />
          </Section>

          <Section title="Membership Fee">
            <Field label="Amount" value={m.membershipFee != null ? `₱${Number(m.membershipFee).toLocaleString()}` : null} />
            <Field label="Date Paid" value={m.membershipFeeDatePaid ? formatDate(m.membershipFeeDatePaid) : null} />
            <Field label="Reference" value={m.membershipFeeReference} />
          </Section>

          <Section title="Physical Folder Checklist">
            <Field label="CV on File" value={m.hasCv ? 'Yes' : 'No'} />
            <Field label="Farm Photo on File" value={m.hasFarmPhoto ? 'Yes' : 'No'} />
            <Field label="Share Certificate on File" value={m.hasShareCert ? 'Yes' : 'No'} />
          </Section>

          {m.farmProfileNotes && (
            <Section title="Farm Profile Notes">
              <div className="sm:col-span-3">
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{m.farmProfileNotes}</p>
              </div>
            </Section>
          )}
        </div>

        {m.status === 'Delinquent' && (
          <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900">
            <p className="text-xs text-slate-400 mr-auto max-w-[16rem]">
              Delinquent - nudge them first, and only remove membership if they don&apos;t respond.
            </p>
            <button
              onClick={() => setConfirmAction('remind')}
              className="px-4 py-2 rounded-xl bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950/60 font-bold text-sm cursor-pointer flex items-center gap-1.5"
            >
              <Bell className="w-4 h-4" /> Send Reminder
            </button>
            <button
              onClick={() => setConfirmAction('remove')}
              className="px-4 py-2 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/60 font-bold text-sm cursor-pointer flex items-center gap-1.5"
            >
              <UserX className="w-4 h-4" /> Remove Membership
            </button>
          </div>
        )}
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 space-y-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              confirmAction === 'remind' ? 'bg-amber-100 dark:bg-amber-950/50' : 'bg-rose-100 dark:bg-rose-950/50'
            }`}>
              {confirmAction === 'remind' ? (
                <Bell className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {confirmAction === 'remind' ? `Send a reminder to ${m.name}?` : `Remove ${m.name}'s membership?`}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {confirmAction === 'remind'
                  ? 'This sends them an in-app notification warning that their share capital account is delinquent and needs to be settled.'
                  : "This marks their membership status as Removed. It doesn't delete their records or payment history, but they lose active-member standing. Only do this after a reminder has gone unheeded."}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-slate-700 font-semibold text-sm transition cursor-pointer disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction === 'remind' ? sendReminder : removeMembership}
                disabled={busy}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition text-white cursor-pointer disabled:opacity-60 ${
                  confirmAction === 'remind' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {busy ? 'Please wait…' : confirmAction === 'remind' ? 'Yes, Send Reminder' : 'Yes, Remove Membership'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
