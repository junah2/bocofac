// src/components/ApplicantDetailModal.jsx
import React, { useState } from 'react';
import { X, Check, FileText, AlertTriangle } from 'lucide-react';
import { displayApplicantStatus } from '../utils/applicantStatus';
import { Field, Section } from './ProfileField';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

// Mirrors backend/src/utils/shareCapital.js - every member's required share
// capital target must fall inside this range.
const MIN_REQUIRED_SHARE_CAPITAL = 4000;
const MAX_REQUIRED_SHARE_CAPITAL = 25000;

// Shared between the Board (full review, approve/reject/set required share
// capital) and Admin (read-only - approval decisions belong to the Board)
// Membership tabs, so both always show the exact same applicant record
// instead of two views drifting apart. Passing onUpdateApplicantStatus is
// what turns on the approve/reject controls; leaving it out renders a
// read-only profile.
export default function ApplicantDetailModal({ applicant: a, onClose, onUpdateApplicantStatus, onToast }) {
  const readOnly = !onUpdateApplicantStatus;
  const docs = a.documentsUploaded || {};
  const [rejectReasonDraft, setRejectReasonDraft] = useState('');
  const [requiredShareCapitalDraft, setRequiredShareCapitalDraft] = useState('10000');
  // Confirms the final Approve/Reject decision before it's actually sent -
  // both are hard to walk back (approval auto-creates the member account;
  // rejection is final for that submission), so a stray click shouldn't
  // decide someone's membership outright.
  const [confirmAction, setConfirmAction] = useState(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div>
            <p className="text-xs text-slate-400 font-mono">{a.id}</p>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{a.fullName}</h3>
            <p className="text-xs text-slate-500">{a.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              a.status === 'Approved' ? 'bg-emerald-600 text-white' :
              a.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
              'bg-amber-100 text-amber-800'
            }`}>{displayApplicantStatus(a.status)}</span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <Section title="Personal Data Sheet">
            <Field label="First Name" value={a.firstName} />
            <Field label="Middle Name" value={a.middleName} />
            <Field label="Family Name" value={a.lastName} />
            <Field label="Suffix" value={a.suffix} />
            <Field label="Birthday" value={a.birthdate ? new Date(a.birthdate).toLocaleDateString() : null} />
            <Field label="Birthplace" value={a.birthplace} />
            <Field label="Gender" value={a.gender} />
            <Field label="Civil Status" value={a.civilStatus} />
            <Field label="Mobile / CP #" value={a.phone || a.cpNumber} />
            <Field label="Email" value={a.email} />
          </Section>

          <Section title="Address & Background">
            <Field label="Address #" value={a.addressNumber} />
            <Field label="Street" value={a.street} />
            <Field label="Zone" value={a.zone} />
            <Field label="Barangay" value={a.barangay} />
            <Field label="Mun. / City" value={a.munCity} />
            <Field label="Facebook" value={a.facebook} />
            <Field label="Occupation" value={a.occupation} />
            <Field label="Employer" value={a.employer} />
            <Field label="Annual Income" value={a.annualIncome != null ? `₱${Number(a.annualIncome).toLocaleString()}` : null} />
            <Field label="Business Owned / Connected" value={a.businessOwned} />
            <Field label="TIN" value={a.tin} />
            <Field label="Religion" value={a.religion} />
          </Section>

          <Section title="Family & Dependents">
            <Field label="Spouse / Contact Person" value={a.spouseContactPerson} />
            <Field label="CP #s" value={a.spouseCpNumber} />
            <Field label="No. of Dependents" value={a.noOfDependents ?? 0} />
          </Section>
          {a.dependents && a.dependents.length > 0 && (
            <div className="border rounded-xl overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-[10px] uppercase text-slate-400">
                    <th className="p-2.5 font-bold">Name</th>
                    <th className="p-2.5 font-bold">Birthdate</th>
                    <th className="p-2.5 font-bold">Age</th>
                    <th className="p-2.5 font-bold">Sex</th>
                  </tr>
                </thead>
                <tbody>
                  {a.dependents.map((d, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300">{d.name}</td>
                      <td className="p-2.5 text-slate-500">{d.birthdate ? new Date(d.birthdate).toLocaleDateString() : '—'}</td>
                      <td className="p-2.5 text-slate-500">{d.age ?? '—'}</td>
                      <td className="p-2.5 text-slate-500">{d.sex || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Section title="Farm & Education">
            <Field label="Educational Attainment" value={a.eduAttainment} />
          </Section>

          {a.farmProfile && (
            <>
              <Section title="Coconut">
                <Field label="Area (ha)" value={a.farmProfile.coconut?.areaHa} />
                <Field label="Bearing" value={a.farmProfile.coconut?.bearing} />
                <Field label="Non-Bearing" value={a.farmProfile.coconut?.nonBearing} />
                <Field label="Months / Harvest" value={a.farmProfile.coconut?.monthsPerHarvest} />
                <Field label="Ave Nuts / Harvest" value={a.farmProfile.coconut?.aveNutsHarvest} />
                <Field label="Last Harvest" value={a.farmProfile.coconut?.lastHarvest ? new Date(a.farmProfile.coconut.lastHarvest).toLocaleDateString() : null} />
                <Field label="Ave Kopra Sold (kg)" value={a.farmProfile.coconut?.aveKopraSoldKg} />
                <Field label="Ave Harvest Charcoal" value={a.farmProfile.coconut?.aveHarvestCharcoal} />
              </Section>

              <Section title="Swine">
                <Field label="Sow" value={a.farmProfile.swine?.sow} />
                <Field label="Piglets" value={a.farmProfile.swine?.piglets} />
                <Field label="Farrowing Date" value={a.farmProfile.swine?.farrowingDate ? new Date(a.farmProfile.swine.farrowingDate).toLocaleDateString() : null} />
                <Field label="Fattening" value={a.farmProfile.swine?.fattening} />
              </Section>

              <Section title="Livestock">
                <Field label="Cow - Male" value={a.farmProfile.livestock?.cowMale} />
                <Field label="Cow - Female" value={a.farmProfile.livestock?.cowFemale} />
                <Field label="Goat" value={a.farmProfile.livestock?.goat} />
                <Field label="Carabao - Female" value={a.farmProfile.livestock?.carabaoFemale} />
                <Field label="Carabao - Male" value={a.farmProfile.livestock?.carabaoMale} />
                <Field label="Others" value={a.farmProfile.livestock?.others} />
              </Section>

              <Section title="Cacao">
                <Field label="Area (ha/sqm)" value={a.farmProfile.cacao?.areaHaSqm} />
                <Field label="Bearing" value={a.farmProfile.cacao?.bearing} />
                <Field label="Non-Bearing" value={a.farmProfile.cacao?.nonBearing} />
                <Field label="Harvest Cycle" value={a.farmProfile.cacao?.harvestCycle} />
                <Field label="Ave Nuts / Harvest" value={a.farmProfile.cacao?.aveNutsHarvest} />
                <Field label="Last Harvest" value={a.farmProfile.cacao?.lastHarvest ? new Date(a.farmProfile.cacao.lastHarvest).toLocaleDateString() : null} />
                <Field label="Total / Harvest" value={a.farmProfile.cacao?.totalHarvest} />
                <Field label="Unit Price" value={a.farmProfile.cacao?.unitPrice} />
                <Field label="Ave Beans Sold (kg)" value={a.farmProfile.cacao?.aveBeansSoldKg} />
              </Section>

              <Section title="Rice & Corn">
                <Field label="Rice Area (ha/sqm)" value={a.farmProfile.rice?.areaHaSqm} />
                <Field label="Rice Location" value={a.farmProfile.rice?.location} />
                <Field label="Corn Area (ha/sqm)" value={a.farmProfile.corn?.areaHaSqm} />
                <Field label="Corn Location" value={a.farmProfile.corn?.location} />
              </Section>

              {a.farmProfile.otherCrops && a.farmProfile.otherCrops.length > 0 && (
                <div className="border rounded-xl overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 text-left text-[10px] uppercase text-slate-400">
                        <th className="p-2.5 font-bold">Crop</th>
                        <th className="p-2.5 font-bold">Area (ha/sqm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.farmProfile.otherCrops.map((c, i) => (
                        <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300">{c.crop}</td>
                          <td className="p-2.5 text-slate-500">{c.areaHaSqm || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {a.farmProfile.otherRemarks && (
                <Section title="Other Remarks">
                  <div className="sm:col-span-3">
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{a.farmProfile.otherRemarks}</p>
                  </div>
                </Section>
              )}
            </>
          )}

          <Section title="Requirements & Documents">
            <Field label="EDUCOM Chairperson" value={a.educomChairperson} />
            <Field label="ID Type" value={a.idType} />
            <Field label="ID #" value={a.idNumber} />
            <Field label="ID Date Issued" value={a.idDateIssued ? new Date(a.idDateIssued).toLocaleDateString() : null} />
            <Field label="ID Place Issued" value={a.idPlaceIssued} />
          </Section>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Valid ID', 'valid_id', docs.validId],
              ['PMES Certificate', 'pmes_certificate', docs.pmesCertificate],
              ['Payment Receipt', 'registration_fee_receipt', docs.registrationFeeReceipt],
            ].map(([label, docType, uploaded]) => {
              if (!uploaded) {
                return (
                  <div key={label} className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 aspect-[4/3] flex flex-col items-center justify-center gap-1 text-slate-400">
                    <X className="w-5 h-5" />
                    <p className="text-[11px] font-semibold text-center px-1">{label}</p>
                  </div>
                );
              }
              const url = `${API_BASE}/applicants/${a.id}/documents/${docType}`;
              return (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:border-emerald-500 transition"
                >
                  <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden relative">
                    <img
                      src={url}
                      alt={label}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                    />
                    <div className="hidden absolute inset-0 items-center justify-center text-slate-400">
                      <FileText className="w-8 h-8" />
                    </div>
                  </div>
                  <p className="px-2 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3 shrink-0" /> {label}
                  </p>
                </a>
              );
            })}
          </div>

          <Section title="PMES & Membership">
            <Field label="PMES Attended" value={a.pmesAttended ? `Yes (${a.pmesDate ? new Date(a.pmesDate).toLocaleDateString() : ''})` : 'Not yet'} />
            <Field label="Registration Fee Paid" value={a.registrationFeePaid ? 'Yes' : 'No'} />
            <Field label="Payment Reference #" value={a.referenceNumber} />
            <Field label="Membership Fee" value={a.membershipFee != null ? `₱${Number(a.membershipFee).toFixed(2)}` : '₱300.00'} />
            <Field label="Subscribed Share" value={a.subscribedShare != null ? `₱${a.subscribedShare}` : null} />
            <Field label="Paid-up Capital" value={a.paidUpCapital != null ? `₱${a.paidUpCapital}` : null} />
            <Field label="OR #" value={a.orNumber} />
            <Field label="Submitted At" value={a.submittedAt ? new Date(a.submittedAt).toLocaleString() : null} />
          </Section>

          <div className="pt-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800">
            {a.pmesAttended ? (
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> PMES attendance confirmed{a.pmesDate ? ` on ${new Date(a.pmesDate).toLocaleDateString()}` : ''} - certificate sent from the session roster.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Not yet confirmed. PMES attendance is now checked in from the actual session roster
                (<span className="font-semibold text-slate-700 dark:text-slate-300">PMES Attendance</span> tab) rather than here,
                so the certificate is only sent once someone is checked in as physically present.
              </p>
            )}
          </div>
        </div>

        {a.status === 'Rejected' && a.rejectionReason && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-400 mb-1">Rejection Reason</p>
              <p className="text-sm text-rose-800 dark:text-rose-300">{a.rejectionReason}</p>
            </div>
          </div>
        )}

        {!readOnly && a.status !== 'Rejected' && a.status !== 'Approved' && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Required Share Capital (₱{MIN_REQUIRED_SHARE_CAPITAL.toLocaleString()}–₱{MAX_REQUIRED_SHARE_CAPITAL.toLocaleString()}, required to approve)
              </label>
              <input
                type="number"
                min={MIN_REQUIRED_SHARE_CAPITAL}
                max={MAX_REQUIRED_SHARE_CAPITAL}
                step={500}
                value={requiredShareCapitalDraft}
                onChange={(e) => setRequiredShareCapitalDraft(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Rejection Reason (required to reject)
              </label>
              <textarea
                value={rejectReasonDraft}
                onChange={(e) => setRejectReasonDraft(e.target.value)}
                placeholder="E.g., incomplete requirements, ID does not match records, duplicate application..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm resize-none"
              />
            </div>
          </div>
        )}

        {!readOnly && (
          <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900">
            {a.status !== 'Rejected' && a.status !== 'Approved' && (
              <button
                onClick={() => {
                  if (!rejectReasonDraft.trim()) {
                    onToast?.('Please provide a rejection reason.', 'error');
                    return;
                  }
                  setConfirmAction('reject');
                }}
                className="px-4 py-2 rounded-xl bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-950/60 font-bold text-sm cursor-pointer"
              >
                Reject
              </button>
            )}
            {a.status !== 'Approved' && (
              <button
                onClick={() => {
                  const capital = Number(requiredShareCapitalDraft);
                  if (!Number.isFinite(capital) || capital < MIN_REQUIRED_SHARE_CAPITAL || capital > MAX_REQUIRED_SHARE_CAPITAL) {
                    onToast?.(`Required share capital must be between ₱${MIN_REQUIRED_SHARE_CAPITAL.toLocaleString()} and ₱${MAX_REQUIRED_SHARE_CAPITAL.toLocaleString()}.`, 'error');
                    return;
                  }
                  setConfirmAction('approve');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer"
              >
                Approve
              </button>
            )}
          </div>
        )}
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 space-y-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              confirmAction === 'approve' ? 'bg-emerald-100 dark:bg-emerald-950/50' : 'bg-rose-100 dark:bg-rose-950/50'
            }`}>
              {confirmAction === 'approve' ? (
                <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {confirmAction === 'approve' ? `Approve ${a.fullName}'s application?` : `Reject ${a.fullName}'s application?`}
              </h3>
              {confirmAction === 'approve' ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  This creates their member account with a required share capital of <span className="font-semibold">₱{Number(requiredShareCapitalDraft).toLocaleString()}</span>. Double-check this is the right person before confirming.
                </p>
              ) : (
                <div className="mt-1 space-y-2">
                  <p className="text-sm text-slate-500 dark:text-slate-400">This is final for this submission and emails the applicant. Reason to be sent:</p>
                  <p className="text-sm p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300">{rejectReasonDraft.trim()}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-slate-700 font-semibold text-sm transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmAction === 'approve') {
                    onUpdateApplicantStatus(a.id, { status: 'Approved', requiredShareCapital: Number(requiredShareCapitalDraft) });
                  } else {
                    onUpdateApplicantStatus(a.id, { status: 'Rejected', reason: rejectReasonDraft.trim() });
                  }
                  setConfirmAction(null);
                  onClose();
                }}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition text-white cursor-pointer ${
                  confirmAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {confirmAction === 'approve' ? 'Yes, Approve' : 'Yes, Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
