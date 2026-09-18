// src/components/MemberDetailModal.jsx
// Read-only shareholder profile for the Admin Membership tab - the fuller
// editable version (plus ledger/withdrawal history) lives in
// ShareCapitalLedger.jsx's own "viewedMember" drawer; this covers the same
// Member's Information Sheet fields for a quick look without leaving the
// Membership tab.
import React from 'react';
import { X } from 'lucide-react';
import { Field, Section } from './ProfileField';
import { formatDate } from '../utils/formatDate';

export default function MemberDetailModal({ member: m, onClose }) {
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
              m.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
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
      </div>
    </div>
  );
}
