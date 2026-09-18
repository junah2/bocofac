import React, { useState } from 'react';
import {
  Building2,
  Plus,
  ArrowDownToLine,
  ArrowUpDown,
  Calculator,
  UserPlus,
  BookOpen,
  Info,
  Layers,
  Sparkles,
  Eye,
  X,
  Printer,
  Pencil,
  Check as CheckIcon,
} from 'lucide-react';
import { formatDate } from '../utils/formatDate';
import { downloadFile } from '../utils/downloadFile';
import { printOfficialReceipt } from '../utils/printDocument';
import MobileScrollHint from './MobileScrollHint';

// Required share capital targets are set between these two amounts (see
// MIN/MAX_REQUIRED_SHARE_CAPITAL in backend/src/utils/shareCapital.js, which
// enforces the same range server-side). Verified payments only count as
// share capital up to this cap; anything paid beyond it becomes savings.
const MIN_SHARE_CAPITAL = 4000;
const MAX_SHARE_CAPITAL = 25000;
const SHARE_CAPITAL_CAP = MAX_SHARE_CAPITAL;

export default function ShareCapitalLedger({
  members,
  ledger,
  onAddMember,
  onUpdateMember,
  onAddLedgerEntry,
  onVerifyLedgerEntry,
  withdrawals = [],
  onSendWithdrawal,
  onRejectWithdrawal,
  onToast,
  currentUserId,
  canManage = true,
}) {
  const [activeLedgerTab, setActiveLedgerTab] = useState('members');
  const [isPostingPayment, setIsPostingPayment] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [viewedMember, setViewedMember] = useState(null);
  const [viewedTxn, setViewedTxn] = useState(null);
  const [submittingMember, setSubmittingMember] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);

  // Earnings withdrawal review (admin "Send" action)
  const [sendingWithdrawal, setSendingWithdrawal] = useState(null);
  const [sentAmount, setSentAmount] = useState('');
  const [sentReference, setSentReference] = useState('');
  const [submittingSend, setSubmittingSend] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);

  // Member's Information Sheet editing (address/IDs/fee filing/attached
  // copies/farm profile/civic org affiliation - the paper-form fields that
  // live directly on the member record, see backend members.routes.js)
  const [editingSheet, setEditingSheet] = useState(false);
  const [sheetForm, setSheetForm] = useState(null);
  const [submittingSheet, setSubmittingSheet] = useState(false);

  const emptySheetForm = (member) => ({
    requiredShareCapital: member.requiredShareCapital,
    address: member.address || '',
    mobileNumber: member.mobileNumber || '',
    ncfrsId: member.ncfrsId || '',
    rsbsaId: member.rsbsaId || '',
    membershipFee: member.membershipFee ?? 300,
    membershipFeeDatePaid: member.membershipFeeDatePaid ? member.membershipFeeDatePaid.slice(0, 10) : '',
    membershipFeeReference: member.membershipFeeReference || '',
    hasCv: !!member.hasCv,
    hasFarmPhoto: !!member.hasFarmPhoto,
    hasShareCert: !!member.hasShareCert,
    farmProfileNotes: member.farmProfileNotes || '',
    civicOrgAffiliation: member.civicOrgAffiliation || '',
  });

  const startEditingSheet = (member) => {
    setSheetForm(emptySheetForm(member));
    setEditingSheet(true);
  };

  const handleSheetSubmit = async (e) => {
    e.preventDefault();
    const capital = Number(sheetForm.requiredShareCapital);
    if (!Number.isFinite(capital) || capital < MIN_SHARE_CAPITAL || capital > MAX_SHARE_CAPITAL) {
      onToast?.(`Required share capital must be between ₱${MIN_SHARE_CAPITAL.toLocaleString()} and ₱${MAX_SHARE_CAPITAL.toLocaleString()}.`, 'error');
      return;
    }
    setSubmittingSheet(true);
    try {
      const updated = await onUpdateMember(viewedMember.id, {
        ...sheetForm,
        requiredShareCapital: capital,
        membershipFee: sheetForm.membershipFee === '' ? null : Number(sheetForm.membershipFee),
        membershipFeeDatePaid: sheetForm.membershipFeeDatePaid || null,
      });
      setViewedMember(updated);
      setEditingSheet(false);
    } catch {
      // onUpdateMember already surfaced a toast on failure.
    } finally {
      setSubmittingSheet(false);
    }
  };

  // New Membership Post forms
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [requiredCapital, setRequiredCapital] = useState(10000);

  // New Ledger payment entry forms
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(1000);
  const [paymentMethod, setPaymentMethod] = useState('GCash');
  const [txnRef, setTxnRef] = useState('');

  // 1. Math balance algorithms per member - verified payments only count as
  // share capital up to SHARE_CAPITAL_CAP; anything paid beyond that is the
  // member's savings instead (kept in sync with backend members.routes.js /
  // withdrawals.routes.js, which enforce the same cap for real).
  const getMemberBalances = (member) => {
    const verifiedPayments = ledger
      .filter(l => l.memberId === member.id && l.status === 'Verified')
      .reduce((sum, entry) => sum + entry.amount, 0);

    const shareCapitalContribution = Math.min(verifiedPayments, SHARE_CAPITAL_CAP);
    const savingsBalance = Math.max(verifiedPayments - SHARE_CAPITAL_CAP, 0);
    const remaining = Math.max(member.requiredShareCapital - shareCapitalContribution, 0);

    // Status badges formula
    let badge = 'Outstanding Balance';
    if (remaining === 0) {
      badge = 'Fully Paid';
    } else if (shareCapitalContribution > 0) {
      badge = 'Partially Paid';
    }

    return {
      totalContribution: shareCapitalContribution,
      savingsBalance,
      remainingBalance: remaining,
      badge
    };
  };

  // Co-op total indicators - each member's payments are capped before
  // summing, so these reflect actual share capital, not savings.
  const memberBalanceTotals = members.reduce((acc, m) => {
    const { totalContribution, savingsBalance } = getMemberBalances(m);
    acc.contribution += totalContribution;
    acc.savings += savingsBalance;
    return acc;
  }, { contribution: 0, savings: 0 });
  const totalVerifiedContributionsSum = memberBalanceTotals.contribution;
  const totalMemberSavingsSum = memberBalanceTotals.savings;

  const totalRequiredCapitalGlobally = members.reduce((sum, m) => sum + m.requiredShareCapital, 0);
  const outstandingCooperativeBalance = Math.max(totalRequiredCapitalGlobally - totalVerifiedContributionsSum, 0);

  const handlePostMemberSubmit = async (e) => {
    e.preventDefault();
    if (!newMemberName || !newMemberEmail) {
      onToast('Please fill out essential name and details.', 'error');
      return;
    }
    if (requiredCapital < MIN_SHARE_CAPITAL || requiredCapital > MAX_SHARE_CAPITAL) {
      onToast(`Required share capital must be between ₱${MIN_SHARE_CAPITAL.toLocaleString()} and ₱${MAX_SHARE_CAPITAL.toLocaleString()}.`, 'error');
      return;
    }

    setSubmittingMember(true);
    try {
      await onAddMember({ name: newMemberName, email: newMemberEmail, requiredShareCapital: requiredCapital });
      setNewMemberName('');
      setNewMemberEmail('');
      setRequiredCapital(10000);
      setIsAddingMember(false);
    } finally {
      setSubmittingMember(false);
    }
  };

  const handlePostLedgerSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMemberId) {
      onToast('You must select a registered shareholder member profile.', 'error');
      return;
    }
    if (paymentAmount <= 0) {
      onToast('Payment amount must be greater than zero.', 'error');
      return;
    }
    if (paymentMethod !== 'Over-the-Counter' && !txnRef) {
      onToast('A payment reference code or deposit ID is strictly required.', 'error');
      return;
    }

    setSubmittingPayment(true);
    try {
      await onAddLedgerEntry({
        memberId: selectedMemberId,
        amount: paymentAmount,
        referenceId: paymentMethod === 'Over-the-Counter' ? null : txnRef,
        paymentMethod,
      });
      setSelectedMemberId('');
      setPaymentAmount(1000);
      setTxnRef('');
      setIsPostingPayment(false);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleVerifyEntry = async (entry) => {
    setVerifyingId(entry.id);
    try {
      await onVerifyLedgerEntry(entry.id);
      if (viewedTxn && viewedTxn.id === entry.id) {
        setViewedTxn({ ...viewedTxn, status: 'Verified' });
      }
    } finally {
      setVerifyingId(null);
    }
  };

  const handleConfirmSend = async (e) => {
    e.preventDefault();
    const amount = Number(sentAmount);
    if (!amount || amount <= 0) {
      onToast('Please enter a valid sent amount.', 'error');
      return;
    }
    setSubmittingSend(true);
    try {
      await onSendWithdrawal(sendingWithdrawal.id, { sentAmount: amount, reference: sentReference });
      setSendingWithdrawal(null);
      setSentAmount('');
      setSentReference('');
    } finally {
      setSubmittingSend(false);
    }
  };

  const handleRejectWithdrawal = async (withdrawal) => {
    if (!window.confirm(`Reject the withdrawal request from ${withdrawal.memberName}?`)) return;
    setRejectingId(withdrawal.id);
    try {
      await onRejectWithdrawal(withdrawal.id);
    } finally {
      setRejectingId(null);
    }
  };

  const csvCell = (value) => {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const exportLedgerToCSV = () => {
    const header = ['Transaction ID', 'OR Number', 'Member', 'Member ID', 'Payment Method', 'Payment Date', 'Amount', 'Reference ID', 'Status', 'Entered By', 'Verified By', 'Verified At'];
    const rows = ledger.map(entry => [
      entry.id, entry.orNumber || '', entry.memberName, entry.memberId, entry.paymentMethod,
      formatDate(entry.paymentDate), entry.amount, entry.referenceId,
      entry.status, entry.enteredByName || '', entry.status === 'Verified' ? entry.verifiedByName || '' : '',
      entry.status === 'Verified' ? formatDate(entry.verifiedAt) : '',
    ]);
    const csv = [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
    downloadFile(`bocofac-share-capital-ledger-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
    onToast('Ledger report downloaded.', 'success');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Visual Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="space-y-1 text-left">
          <p className="text-xs font-mono uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold">FINANCIAL INTEGRITY BOARD</p>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Share Capital ledger</h2>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border">
          <button 
            onClick={() => setActiveLedgerTab('members')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              activeLedgerTab === 'members' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            Registered Shareholders
          </button>
          <button 
            onClick={() => setActiveLedgerTab('transactions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              activeLedgerTab === 'transactions' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            GAAP Ledger Books
          </button>
          <button
            onClick={() => setActiveLedgerTab('withdrawals')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
              activeLedgerTab === 'withdrawals' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            Earnings Withdrawals
          </button>
        </div>
      </div>

      {/* High-Contrast Visual Balance Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-6 border-l-4 border-emerald-600 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Share Contribution</p>
          <p className="text-3xl font-extrabold text-slate-950 dark:text-white mt-1">
            ₱{totalVerifiedContributionsSum.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 mt-2">Cumulative verified payments registered</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-6 border-l-4 border-sky-500 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Member Savings</p>
          <p className="text-3xl font-extrabold text-slate-950 dark:text-white mt-1">
            ₱{totalMemberSavingsSum.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 mt-2">Verified payments past the ₱{SHARE_CAPITAL_CAP.toLocaleString()} share capital cap</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-6 border-l-4 border-amber-500 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Oustanding Balance</p>
          <p className="text-3xl font-extrabold text-slate-950 dark:text-white mt-1">
            ₱{outstandingCooperativeBalance.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 mt-2">Remaining needed required capital</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-6 border-l-4 border-slate-700 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Accredited Shareholders</p>
          <p className="text-3xl font-extrabold text-slate-950 dark:text-white mt-1">
            {members.length} Active
          </p>
          <p className="text-[10px] text-slate-400 mt-2">Farmers registered with structural votes</p>
        </div>
      </div>

      {/* MEMBERS TAB */}
      {activeLedgerTab === 'members' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main List */}
          <div className={`${canManage ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm p-6 space-y-4 text-left`}>
            <div className="flex justify-between items-center sm:pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
                  Dynamic Capital balance Sheets
                </h3>
                <p className="text-[10px] text-slate-500">Formulas bind: Required Share Capital - Total Contribution = Remaining Balance.</p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsAddingMember(true)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> File Shareholder
                  </button>
                </div>
              )}
            </div>

            <MobileScrollHint />
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="sticky top-0 z-10 bg-[#fdfbf6] dark:bg-slate-950 text-slate-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">Shareholder Details</th>
                    <th className="p-3 font-mono text-right">Required Share</th>
                    <th className="p-3 font-mono text-right">Contributed</th>
                    <th className="p-3 font-mono text-right">Savings</th>
                    <th className="p-3 font-mono text-right">Remaining Balance</th>
                    <th className="p-3 font-mono text-right">Monthly Earning (10%)</th>
                    <th className="p-3 text-center">Receipt Badge</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                  {members.map(member => {
                    const { totalContribution, savingsBalance, remainingBalance, badge } = getMemberBalances(member);
                    return (
                      <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="p-3">
                          <p className="font-bold text-slate-950 dark:text-white">{member.name}</p>
                          <p className="text-[10px] text-slate-400">ID: {member.id} | Joined: {formatDate(member.joinedDate)}</p>
                        </td>
                        <td className="p-3 font-mono text-right">₱{member.requiredShareCapital.toLocaleString()}</td>
                        <td className="p-3 font-mono text-right text-emerald-700 dark:text-emerald-400 font-semibold">₱{totalContribution.toLocaleString()}</td>
                        <td className="p-3 font-mono text-right text-sky-700 dark:text-sky-400 font-semibold">{savingsBalance > 0 ? `₱${savingsBalance.toLocaleString()}` : '—'}</td>
                        <td className="p-3 font-mono text-right font-bold text-slate-800 dark:text-slate-300">₱{remainingBalance.toLocaleString()}</td>
                        <td className="p-3 font-mono text-right font-semibold text-emerald-700 dark:text-emerald-400">
                          {badge === 'Fully Paid' ? `₱${(totalContribution * 0.10).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-[9px] font-bold uppercase ${
                            badge === 'Fully Paid' ? 'text-emerald-700 dark:text-emerald-400' :
                            badge === 'Partially Paid' ? 'text-amber-700 dark:text-amber-400' :
                            'text-rose-700 dark:text-rose-400'
                          }`}>
                            {badge}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => { setEditingSheet(false); setViewedMember(member); }}
                            aria-label="View member"
                            title="View member"
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer ml-auto"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right side form drawer to Add Payment - board members can view/verify but not post entries (backend restricts POST /members and /ledger to admin) */}
          {canManage && (
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-8 text-left">
            
            {/* Direct Ledger Posting Card */}
            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm p-6 space-y-4">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-800" />
                Manual Payment for Share Capitals
              </h4>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Manually record digital transactions into the cooperative central share ledger. Posted as Pending - it will not count toward the shareholder's balance until a different admin or board member verifies it in the GAAP Ledger Books tab below.
              </p>

              <form onSubmit={handlePostLedgerSubmit} className="space-y-4 pt-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Target Shareholder</label>
                  <select
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950"
                  >
                    <option value="">-- Choose Member --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950 focus:outline-none"
                    >
                      <option value="GCash">GCash</option>
                      <option value="Over-the-Counter">Over-the-Counter</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Payment Amount</label>
                    <input
                      type="number"
                      required
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950"
                    />
                  </div>
                </div>

                {paymentMethod !== 'Over-the-Counter' && (
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Reference ID / Verification Code</label>
                    <input
                      type="text"
                      required
                      value={txnRef}
                      onChange={(e) => setTxnRef(e.target.value)}
                      placeholder="e.g. GCash Ref 88291..."
                      className="w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="w-full py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-xs transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submittingPayment ? 'Submitting…' : 'Submit Manual Payment'}
                </button>
              </form>
            </div>

            {/* Regulatory guideline boards info */}
            <div className="p-4 bg-slate-100 dark:bg-slate-900 border text-slate-500 rounded-xl text-xs space-y-2">
              <div className="flex gap-2 font-semibold text-slate-800 dark:text-slate-300">
                <Info className="w-4 h-4 text-emerald-800" /> Administrative audits
              </div>
              <p className="text-[11px] leading-relaxed">
                By cooperative principles, share capital remains locked with membership duration and collects annual dividends based on co-op net surplus performance matrices.
              </p>
            </div>

          </div>
          )}

        </div>
      )}

      {/* TRANSACTIONS GAAP LEDGER HISTORY TAB */}
      {activeLedgerTab === 'transactions' && (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm p-6 text-left space-y-4">
          <div className="flex justify-between items-center pb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4.5 h-4.5 text-emerald-800" />
                Cooperative General ledger Books (GAAP)
              </h3>
              <p className="text-[10px] text-slate-500">Historical archive of share payments verified by the board audit. Exportable to CSV standard.</p>
            </div>
            <button 
              onClick={exportLedgerToCSV}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border dark:bg-slate-950 dark:text-slate-300 cursor-pointer flex items-center gap-1"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" /> Export ledger report
            </button>
          </div>

          <MobileScrollHint />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="sticky top-0 z-10 bg-[#fdfbf6] dark:bg-slate-950 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3">Reference TxnID</th>
                  <th className="p-3 font-semibold">Shareholder</th>
                  <th className="p-3">Method/Gateway</th>
                  <th className="p-3">Deposit Date</th>
                  <th className="p-3 font-mono text-right">Contribution Amount</th>
                  <th className="p-3 text-center">Audit Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                {ledger.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="p-3">
                      <p className="font-bold text-[#d97706] font-mono">{entry.id}</p>
                      <p className="text-[10px] text-slate-400 font-mono">Ref RefID: {entry.referenceId}</p>
                      {entry.enteredByName && (
                        <p className="text-[10px] text-slate-400">Entered by: {entry.enteredByName}</p>
                      )}
                    </td>
                    <td className="p-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{entry.memberName}</p>
                      <p className="text-[10px] text-slate-400">ID: {entry.memberId}</p>
                    </td>
                    <td className="p-3 font-medium text-slate-500">{entry.paymentMethod}</td>
                    <td className="p-3 text-slate-500">{formatDate(entry.paymentDate)}</td>
                    <td className="p-3 font-mono text-right text-emerald-800 dark:text-emerald-400 font-extrabold text-sm">
                      ₱{entry.amount.toLocaleString()}
                    </td>
                    <td className="p-3 text-center text-[10px] font-mono text-slate-400">
                      {entry.status === 'Verified'
                        ? `Verified: ${formatDate(entry.verifiedAt)}`
                        : <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-800">Pending</span>}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {entry.status !== 'Verified' && (
                          entry.enteredBy === currentUserId ? (
                            <span
                              title="You logged this entry - a different admin or board member must verify it"
                              className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800 text-[10px] font-bold uppercase"
                            >
                              Awaiting other verifier
                            </span>
                          ) : (
                            <button
                              onClick={() => handleVerifyEntry(entry)}
                              disabled={verifyingId === entry.id}
                              title="Confirm this GCash/bank reference is legitimate before it counts toward the shareholder's balance"
                              className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-[10px] font-bold uppercase cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {verifyingId === entry.id ? 'Verifying…' : 'Verify'}
                            </button>
                          )
                        )}
                        {entry.status === 'Verified' && (
                          <button
                            onClick={() => printOfficialReceipt(entry)}
                            title="Print Official Receipt"
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setViewedTxn(entry)}
                          title="View transaction reference"
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EARNINGS WITHDRAWALS TAB */}
      {activeLedgerTab === 'withdrawals' && (
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm p-6 text-left space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
              Member Earnings Withdrawal Requests
            </h3>
            <p className="text-[10px] text-slate-500">Members cash out their accrued 10% monthly earnings here - send the money outside the system, then record it below.</p>
          </div>

          <MobileScrollHint />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="sticky top-0 z-10 bg-[#fdfbf6] dark:bg-slate-950 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3">Request ID</th>
                  <th className="p-3">Shareholder</th>
                  <th className="p-3 font-mono text-right">Requested</th>
                  <th className="p-3">Requested On</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                {withdrawals.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-400">No withdrawal requests yet.</td></tr>
                )}
                {withdrawals.map(w => (
                  <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="p-3 font-bold text-[#d97706] font-mono">{w.id}</td>
                    <td className="p-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{w.memberName}</p>
                      <p className="text-[10px] text-slate-400">ID: {w.memberId}</p>
                    </td>
                    <td className="p-3 font-mono text-right text-emerald-800 dark:text-emerald-400 font-extrabold text-sm">
                      ₱{w.requestedAmount.toLocaleString()}
                    </td>
                    <td className="p-3 text-slate-500">{formatDate(w.requestedAt)}</td>
                    <td className="p-3 text-center">
                      {w.status === 'Sent' ? (
                        <div>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800">Sent</span>
                          <p className="text-[10px] text-slate-400 mt-1">₱{w.sentAmount.toLocaleString()}{w.sentReference ? ` · Ref: ${w.sentReference}` : ''}</p>
                        </div>
                      ) : w.status === 'Rejected' ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-rose-100 text-rose-800">Rejected</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-800">Pending</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {w.status === 'Pending' && canManage && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setSendingWithdrawal(w); setSentAmount(String(w.requestedAmount)); setSentReference(''); }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-[10px] font-bold uppercase cursor-pointer"
                          >
                            Send
                          </button>
                          <button
                            onClick={() => handleRejectWithdrawal(w)}
                            disabled={rejectingId === w.id}
                            className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 hover:bg-rose-200 text-[10px] font-bold uppercase cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {rejectingId === w.id ? 'Rejecting…' : 'Reject'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm Send modal for an earnings withdrawal request */}
      {sendingWithdrawal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmSend}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 text-left relative animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-start border-b pb-3">
              <h3 className="font-bold text-slate-950 dark:text-white">Send Withdrawal - {sendingWithdrawal.id}</h3>
              <button type="button" onClick={() => setSendingWithdrawal(null)} className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1">Close</button>
            </div>
            <p className="text-xs text-slate-500">
              {sendingWithdrawal.memberName} requested ₱{sendingWithdrawal.requestedAmount.toLocaleString()}. Confirm the amount actually sent (GCash/bank) and its reference.
            </p>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Amount Sent (₱)</label>
              <input
                type="number"
                required
                value={sentAmount}
                onChange={(e) => setSentAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Reference ID</label>
              <input
                type="text"
                value={sentReference}
                onChange={(e) => setSentReference(e.target.value)}
                placeholder="e.g. GCash Ref 88291..."
                className="w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <button type="button" onClick={() => setSendingWithdrawal(null)} className="px-4 py-2 rounded-xl border text-xs cursor-pointer">Cancel</button>
              <button
                type="submit"
                disabled={submittingSend}
                className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submittingSend ? 'Recording…' : 'Confirm Sent'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Model Dialog popup for registering shareholder directly */}
      {isAddingMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form 
            onSubmit={handlePostMemberSubmit} 
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-5 text-left relative animate-in zoom-in-95 duration-200 animate-out"
          >
            <div className="flex justify-between items-start border-b pb-3">
              <h3 className="font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                <Building2 className="w-5 h-5 text-emerald-800" />
                Register Shareholder profile
              </h3>
              <button 
                type="button" 
                onClick={() => setIsAddingMember(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Full Representative name</label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g. Danilo S. Santos"
                  className="w-full px-4 text-sm py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Active Email Address</label>
                <input
                  type="email"
                  required
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="danilo.santos@gmail.com"
                  className="w-full px-4 text-sm py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Required Share Capital Target</label>
                <input
                  type="number"
                  step="1000"
                  min={MIN_SHARE_CAPITAL}
                  max={MAX_SHARE_CAPITAL}
                  required
                  value={requiredCapital}
                  onChange={(e) => setRequiredCapital(Number(e.target.value))}
                  placeholder="10000"
                  className="w-full px-4 text-sm py-2 rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-400 pt-1">
                  Must be between ₱{MIN_SHARE_CAPITAL.toLocaleString()} and ₱{MAX_SHARE_CAPITAL.toLocaleString()}. Verified payments beyond
                  ₱{SHARE_CAPITAL_CAP.toLocaleString()} count as the member's savings instead of more share capital.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setIsAddingMember(false)}
                className="px-4 py-2 rounded-xl border text-xs cursor-pointer hover:bg-slate-150"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingMember}
                className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submittingMember ? 'Filing…' : 'Assemble Shareholder Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View Shareholder details drawer - mirrors the paper "Member's
          Information Sheet" (BOCOFAC ID, NCFRS/RSBSA IDs, membership fee
          filing, attached copies checklist, farm profile, civic org
          affiliation, and the Date/Reference/Share Capital ledger table) */}
      {viewedMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 space-y-5 text-left relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                  <Building2 className="w-5 h-5 text-emerald-800" />
                  {viewedMember.name}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">BOCOFAC ID No.: {viewedMember.id} | {viewedMember.email}</p>
              </div>
              <div className="flex items-center gap-1">
                {canManage && !editingSheet && (
                  <button
                    type="button"
                    onClick={() => startEditingSheet(viewedMember)}
                    title="Edit information sheet"
                    className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setViewedMember(null); setEditingSheet(false); }}
                  aria-label="Close"
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {(() => {
              const { totalContribution, savingsBalance, remainingBalance, badge } = getMemberBalances(viewedMember);
              const memberTxns = ledger
                .filter(l => l.memberId === viewedMember.id)
                .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                      <p className="text-[9px] uppercase font-bold text-slate-400">Required</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-white text-sm">₱{viewedMember.requiredShareCapital.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                      <p className="text-[9px] uppercase font-bold text-slate-400">Contributed</p>
                      <p className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">₱{totalContribution.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                      <p className="text-[9px] uppercase font-bold text-slate-400">Remaining</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-white text-sm">₱{remainingBalance.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                      <p className="text-[9px] uppercase font-bold text-slate-400">Savings</p>
                      <p className="font-mono font-bold text-sky-700 dark:text-sky-400 text-sm">₱{savingsBalance.toLocaleString()}</p>
                    </div>
                  </div>

                  {badge === 'Fully Paid' && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 flex items-center justify-between">
                      <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Monthly Earning (10%)</p>
                      <p className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">₱{(totalContribution * 0.10).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Joined: {formatDate(viewedMember.joinedDate)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      badge === 'Fully Paid' ? 'bg-emerald-100 text-emerald-800' :
                      badge === 'Partially Paid' ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {badge}
                    </span>
                  </div>

                  {/* Member's Information Sheet - editable fields */}
                  {editingSheet ? (
                    <form onSubmit={handleSheetSubmit} className="space-y-4 border-t pt-4">
                      <h4 className="text-[10px] uppercase font-bold text-slate-400">Member's Information Sheet</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                            Required Share Capital (₱{MIN_SHARE_CAPITAL.toLocaleString()}–₱{MAX_SHARE_CAPITAL.toLocaleString()})
                          </label>
                          <input
                            type="number"
                            min={MIN_SHARE_CAPITAL}
                            max={MAX_SHARE_CAPITAL}
                            step={500}
                            value={sheetForm.requiredShareCapital}
                            onChange={(e) => setSheetForm(f => ({ ...f, requiredShareCapital: e.target.value }))}
                            className="w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Address</label>
                          <input type="text" value={sheetForm.address} onChange={(e) => setSheetForm(f => ({ ...f, address: e.target.value }))} className="w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Mobile Number</label>
                          <input type="text" value={sheetForm.mobileNumber} onChange={(e) => setSheetForm(f => ({ ...f, mobileNumber: e.target.value }))} placeholder="09171234567" className="w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">NCFRS ID No.</label>
                          <input type="text" value={sheetForm.ncfrsId} onChange={(e) => setSheetForm(f => ({ ...f, ncfrsId: e.target.value }))} className="w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">RSBSA ID No.</label>
                          <input type="text" value={sheetForm.rsbsaId} onChange={(e) => setSheetForm(f => ({ ...f, rsbsaId: e.target.value }))} className="w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Civic Org. Affiliation</label>
                          <input type="text" value={sheetForm.civicOrgAffiliation} onChange={(e) => setSheetForm(f => ({ ...f, civicOrgAffiliation: e.target.value }))} className="w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Membership Fee (₱)</label>
                          <input type="number" step="1" value={sheetForm.membershipFee} onChange={(e) => setSheetForm(f => ({ ...f, membershipFee: e.target.value }))} className="w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Date Paid</label>
                          <input type="date" value={sheetForm.membershipFeeDatePaid} onChange={(e) => setSheetForm(f => ({ ...f, membershipFeeDatePaid: e.target.value }))} className="w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Reference</label>
                          <input type="text" placeholder="e.g. OR# 0088" value={sheetForm.membershipFeeReference} onChange={(e) => setSheetForm(f => ({ ...f, membershipFeeReference: e.target.value }))} className="w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Attached Copy (if any)</label>
                        <div className="flex flex-wrap gap-4">
                          {[['hasCv', 'CV'], ['hasFarmPhoto', 'Farm Photo'], ['hasShareCert', 'Share Cert.']].map(([key, label]) => (
                            <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                              <input type="checkbox" checked={sheetForm[key]} onChange={(e) => setSheetForm(f => ({ ...f, [key]: e.target.checked }))} className="cursor-pointer" />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Farm Profile (additional notes)</label>
                        <textarea rows={3} value={sheetForm.farmProfileNotes} onChange={(e) => setSheetForm(f => ({ ...f, farmProfileNotes: e.target.value }))} className="w-full px-3 py-2 text-xs rounded-xl border bg-white dark:bg-slate-950" />
                      </div>

                      <div className="flex items-center justify-end gap-2 border-t pt-3">
                        <button type="button" onClick={() => setEditingSheet(false)} className="px-4 py-2 rounded-xl border text-xs cursor-pointer">Cancel</button>
                        <button
                          type="submit"
                          disabled={submittingSheet}
                          className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          <CheckIcon className="w-3.5 h-3.5" /> {submittingSheet ? 'Saving…' : 'Save Information Sheet'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="text-[10px] uppercase font-bold text-slate-400">Member's Information Sheet</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 sm:col-span-2">
                          <p className="text-[9px] uppercase font-bold text-slate-400">Address</p>
                          <p className="text-slate-800 dark:text-slate-200">{viewedMember.address || '—'}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                          <p className="text-[9px] uppercase font-bold text-slate-400">Mobile Number</p>
                          <p className="text-slate-800 dark:text-slate-200">{viewedMember.mobileNumber || '—'}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                          <p className="text-[9px] uppercase font-bold text-slate-400">NCFRS ID No.</p>
                          <p className="text-slate-800 dark:text-slate-200">{viewedMember.ncfrsId || '—'}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                          <p className="text-[9px] uppercase font-bold text-slate-400">RSBSA ID No.</p>
                          <p className="text-slate-800 dark:text-slate-200">{viewedMember.rsbsaId || '—'}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                          <p className="text-[9px] uppercase font-bold text-slate-400">Civic Org. Affiliation</p>
                          <p className="text-slate-800 dark:text-slate-200">{viewedMember.civicOrgAffiliation || '—'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                          <p className="text-[9px] uppercase font-bold text-slate-400">Membership Fee</p>
                          <p className="font-mono text-slate-800 dark:text-slate-200">{viewedMember.membershipFee != null ? `₱${Number(viewedMember.membershipFee).toLocaleString()}` : '—'}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                          <p className="text-[9px] uppercase font-bold text-slate-400">Date Paid</p>
                          <p className="text-slate-800 dark:text-slate-200">{viewedMember.membershipFeeDatePaid ? formatDate(viewedMember.membershipFeeDatePaid) : '—'}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                          <p className="text-[9px] uppercase font-bold text-slate-400">Reference</p>
                          <p className="text-slate-800 dark:text-slate-200">{viewedMember.membershipFeeReference || '—'}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[9px] uppercase font-bold text-slate-400 mb-1.5">Attached Copy (if any)</p>
                        <div className="flex flex-wrap gap-4 text-xs">
                          {[['hasCv', 'CV'], ['hasFarmPhoto', 'Farm Photo'], ['hasShareCert', 'Share Cert.']].map(([key, label]) => (
                            <span key={key} className={`flex items-center gap-1.5 ${viewedMember[key] ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                              {viewedMember[key] ? <CheckIcon className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />} {label}
                            </span>
                          ))}
                        </div>
                      </div>

                      {viewedMember.farmProfileNotes && (
                        <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3 text-xs">
                          <p className="text-[9px] uppercase font-bold text-slate-400">Farm Profile</p>
                          <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{viewedMember.farmProfileNotes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-2">Share Capital (Payment History)</h4>
                    {memberTxns.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No payments recorded for this shareholder yet.</p>
                    ) : (
                      <>
                        <MobileScrollHint />
                        <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-xl border">
                        <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
                          <thead className="sticky top-0 bg-[#fdfbf6] dark:bg-slate-950 text-slate-500 uppercase text-[9px] font-bold">
                            <tr>
                              <th className="p-2.5">Date</th>
                              <th className="p-2.5">Reference</th>
                              <th className="p-2.5 text-right">Share Capital</th>
                              <th className="p-2.5 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                            {memberTxns.map(txn => (
                              <tr key={txn.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                                <td className="p-2.5 text-slate-600 dark:text-slate-300">{formatDate(txn.paymentDate)}</td>
                                <td className="p-2.5">
                                  <p className="font-mono text-slate-800 dark:text-slate-200">{txn.referenceId}</p>
                                  <p className="text-[9px] text-slate-400">{txn.id} · {txn.paymentMethod}</p>
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">₱{txn.amount.toLocaleString()}</td>
                                <td className="p-2.5 text-center">
                                  <span className={`text-[9px] font-bold uppercase ${txn.status === 'Verified' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {txn.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* View transaction reference drawer */}
      {viewedTxn && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-5 text-left relative animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                  <BookOpen className="w-5 h-5 text-emerald-800" />
                  {viewedTxn.id}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">{viewedTxn.memberName} · ID: {viewedTxn.memberId}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewedTxn(null)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                <p className="text-[9px] uppercase font-bold text-slate-400">Amount</p>
                <p className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">₱{viewedTxn.amount.toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                <p className="text-[9px] uppercase font-bold text-slate-400">Deposit Date</p>
                <p className="font-semibold text-slate-900 dark:text-white">{formatDate(viewedTxn.paymentDate)}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                <p className="text-[9px] uppercase font-bold text-slate-400">Method/Gateway</p>
                <p className="font-semibold text-slate-900 dark:text-white">{viewedTxn.paymentMethod}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                <p className="text-[9px] uppercase font-bold text-slate-400">Reference ID</p>
                <p className="font-mono font-semibold text-slate-900 dark:text-white break-all">{viewedTxn.referenceId || '—'}</p>
              </div>
              {viewedTxn.enteredByName && (
                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                  <p className="text-[9px] uppercase font-bold text-slate-400">Entered By</p>
                  <p className="font-semibold text-slate-900 dark:text-white">{viewedTxn.enteredByName}</p>
                </div>
              )}
              {viewedTxn.orNumber && (
                <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3">
                  <p className="text-[9px] uppercase font-bold text-slate-400">OR Number</p>
                  <p className="font-mono font-semibold text-slate-900 dark:text-white">{viewedTxn.orNumber}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500">
                {viewedTxn.status === 'Verified' ? `Recorded: ${formatDate(viewedTxn.verifiedAt)}` : 'Awaiting verification of the GCash/bank reference'}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                viewedTxn.status === 'Verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {viewedTxn.status}
              </span>
            </div>

            {viewedTxn.status === 'Verified' ? (
              <button
                onClick={() => printOfficialReceipt(viewedTxn)}
                className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print Official Receipt
              </button>
            ) : viewedTxn.enteredBy === currentUserId ? (
              <p className="text-center text-xs text-slate-400 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-950">
                You logged this entry - a different admin or board member must verify it.
              </p>
            ) : (
              <button
                onClick={() => handleVerifyEntry(viewedTxn)}
                disabled={verifyingId === viewedTxn.id}
                className="w-full py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-xs transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {verifyingId === viewedTxn.id ? 'Verifying…' : 'Confirm Reference & Verify Payment'}
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
