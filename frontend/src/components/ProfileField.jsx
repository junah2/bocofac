// src/components/ProfileField.jsx
// Small read-only layout primitives shared by the applicant/member profile
// modals (ApplicantDetailModal, MemberDetailModal) so both look consistent.
import React from 'react';

export function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 break-words">{value || value === 0 ? value : '—'}</p>
    </div>
  );
}

export function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-2">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}
