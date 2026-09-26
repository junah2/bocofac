// src/pages/DashboardPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, Lock, BadgeCheck, ShieldCheck, Hash, Calendar, ShoppingBag, User,
  HelpCircle, ChevronDown, Phone, Mail, MapPin, Printer, AlertTriangle, Check,
} from 'lucide-react';
import { GreenBtn, FormInput } from '../components/UI';
import { printStatementOfAccount, printOfficialReceipt } from '../utils/printDocument';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import { getPmesDisplayStatus } from '../utils/pmesStatus';
import { displayApplicantStatus } from '../utils/applicantStatus';
import { isValidPhone11, isValidGcashRef13, digitsOnly } from '../utils/validators';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

// Mirrors backend/src/utils/shareCapital.js - the "Target Amount" tile shows
// this fixed range rather than the member's own requiredShareCapital number,
// per how the cooperative wants it presented on the customer-facing page.
const MIN_REQUIRED_SHARE_CAPITAL = 4000;
const MAX_REQUIRED_SHARE_CAPITAL = 25000;

// Cancellation window matches the backend's own 24-hour cutoff (orders.routes.js).
const CANCELLABLE_WINDOW_MS = 24 * 60 * 60 * 1000;
function canStillCancel(order) {
  return order.status === 'Pending Verification' && (Date.now() - new Date(order.orderedAt).getTime()) <= CANCELLABLE_WINDOW_MS;
}

// Answers reflect this app's actual behavior (24h cancel window above,
// the real membership/verification flow) rather than generic boilerplate,
// so nothing here promises something the system doesn't actually do.
const FAQ_ITEMS = [
  {
    q: 'How do I become a cooperative member?',
    a: 'Go to "Contribution" in your sidebar and apply for membership. The board reviews every application, and you\'ll see your status update here once a decision is made.',
  },
  {
    q: 'What are the requirements to apply for membership?',
    a: 'A valid ID and proof of the ₱300 one-time registration fee (GCash receipt or reference number) - both uploaded on the membership application form.',
  },
  {
    q: 'What is the PMES seminar, and do I need to attend it?',
    a: 'The Pre-Membership Education Seminar (PMES) is required for every applicant before the board can approve your membership. Reserve a slot from the schedule on the Membership page - once the board confirms your attendance, your certificate is emailed to you automatically.',
  },
  {
    q: 'How much is the membership fee, and what does it cover?',
    a: 'A one-time ₱300 registration fee, separate from your share capital contributions. Share capital is what you build up afterward as an approved member, tracked in your Contribution page.',
  },
  {
    q: 'What benefits do I get once approved?',
    a: 'A 10% discount automatically applied at checkout on every storefront order, 10% monthly earnings on your share capital (withdrawable from Contribution), one vote per member in cooperative decisions, and patronage refund dividends.',
  },
  {
    q: 'How do I check my membership application status?',
    a: 'Go to Membership > "Check Application Status" and enter the email address you applied with. Your status also appears right here on the Dashboard once you\'re signed in with that same account.',
  },
  {
    q: 'Can I cancel an order after placing it?',
    a: 'Yes, but only within 24 hours of ordering, and only while it still shows "Pending Verification" in My Orders. After that window, or once payment is verified, please contact the cooperative directly.',
  },
  {
    q: 'How is my payment verified?',
    a: 'Upload a screenshot of your GCash or bank transfer receipt at checkout. A cooperative admin manually matches it to your order, which usually takes 1-2 business hours.',
  },
  {
    q: 'How do I track my order status?',
    a: 'Open "My Orders" in your sidebar - each order shows its current status (Processing, Shipped, Out for Delivery, Delivered) as the cooperative updates it.',
  },
  {
    q: 'Who can see my payment receipt and account details?',
    a: 'Only cooperative admin and board staff, and only to verify your payment or manage your membership records - see the Privacy Policy below for details.',
  },
];

function ApplicationStatusPanel({ applicantStatus, setPage }) {
  if (!applicantStatus) {
    return (
      <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '28px' }}>
        <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Membership Status</h2>
        <div style={{
          background: 'var(--alert-amber-bg)', border: '1.5px solid var(--alert-amber-border)',
          borderRadius: 12, padding: '18px 22px', marginBottom: 22,
        }}>
          <p style={{ fontWeight: 600, color: 'var(--alert-amber-text)', marginBottom: 5 }}>No Active Membership</p>
          <p style={{ fontSize: 14, color: 'var(--alert-amber-text)' }}>
            Apply for membership to access exclusive cooperative benefits. You must attend a PMES seminar before
            you can apply - check the PMES Seminars tab for the next available date.
          </p>
        </div>
        <GreenBtn onClick={() => setPage('membership')}>
          Apply for Membership
        </GreenBtn>
      </div>
    );
  }

  if (applicantStatus.status === 'Rejected') {
    return (
      <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '28px' }}>
        <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Membership Status</h2>
        <div style={{
          background: 'var(--alert-rose-bg)', border: '1.5px solid var(--alert-rose-border)',
          borderRadius: 12, padding: '18px 22px', marginBottom: 22,
        }}>
          <p style={{ fontWeight: 600, color: 'var(--alert-rose-text)', marginBottom: 5 }}>Application Rejected</p>
          <p style={{ fontSize: 14, color: 'var(--alert-rose-text)' }}>
            Your membership application (Ref: {applicantStatus.referenceNumber || applicantStatus.id}) was not approved.
          </p>
          {applicantStatus.rejectionReason && (
            <p style={{ fontSize: 13, color: 'var(--alert-rose-text)', marginTop: 6 }}>
              Reason: {applicantStatus.rejectionReason}
            </p>
          )}
          {!applicantStatus.pmesAttended && (
            <p style={{ fontSize: 13, color: 'var(--alert-rose-text)', marginTop: 6 }}>
              You must attend a PMES seminar before you can apply again - check the PMES Seminars tab for the next
              available date.
            </p>
          )}
        </div>
        <GreenBtn
          disabled={!applicantStatus.pmesAttended}
          title={applicantStatus.pmesAttended ? undefined : 'Attend a PMES seminar first'}
          onClick={() => setPage('membership')}
        >
          Apply Again
        </GreenBtn>
      </div>
    );
  }

  if (applicantStatus.status === 'Approved') {
    // Approved as an applicant, but /members/me came back empty - the
    // application email doesn't match this account's email, so the board's
    // approval step had nothing to link to.
    return (
      <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '28px' }}>
        <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Membership Status</h2>
        <div style={{
          background: 'var(--alert-amber-bg)', border: '1.5px solid var(--alert-amber-border)',
          borderRadius: 12, padding: '18px 22px',
        }}>
          <p style={{ fontWeight: 600, color: 'var(--alert-amber-text)', marginBottom: 5 }}>Application Approved, Account Not Linked</p>
          <p style={{ fontSize: 14, color: 'var(--alert-amber-text)' }}>
            Your application was approved, but it doesn't match this account's email yet. Please contact the cooperative
            to link your membership, or make sure any new applications use this account's email address.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '28px' }}>
      <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Membership Status</h2>
      <div style={{
        background: 'var(--alert-amber-bg)', border: '1.5px solid var(--alert-amber-border)',
        borderRadius: 12, padding: '18px 22px',
      }}>
        <p style={{ fontWeight: 600, color: 'var(--alert-amber-text)', marginBottom: 5 }}>Application Under Review</p>
        <p style={{ fontSize: 14, color: 'var(--alert-amber-text)', marginBottom: 8 }}>
          Status: {displayApplicantStatus(applicantStatus.status)}
        </p>
        <p style={{ fontSize: 12, color: 'var(--alert-amber-text)' }}>
          Submitted {new Date(applicantStatus.submittedAt).toLocaleDateString()}
          {applicantStatus.referenceNumber ? ` · Ref: ${applicantStatus.referenceNumber}` : ''}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage({ user, setUser, setPage, pmesSessions = [], onPmesSessionsRefresh, focusTab, onFocusTabConsumed, onToast }) {
  const [activeTab, setActiveTab] = useState('membership');
  // Branded stand-in for window.confirm() (see AdminDashboardPage.jsx for
  // the same pattern) - a native confirm() dialog is titled by the raw host
  // ("localhost:3000 says"), which looks broken/unbranded to a customer.
  const [confirmPrompt, setConfirmPrompt] = useState(null);

  // A notification click (see Navbar.jsx) asks to land on a specific tab -
  // apply it once, then hand back control so the sidebar behaves normally.
  useEffect(() => {
    if (!focusTab) return;
    setActiveTab(focusTab);
    onFocusTabConsumed?.();
  }, [focusTab, onFocusTabConsumed]);

  // Real orders for the signed-in customer, tied to their account via the
  // session cookie (not the localStorage-only demo orders used elsewhere).
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  const totalOrders = orders.length;
  const pending = orders.filter(o => o.status === 'Pending Verification').length;
  const complete = orders.filter(o => o.status === 'Delivered' || o.status === 'Completed').length;

  // Real membership + share-capital data for the signed-in customer.
  const [membership, setMembership] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loadingMembership, setLoadingMembership] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentMethod: 'GCash', referenceId: '' });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Accrued 10% monthly earnings + the member's own withdrawal request history.
  const [withdrawalData, setWithdrawalData] = useState({ availableBalance: 0, requests: [] });
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

  // Profile editing
  const [profileDraft, setProfileDraft] = useState({
    name: user?.name || '', email: user?.email || '', phone: user?.phone || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  // Change password (Settings tab) - separate from the "forgot password"
  // email-link flow, since this one already knows who's asking and just
  // needs to confirm they still know the current password.
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  // Help Center FAQ accordion + Privacy Policy - both collapsed by default
  // so the Profile page doesn't turn into a wall of text.
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // let picking the same file again re-trigger onChange
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await fetch(`${API_BASE}/auth/me/avatar`, {
        method: 'PATCH',
        credentials: 'include',
        body: formData,
      });   
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update profile photo.');
      setUser(data);
    } catch (err) {
      onToast?.(err.message || 'Failed to update profile photo.', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // The customer's membership *application* (if any) - looked up by their
  // account email, same public endpoint MembershipPortal uses. Lets the
  // dashboard show real application progress (pending/rejected) instead of
  // a flat "No Active Membership" box for anyone who has already applied.
  const [applicantStatus, setApplicantStatus] = useState(null);

  const loadMembershipData = async () => {
    try {
      const [memberRes, ledgerRes, applicantRes, withdrawalRes] = await Promise.all([
        fetch(`${API_BASE}/members/me`, { credentials: 'include' }),
        fetch(`${API_BASE}/ledger/mine`, { credentials: 'include' }),
        user?.email
          ? fetch(`${API_BASE}/applicants/by-email/${encodeURIComponent(user.email)}`, { credentials: 'include' })
          : Promise.resolve(null),
        fetch(`${API_BASE}/withdrawals/mine`, { credentials: 'include' }),
      ]);
      const memberData = memberRes.ok ? await memberRes.json() : { member: null };
      const ledgerData = ledgerRes.ok ? await ledgerRes.json() : [];
      setMembership(memberData);
      setLedgerEntries(ledgerData);
      setApplicantStatus(applicantRes && applicantRes.ok ? await applicantRes.json() : null);
      setWithdrawalData(withdrawalRes.ok ? await withdrawalRes.json() : { availableBalance: 0, requests: [] });
    } catch {
      setMembership({ member: null });
      setApplicantStatus(null);
    } finally {
      setLoadingMembership(false);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await fetch(`${API_BASE}/orders/me`, { credentials: 'include' });
      setOrders(res.ok ? await res.json() : []);
    } catch {
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadMembershipData();
    loadOrders();

    // Keep polling while the customer sits on this page, so a payment (or
    // membership application) that admin/board approves or rejects while
    // they're looking shows up without them having to manually refresh.
    const interval = setInterval(() => {
      loadMembershipData();
      loadOrders();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const [cancellingId, setCancellingId] = useState(null);
  const handleCancelOrder = (orderId) => {
    setConfirmPrompt({
      tone: 'danger',
      title: 'Cancel this order?',
      message: 'This cannot be undone.',
      confirmLabel: 'Cancel Order',
      onConfirm: async () => {
        setCancellingId(orderId);
        try {
          const res = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
            method: 'PATCH',
            credentials: 'include',
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Failed to cancel order.');
          setOrders(prev => prev.map(o => (o.id === orderId ? data : o)));
        } catch (err) {
          onToast?.(err.message || 'Failed to cancel order.', 'error');
        } finally {
          setCancellingId(null);
        }
      },
    });
  };

  // Signed-in customers used to have no way to see/reserve PMES seminars
  // once they were an approved member (MembershipPortal replaces its whole
  // view with a "you're already a member" card) - this works for anyone
  // signed in regardless of where they are in the pipeline: an approved
  // member registers by memberId, an in-progress applicant by
  // applicantId+email (same as MembershipPortal's own flow), and anyone with
  // neither yet (hasn't applied at all) self-registers by their own account.
  const [registeringSessionId, setRegisteringSessionId] = useState(null);
  // Which session (if any) this account already reserved a slot for - shown
  // persistently on the matching card so "did I already reserve?" doesn't
  // depend on remembering a one-time confirmation toast.
  const [myPmesRegistration, setMyPmesRegistration] = useState(null);
  const checkMyPmesRegistration = async () => {
    if (!user?.email) return;
    try {
      const res = await fetch(`${API_BASE}/pmes-sessions/my-registration/${encodeURIComponent(user.email)}`);
      const data = res.ok ? await res.json() : { registered: false };
      setMyPmesRegistration(data.registered ? data : null);
    } catch {
      // Best-effort - just means the persistent reminder won't show.
    }
  };
  useEffect(() => { checkMyPmesRegistration(); }, [user?.email]);
  // Full sessions stay visible (with a disabled "Full" button) rather than
  // vanishing from the list, so a member can see a session exists without
  // wondering where it went - the backend independently rejects any
  // over-capacity registration attempt regardless of this UI state.
  const upcomingPmesSessions = pmesSessions.filter(
    s => getPmesDisplayStatus(s) === 'Upcoming'
  );
  const handleReservePmesSlot = async (session) => {
    // Signed-in on this page by definition, so there's always an account to
    // attach the reservation to even before an application exists - a
    // member registers by memberId, an in-progress applicant by
    // applicantId+email, and anyone with neither yet (hasn't applied at all)
    // still self-registers by their own account (backend fills that in from
    // the session), since PMES attendance has to happen before applying.
    const memberId = membership?.member?.id;
    setRegisteringSessionId(session.id);
    try {
      const res = await fetch(`${API_BASE}/pmes-sessions/${session.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          memberId
            ? { memberId }
            : applicantStatus
              ? { applicantId: applicantStatus.id, email: applicantStatus.email }
              : {}
        ),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to reserve a slot for this session.');
      }
      await onPmesSessionsRefresh?.();
      await checkMyPmesRegistration();
      onToast?.(`Slot reserved! See you on ${new Date(session.date).toLocaleDateString()} at ${session.venue || 'the announced venue'}.`, 'success');
    } catch (err) {
      onToast?.(err.message || 'Could not reserve a slot for this session.', 'error');
    } finally {
      setRegisteringSessionId(null);
    }
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    const amount = Number(paymentForm.amount);
    if (!amount || amount <= 0) {
      onToast?.('Please enter a valid payment amount.', 'error');
      return;
    }
    if (paymentForm.referenceId && !isValidGcashRef13(paymentForm.referenceId)) {
      onToast?.('Reference number must be exactly 13 digits.', 'error');
      return;
    }
    setSubmittingPayment(true);
    try {
      const res = await fetch(`${API_BASE}/ledger/mine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount,
          paymentMethod: paymentForm.paymentMethod,
          referenceId: paymentForm.referenceId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to submit payment.');
      setShowPaymentForm(false);
      setPaymentForm({ amount: '', paymentMethod: 'GCash', referenceId: '' });
      await loadMembershipData();
      onToast?.('Payment submitted! It will be added to your share capital contribution once the cooperative confirms your reference number.', 'success');
    } catch (err) {
      onToast?.(err.message || 'Failed to submit payment.', 'error');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleSubmitWithdrawal = async (e) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) {
      onToast?.('Please enter a valid amount.', 'error');
      return;
    }
    setSubmittingWithdrawal(true);
    try {
      const res = await fetch(`${API_BASE}/withdrawals/mine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to submit withdrawal request.');
      setShowWithdrawForm(false);
      setWithdrawAmount('');
      await loadMembershipData();
      onToast?.('Your withdrawal request has been submitted. Please visit our office to process your withdrawal.', 'success');
    } catch (err) {
      onToast?.(err.message || 'Failed to submit withdrawal request.', 'error');
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profileDraft.name || !profileDraft.email) {
      onToast?.('Name and email are required.', 'error');
      return;
    }
    if (profileDraft.phone && !isValidPhone11(profileDraft.phone)) {
      onToast?.('Contact number must be 11 digits starting with 09.', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(profileDraft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update profile.');
      setUser(data);
      setProfileDraft({ name: data.name, email: data.email, phone: data.phone || '' });
      onToast?.('Profile saved!', 'success');
    } catch (err) {
      onToast?.(err.message || 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword || !newPassword) {
      onToast?.('Please fill in your current and new password.', 'error');
      return;
    }
    if (newPassword.length < 8) {
      onToast?.('New password must be at least 8 characters.', 'error');
      return;
    }
    if (!/[A-Za-z]/.test(newPassword)) {
      onToast?.('New password must include at least one letter.', 'error');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      onToast?.('New password must include at least one number.', 'error');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      onToast?.('New password must include at least one special character.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      onToast?.('New password and confirmation do not match.', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update password.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      onToast?.('Password updated successfully.', 'success');
    } catch (err) {
      onToast?.(err.message || 'Failed to update password.', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const sidebarTabs = [
    { id: 'membership', label: 'Contribution' },
    { id: 'pmes', label: 'PMES Seminars' },
    { id: 'orders', label: 'My Orders' },
    { id: 'profile', label: 'Profile' },
    { id: 'settings', label: 'Settings' },
  ];

  const handleLogout = () => {
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
    setPage('home');
  };

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '44px 24px 64px' }}>
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8" style={{ alignItems: 'start' }}>

        {/* ── Sidebar ── */}
        {/* Hidden below md: on a phone this card (avatar + 5 nav buttons +
            logout) was rendering inline above the page content, pushing the
            thing the member actually came to see (e.g. the membership
            status/apply prompt) below the fold. Mobile navigates via the
            profile icon in the Navbar instead (see Navbar.jsx); the photo
            upload that used to live only here also has a mobile-only copy
            in the Profile tab below so it isn't lost on small screens. */}
        <aside className="hidden md:block" style={{
          background: 'var(--card-bg)', borderRadius: 16,
          border: '1.5px solid var(--border)', padding: '28px 20px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
          position: 'sticky', top: 84,
        }}>
          {/* Avatar - click the photo (or the camera badge) to replace it any time */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarFileChange}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              title="Change profile photo"
              style={{
                position: 'relative', width: 60, height: 60, margin: '0 auto 12px',
                border: 'none', padding: 0, cursor: uploadingAvatar ? 'wait' : 'pointer',
                borderRadius: '50%', display: 'block',
              }}
            >
              {user?.avatarUrl ? (
                <img
                  src={resolveImageUrl(user.avatarUrl)}
                  alt=""
                  style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', opacity: uploadingAvatar ? 0.5 : 1 }}
                />
              ) : (
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: 'var(--green)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 700, opacity: uploadingAvatar ? 0.5 : 1,
                }}>
                  {(user?.name || 'U')[0].toUpperCase()}
                </div>
              )}
              <span style={{
                position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: '50%',
                background: 'var(--green)', border: '2px solid var(--card-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Camera size={11} color="#fff" />
              </span>
            </button>
            <p style={{ fontWeight: 700, fontSize: 15 }}>{user?.name || 'User Account'}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{user?.email || 'user@example.com'}</p>
          </div>

          {/* Nav items */}
          <nav>
            {sidebarTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 10,
                  border: 'none', cursor: 'pointer',
                  marginBottom: 4,
                  background: activeTab === tab.id ? 'var(--green)' : 'transparent',
                  color: activeTab === tab.id ? '#fff' : 'var(--text)',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  fontSize: 14, textAlign: 'left',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={e => {
                  if (activeTab !== tab.id) e.currentTarget.style.background = 'var(--green-light)';
                }}
                onMouseLeave={e => {
                  if (activeTab !== tab.id) e.currentTarget.style.background = 'transparent';
                }}
              >
                {tab.label}
              </button>
            ))}

            <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

            <button
              onClick={handleLogout}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10,
                border: 'none', background: 'transparent',
                color: '#e24b4a', fontSize: 14, cursor: 'pointer', textAlign: 'left', fontWeight: 500,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fff0f0')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Logout
            </button>
          </nav>
        </aside>

        {/* ── Main Content ── */}
        <main>

          {/* My Orders - welcome banner + at-a-glance stats live here now,
              right above the full order list, instead of a separate
              "dashboard" tab that had no sidebar entry to reach it. */}
          {activeTab === 'orders' && (
            <>
              <div style={{
                background: 'linear-gradient(135deg, var(--green) 0%, #566343 100%)',
                borderRadius: 16, padding: '28px 32px', marginBottom: 24,
                color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              }}>
                <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Welcome back, {(user?.name || 'there').split(' ')[0]}</p>
                <p style={{ fontSize: 14, opacity: 0.9 }}>
                  Here's a quick look at your orders and membership activity with BOCOFAC.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: 24 }}>
                {[
                  { label: 'Total Orders', value: totalOrders, color: 'var(--green)' },
                  { label: 'Pending', value: pending, color: '#d97706' },
                  { label: 'Complete', value: complete, color: 'var(--green)' },
                ].map(stat => (
                  <div key={stat.label} style={{
                    background: 'var(--card-bg)', borderRadius: 14,
                    border: '1.5px solid var(--border)', padding: '24px 26px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>{stat.label}</p>
                    <p style={{ fontSize: 34, fontWeight: 800, color: stat.color }}>{stat.value}</p>
                  </div>
                ))}
              </div>

            <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '28px' }}>
              <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>My Orders</h2>
              {loadingOrders ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading orders…</p>
              ) : orders.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>You haven't placed any orders yet.</p>
              ) : (
                orders.map(o => {
                  return (
                    <div key={o.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                      <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{o.id}</p>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                        {o.items.map(i => `${i.productName} ×${i.quantity}`).join(', ')}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                        <span>{new Date(o.orderedAt).toLocaleDateString()}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>₱{o.totalAmount.toLocaleString()}</span>
                      </div>
                      {o.status === 'Rejected' ? (
                        o.rejectionReason && (
                          <p style={{ fontSize: 12, color: 'var(--alert-rose-text)', background: 'var(--alert-rose-bg)', padding: '8px 10px', borderRadius: 8, marginTop: 8 }}>
                            Reason: {o.rejectionReason}
                          </p>
                        )
                      ) : o.status === 'Cancelled' ? (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
                          You cancelled this order.
                        </p>
                      ) : (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
                          Estimated delivery: 1-3 days
                        </p>
                      )}
                      {canStillCancel(o) && (
                        <button
                          onClick={() => handleCancelOrder(o.id)}
                          disabled={cancellingId === o.id}
                          style={{
                            marginTop: 10, fontSize: 12, fontWeight: 600,
                            color: 'var(--alert-rose-text)', background: 'none', border: '1px solid var(--alert-rose-border)',
                            borderRadius: 8, padding: '6px 12px', cursor: cancellingId === o.id ? 'default' : 'pointer',
                            opacity: cancellingId === o.id ? 0.6 : 1,
                          }}
                        >
                          {cancellingId === o.id ? 'Cancelling…' : 'Cancel Order'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            </>
          )}

          {/* Membership */}
          {activeTab === 'membership' && (
            <>
              {loadingMembership ? (
                <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '28px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading membership status…</p>
                </div>
              ) : !membership?.member ? (
                <ApplicationStatusPanel applicantStatus={applicantStatus} setPage={setPage} />
              ) : (
                <MembershipContributionPanel
                  membership={membership}
                  ledgerEntries={ledgerEntries}
                  showPaymentForm={showPaymentForm}
                  setShowPaymentForm={setShowPaymentForm}
                  paymentForm={paymentForm}
                  setPaymentForm={setPaymentForm}
                  submittingPayment={submittingPayment}
                  onSubmitPayment={handleSubmitPayment}
                  withdrawalData={withdrawalData}
                  showWithdrawForm={showWithdrawForm}
                  setShowWithdrawForm={setShowWithdrawForm}
                  withdrawAmount={withdrawAmount}
                  setWithdrawAmount={setWithdrawAmount}
                  submittingWithdrawal={submittingWithdrawal}
                  onSubmitWithdrawal={handleSubmitWithdrawal}
                />
              )}
            </>
          )}

          {/* PMES Seminars */}
          {activeTab === 'pmes' && (
            <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '28px' }}>
              <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Upcoming PMES Seminars</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 22 }}>
                Pre-Membership Education Seminars are open to everyone - whether you're already a BOCOFAC member,
                still applying, or just curious. Reserve a slot below.
              </p>
              {upcomingPmesSessions.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0', fontSize: 14 }}>
                  No seminars scheduled yet - check back soon.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {upcomingPmesSessions.map(session => {
                    const isFull = session.registeredCount >= session.capacity;
                    const isMine = myPmesRegistration?.session.id === session.id;
                    return (
                    <div key={session.id} style={{ border: isMine ? '1.5px solid #16a34a' : '1.5px solid var(--border)', borderRadius: 12, padding: '16px', background: isMine ? 'rgba(22, 163, 74, 0.06)' : undefined }}>
                      {isMine && (
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Check size={12} /> You're registered for this session
                        </p>
                      )}
                      <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{session.title}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
                        {new Date(session.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} · {session.time}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
                        Venue: {session.venue || 'BOCOFAC Cooperative Hall, Sipocot'}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                        Facilitator: {session.speaker}
                      </p>
                      <p style={{ fontSize: 12, color: isFull ? '#e24b4a' : 'var(--text-muted)', marginBottom: 14, fontWeight: isFull ? 700 : 400 }}>
                        {session.registeredCount}/{session.capacity} registered · {isFull ? 'Full' : `${session.capacity - session.registeredCount} slot(s) left`}
                      </p>
                      <GreenBtn
                        small
                        onClick={() => handleReservePmesSlot(session)}
                        disabled={isFull || isMine || registeringSessionId === session.id}
                      >
                        {isMine ? 'Registered' : isFull ? 'Full' : registeringSessionId === session.id ? 'Reserving…' : 'Reserve Slot'}
                      </GreenBtn>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Profile */}
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Header banner - same gradient treatment as the Dashboard
                  welcome banner, so Profile reads as part of the same app
                  instead of a bare settings form. */}
              <div style={{
                background: 'linear-gradient(135deg, var(--green) 0%, #566343 100%)',
                borderRadius: 16, padding: '28px 32px',
                color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 16,
              }}>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{user?.name || 'My Account'}</p>
                  <p style={{ fontSize: 13, opacity: 0.9 }}>{user?.email}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                    background: 'rgba(255,255,255,0.16)',
                  }}>
                    <BadgeCheck size={14} /> {user?.memberId ? 'Cooperative Member' : 'Customer'}
                  </span>
                  {membership?.member && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                      background: 'rgba(255,255,255,0.16)',
                    }}>
                      <ShieldCheck size={14} /> Active Member
                    </span>
                  )}
                </div>
              </div>

              {/* Mobile-only photo editor - the sidebar this normally lives
                  in is hidden below md so it stops crowding out page
                  content on a phone, so this is mobile's only way to reach it. */}
              <div className="md:hidden" style={{
                background: 'var(--card-bg)', borderRadius: 14, border: '1.5px solid var(--border)',
                padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarFileChange}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  title="Change profile photo"
                  style={{
                    position: 'relative', width: 56, height: 56, flexShrink: 0,
                    border: 'none', padding: 0, cursor: uploadingAvatar ? 'wait' : 'pointer',
                    borderRadius: '50%', display: 'block',
                  }}
                >
                  {user?.avatarUrl ? (
                    <img
                      src={resolveImageUrl(user.avatarUrl)}
                      alt=""
                      style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', opacity: uploadingAvatar ? 0.5 : 1 }}
                    />
                  ) : (
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: 'var(--green)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, fontWeight: 700, opacity: uploadingAvatar ? 0.5 : 1,
                    }}>
                      {(user?.name || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span style={{
                    position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--green)', border: '2px solid var(--card-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Camera size={10} color="#fff" />
                  </span>
                </button>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>Profile Photo</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Tap your photo to change it.</p>
                </div>
              </div>

              <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '28px' }}>
                <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Account Info</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <StatTile
                    icon={BadgeCheck}
                    label="Account Type"
                    value={user?.memberId ? 'Cooperative Member' : 'Customer'}
                    color="var(--green)"
                    background="var(--tile-green-bg)"
                  />
                  <StatTile
                    icon={ShieldCheck}
                    label="Membership Status"
                    value={membership?.member ? 'Active Member' : applicantStatus ? displayApplicantStatus(applicantStatus.status) : 'Not a Member'}
                    color="#2563eb"
                    background="var(--tile-blue-bg)"
                  />
                  <StatTile
                    icon={Hash}
                    label="Member ID"
                    value={user?.memberId || 'Not linked'}
                    color="#d97706"
                    background="var(--tile-amber-bg)"
                  />
                  <StatTile
                    icon={Calendar}
                    label="Member Since"
                    value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : '—'}
                    color="var(--green)"
                    background="var(--tile-green-bg)"
                  />
                  <StatTile
                    icon={ShoppingBag}
                    label="Total Orders"
                    value={totalOrders}
                    color="#2563eb"
                    background="var(--tile-blue-bg)"
                  />
                  <StatTile
                    icon={User}
                    label="Account Role"
                    value={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Customer'}
                    color="#d97706"
                    background="var(--tile-amber-bg)"
                  />
                </div>
              </div>

              {/* Help Center - real contact info (matches the site footer)
                  plus FAQs grounded in what this app actually does. */}
              <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '28px' }}>
                <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HelpCircle size={16} /> Help Center
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
                  Need help with your order, payment, or membership? Reach the cooperative directly.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5" style={{ marginBottom: 24 }}>
                  <a
                    href="tel:+639178894402"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
                      borderRadius: 12, background: 'var(--tile-green-bg)', color: 'var(--text)',
                      fontSize: 13, fontWeight: 600, textDecoration: 'none',
                    }}
                  >
                    <Phone size={16} style={{ color: 'var(--green)', flexShrink: 0 }} /> 0917-889-4402
                  </a>
                  <a
                    href="mailto:info@bocofac.coop"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
                      borderRadius: 12, background: 'var(--tile-blue-bg)', color: 'var(--text)',
                      fontSize: 13, fontWeight: 600, textDecoration: 'none',
                    }}
                  >
                    <Mail size={16} style={{ color: '#2563eb', flexShrink: 0 }} /> info@bocofac.coop
                  </a>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=Sitio+Torens%2C+North+Villazar%2C+Sipocot%2C+Camarines+Sur"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
                      borderRadius: 12, background: 'var(--tile-amber-bg)', color: 'var(--text)',
                      fontSize: 13, fontWeight: 600, textDecoration: 'none',
                    }}
                  >
                    <MapPin size={16} style={{ color: '#d97706', flexShrink: 0 }} /> Sipocot, Camarines Sur
                  </a>
                </div>

                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
                  Frequently Asked Questions
                </h3>
                <div>
                  {FAQ_ITEMS.map((item, i) => {
                    const isOpen = openFaqIndex === i;
                    return (
                      <div key={i} style={{ borderBottom: i < FAQ_ITEMS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <button
                          onClick={() => setOpenFaqIndex(isOpen ? null : i)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: 12, padding: '14px 4px', background: 'none', border: 'none', cursor: 'pointer',
                            textAlign: 'left', fontSize: 14, fontWeight: 600, color: 'var(--text)',
                          }}
                        >
                          {item.q}
                          <ChevronDown
                            size={16}
                            style={{ flexShrink: 0, color: 'var(--text-muted)', transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'none' }}
                          />
                        </button>
                        {isOpen && (
                          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, padding: '0 4px 16px' }}>
                            {item.a}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Privacy Policy - collapsed by default; describes what this
                  app actually stores and who can see it (order verification
                  is admin/board-only, per the access rules elsewhere in the
                  app), not generic boilerplate. */}
              <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '28px' }}>
                <button
                  onClick={() => setShowPrivacyPolicy(v => !v)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}
                >
                  <h2 style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={16} /> Privacy Policy
                  </h2>
                  <ChevronDown
                    size={18}
                    style={{ color: 'var(--text-muted)', transition: 'transform 0.15s', transform: showPrivacyPolicy ? 'rotate(180deg)' : 'none' }}
                  />
                </button>

                {showPrivacyPolicy && (
                  <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                    <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>What we collect</p>
                    <p style={{ marginBottom: 14 }}>
                      Your name, email, phone number, delivery address, order history, membership and share
                      capital records, payment reference numbers, uploaded payment receipts, and profile photo.
                    </p>
                    <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>How we use it</p>
                    <p style={{ marginBottom: 14 }}>
                      To process and deliver your orders, verify payments, manage your cooperative membership
                      and share capital contributions, and contact you about your account when needed.
                    </p>
                    <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Who can see it</p>
                    <p style={{ marginBottom: 14 }}>
                      Only BOCOFAC admin and board staff, and only for order verification or membership
                      recordkeeping. We do not sell or share your information with outside third parties.
                    </p>
                    <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Your control</p>
                    <p>
                      You can update your name, email, and phone anytime from the Settings page, and your photo
                      from your account avatar (the sidebar on desktop, or here on the Profile tab on mobile). To
                      request a correction or removal of other data, reach out through the Help Center above.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Settings - account editing (name/email/phone) and password
              security, split out from Profile so that tab stays a read-only
              account summary. */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '28px' }}>
                <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 22 }}>My Profile</h2>
                <FormInput
                  label="Full Name"
                  value={profileDraft.name}
                  onChange={e => setProfileDraft(f => ({ ...f, name: e.target.value }))}
                  required
                />
                <FormInput
                  label="Email Address"
                  type="email"
                  value={profileDraft.email}
                  onChange={e => setProfileDraft(f => ({ ...f, email: e.target.value }))}
                  required
                />
                <FormInput
                  label="Contact Number"
                  placeholder="09XX XXX XXXX"
                  inputMode="numeric"
                  maxLength={11}
                  value={profileDraft.phone}
                  onChange={e => setProfileDraft(f => ({ ...f, phone: digitsOnly(e.target.value, 11) }))}
                  valid={profileDraft.phone ? isValidPhone11(profileDraft.phone) : undefined}
                />
                <GreenBtn onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? 'Saving…' : 'Save Changes'}
                </GreenBtn>
              </div>

              {/* Security - Change Password (needs the current password) and
                  Forgot Password (email reset link) live together here, since
                  they're the same problem from two different starting points. */}
              <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '28px' }}>
                <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Lock size={16} /> Security
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 22 }}>
                  Update the password you use to sign in to your BOCOFAC account.
                </p>
                <form onSubmit={handleChangePassword}>
                  <FormInput
                    label="Current Password"
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.currentPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                    required
                  />
                  <FormInput
                    label="New Password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="8+ characters, with a letter, number & symbol"
                    value={passwordForm.newPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                    required
                  />
                  <FormInput
                    label="Confirm New Password"
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    required
                  />
                  <GreenBtn type="submit" disabled={changingPassword}>
                    {changingPassword ? 'Updating…' : 'Update Password'}
                  </GreenBtn>
                </form>

                <div style={{ marginTop: 22, paddingTop: 22, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>Forgot your current password?</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>We'll email you a 6-digit code to reset it.</p>
                  </div>
                  <GreenBtn outline small onClick={() => setPage('forgot-password')}>
                    Reset via Email Code
                  </GreenBtn>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Branded confirmation prompt, replacing window.confirm() (see
          AdminDashboardPage.jsx for the same pattern) - a native confirm()
          dialog is titled by the raw host ("localhost:3000 says"), which
          looks broken/unbranded to a customer. */}
      {confirmPrompt && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 space-y-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              confirmPrompt.tone === 'danger' ? 'bg-rose-100 dark:bg-rose-950/50' : 'bg-emerald-100 dark:bg-emerald-950/50'
            }`}>
              {confirmPrompt.tone === 'danger' ? (
                <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              ) : (
                <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{confirmPrompt.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{confirmPrompt.message}</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmPrompt(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-slate-700 font-semibold text-sm transition"
              >
                Never mind
              </button>
              <button
                onClick={() => {
                  confirmPrompt.onConfirm();
                  setConfirmPrompt(null);
                }}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition text-white ${
                  confirmPrompt.tone === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {confirmPrompt.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, color, background, icon: Icon }) {
  return (
    <div style={{ background, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {Icon && <Icon size={13} style={{ color, opacity: 0.85 }} />}
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</p>
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color }}>{value}</p>
    </div>
  );
}

function MembershipContributionPanel({
  membership,
  ledgerEntries,
  showPaymentForm,
  setShowPaymentForm,
  paymentForm,
  setPaymentForm,
  submittingPayment,
  onSubmitPayment,
  withdrawalData,
  showWithdrawForm,
  setShowWithdrawForm,
  withdrawAmount,
  setWithdrawAmount,
  submittingWithdrawal,
  onSubmitWithdrawal,
}) {
  const { member, totalContribution = 0, savingsBalance = 0, subscribedShare, paidUpCapital } = membership;
  const { availableBalance = 0, requests: withdrawalRequests = [] } = withdrawalData || {};
  const target = Number(member.requiredShareCapital) || 0;
  // "Remaining Balance" tracks the same fixed 4k-25k range shown in "Target
  // Amount" (not the member's own requiredShareCapital) - it's that range
  // minus what they've paid so far, floored at 0. With no payments yet it's
  // identical to the Target Amount range.
  const remainingMin = Math.max(MIN_REQUIRED_SHARE_CAPITAL - totalContribution, 0);
  const remainingMax = Math.max(MAX_REQUIRED_SHARE_CAPITAL - totalContribution, 0);
  const progressPct = target > 0 ? Math.min(100, Math.round((totalContribution / target) * 100)) : 0;
  const contributionStatus = target > 0 && totalContribution >= target
    ? 'Complete'
    : totalContribution > 0 ? 'Partial' : 'Unpaid';
  const statusColors = {
    Complete: { bg: '#ebebe0', text: '#424c34' },
    Partial: { bg: '#fef3c7', text: '#92400e' },
    Unpaid: { bg: '#f1f5f9', text: '#475569' },
  }[contributionStatus];
  const monthlyEarning = totalContribution * 0.10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
          <h2 style={{ fontWeight: 700, fontSize: 16 }}>Your Contribution Status</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GreenBtn small onClick={() => setShowPaymentForm(v => !v)}>
              {showPaymentForm ? 'Cancel' : 'Add Payment'}
            </GreenBtn>
            <button
              onClick={() => printStatementOfAccount(member, ledgerEntries)}
              title="Print Statement"
              style={{
                padding: 6, borderRadius: 8, color: 'var(--green)', background: 'transparent',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              <Printer size={16} />
            </button>
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
          Track your share capital contribution and make payments here.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5" style={{ marginBottom: 18 }}>
          <StatTile label="Total Paid" value={`₱${totalContribution.toLocaleString()}`} color="var(--green)" background="var(--tile-green-bg)" />
          <StatTile
            label="Remaining Balance"
            value={remainingMin === remainingMax
              ? `₱${remainingMin.toLocaleString()}`
              : `₱${remainingMin.toLocaleString()} - ₱${remainingMax.toLocaleString()}`}
            color="#d97706"
            background="var(--tile-amber-bg)"
          />
          <StatTile label="Target Amount" value={`₱${MIN_REQUIRED_SHARE_CAPITAL.toLocaleString()} - ₱${MAX_REQUIRED_SHARE_CAPITAL.toLocaleString()}`} color="#2563eb" background="var(--tile-blue-bg)" />
          <StatTile label="Savings" value={`₱${savingsBalance.toLocaleString()}`} color="#0284c7" background="rgba(2, 132, 199, 0.12)" />
        </div>

        {contributionStatus === 'Complete' && (
          <div style={{
            background: 'var(--tile-green-bg)', border: '1.5px solid #bbf7d0', borderRadius: 12,
            padding: '14px 18px', marginBottom: 18,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', marginBottom: 2 }}>Monthly Earning (10%)</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Estimated share of BOCOFAC's monthly cooperative earnings.</p>
              </div>
              <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>₱{monthlyEarning.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>

            <div style={{
              marginTop: 14, paddingTop: 14, borderTop: '1px solid #bbf7d0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            }}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Available to Withdraw</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>₱{availableBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
              <GreenBtn onClick={() => setShowWithdrawForm(v => !v)} disabled={availableBalance <= 0}>
                {showWithdrawForm ? 'Cancel' : 'Withdraw'}
              </GreenBtn>
            </div>

            {showWithdrawForm && (
              <form onSubmit={onSubmitWithdrawal} style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #bbf7d0' }}>
                <FormInput
                  label={`Amount to Withdraw (₱) - max ₱${availableBalance.toLocaleString()}`}
                  type="number"
                  placeholder="e.g. 100"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  required
                />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -10, marginBottom: 18 }}>
                  The cooperative sends this manually (GCash/bank) once approved.
                </p>
                <GreenBtn type="submit" disabled={submittingWithdrawal}>
                  {submittingWithdrawal ? 'Submitting…' : 'Request Withdrawal'}
                </GreenBtn>
              </form>
            )}
          </div>
        )}

        {(subscribedShare !== null || paidUpCapital !== null) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" style={{ marginBottom: 18 }}>
            <StatTile label="Subscribed Share" value={subscribedShare !== null ? `₱${subscribedShare.toLocaleString()}` : 'N/A'} color="var(--text)" background="#f8fafc" />
            <StatTile label="Paid-Up Capital" value={paidUpCapital !== null ? `₱${paidUpCapital.toLocaleString()}` : 'N/A'} color="var(--text)" background="#f8fafc" />
          </div>
        )}

        <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
          <span>Progress</span>
          <span>{progressPct}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--track-bg)', overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--green)', borderRadius: 999 }} />
        </div>

        <div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>Status</p>
          <span style={{
            display: 'inline-block', padding: '4px 12px', borderRadius: 999,
            fontSize: 12, fontWeight: 700, background: statusColors.bg, color: statusColors.text,
          }}>
            {contributionStatus}
          </span>
        </div>

        {showPaymentForm && (
          <form onSubmit={onSubmitPayment} style={{ marginTop: 22, paddingTop: 22, borderTop: '1px solid var(--border)' }}>
            <FormInput
              label="Amount (₱)"
              type="number"
              placeholder="e.g. 1000"
              value={paymentForm.amount}
              onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
              required
            />
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
                Payment Method
              </label>
              {/* GCash is the cooperative's only accepted method right now, so
                  this is shown as a fixed value instead of a dropdown with
                  nothing else to pick - an arrow implying other options that
                  don't exist would just be misleading. */}
              <div style={{
                width: '100%', padding: '11px 14px', border: '1.5px solid var(--border)',
                borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'var(--text)', background: 'var(--card-bg)',
                boxSizing: 'border-box',
              }}>
                GCash
              </div>
            </div>
            <div style={{
              marginBottom: 18, padding: '14px 16px', borderRadius: 12,
              background: 'rgba(217, 119, 6, 0.06)', border: '1px solid rgba(217, 119, 6, 0.25)',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 2 }}>Send Payment To - GCash Official Wallet</p>
              <p style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text)' }}>0917-889-4402</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Account: BOCOFAC Coop Central Inc.</p>
            </div>
            <FormInput
              label="Reference Number"
              placeholder="e.g. GCash reference no."
              inputMode="numeric"
              value={paymentForm.referenceId}
              onChange={e => setPaymentForm(f => ({ ...f, referenceId: digitsOnly(e.target.value, 13) }))}
              maxLength={13}
              valid={paymentForm.referenceId ? isValidGcashRef13(paymentForm.referenceId) : undefined}
            />
            <GreenBtn type="submit" disabled={submittingPayment}>
              {submittingPayment ? 'Submitting…' : 'Submit Payment'}
            </GreenBtn>
          </form>
        )}
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '28px' }}>
        <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Share Contribution History</h2>
        {ledgerEntries.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: 14 }}>
            No payments recorded yet.
          </p>
        ) : (
          ledgerEntries.map(entry => (
            <div key={entry.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: 'var(--alert-emerald-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                }}>
                  ₱
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>₱{entry.amount.toLocaleString()}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {entry.referenceId ? `Reference: ${entry.referenceId}` : entry.paymentMethod}
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {new Date(entry.paymentDate).toISOString().split('T')[0]}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px', borderRadius: 999,
                    fontSize: 11, fontWeight: 700,
                    background: entry.status === 'Verified' ? '#ebebe0' : '#fef3c7',
                    color: entry.status === 'Verified' ? '#424c34' : '#92400e',
                  }}>
                    {entry.status}
                  </span>
                  {entry.status === 'Verified' && (
                    <button
                      onClick={() => printOfficialReceipt({ ...entry, memberName: member.name, memberId: member.id })}
                      title="Print OR"
                      style={{
                        padding: 4, borderRadius: 6, color: 'var(--green)',
                        background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                      }}
                    >
                      <Printer size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '28px' }}>
        <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Transaction History</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -12, marginBottom: 18 }}>
          Your earnings withdrawal requests.
        </p>
        {withdrawalRequests.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: 14 }}>
            No withdrawal requests yet.
          </p>
        ) : (
          withdrawalRequests.map(req => (
            <div key={req.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: 'var(--alert-emerald-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                }}>
                  ₱
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>₱{req.requestedAmount.toLocaleString()}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{req.id}</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {new Date(req.requestedAt).toISOString().split('T')[0]}
                </p>
                <span style={{
                  display: 'inline-block', padding: '2px 10px', borderRadius: 999,
                  fontSize: 11, fontWeight: 700,
                  background: req.status === 'Sent' ? '#ebebe0' : req.status === 'Rejected' ? '#fee2e2' : '#fef3c7',
                  color: req.status === 'Sent' ? '#424c34' : req.status === 'Rejected' ? '#991b1b' : '#92400e',
                }}>
                  {req.status}
                </span>
                {req.status === 'Sent' && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    ₱{req.sentAmount.toLocaleString()}{req.sentReference ? ` · Ref: ${req.sentReference}` : ''}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
