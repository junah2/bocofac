// src/pages/AuthPages.jsx
import React, { useState } from 'react';
import { Mail, Lock, UserCircle, ShieldCheck, ArrowLeft, UserPlus, Sprout, ShoppingBag, Handshake } from 'lucide-react';
import { GreenBtn, FormInput } from '../components/UI';
import coconutHero from '../assets/coconut-palms-hero.jpg';
import bocofacLogo from '../assets/bocofac-logo.jpg';

// FRONTEND TO BACKEND- CONNECTION
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

// Mirrors the backend's own rules (backend/src/validation/auth.schema.js) so
// bad input gets caught here instead of round-tripping to the server first.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = value => EMAIL_REGEX.test(value.trim());
const isValidPhone = value => /^09\d{9}$/.test(value);
const digitsOnly = (value, maxLen) => value.replace(/\D/g, '').slice(0, maxLen);
// Mirrors the backend's passwordSchema (auth.schema.js) - at least 8
// characters, with a letter, a number, and a special character.
function passwordError(value) {
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(value)) return 'Password must include at least one letter.';
  if (!/[0-9]/.test(value)) return 'Password must include at least one number.';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Password must include at least one special character.';
  return '';
}

/* Shared branded backdrop for every auth screen - matches the organic-
   gradient + dot pattern + glow orbs treatment used on the public Home/About
   heroes, so sign up/in doesn't feel like a plain, unbranded form. */
function AuthShell({ children, wide }) {
  return (
    <div className="h-full min-h-[calc(100vh-64px)] flex items-center justify-center px-5 py-6 relative overflow-hidden bg-[#1e2318]">
      <div className="absolute inset-0 organic-gradient opacity-95" />
      <div className="absolute -right-24 -top-24 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl" />
      <div className="absolute -left-24 bottom-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
      <div className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-center gap-2 mb-3 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
          <Sprout className="w-3.5 h-3.5" /> BOCOFAC Coconut Farmers Cooperative
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Sign Up ── */
function validateSignupField(key, values) {
  switch (key) {
    case 'name': return values.name.trim() ? '' : 'Name is required.';
    case 'email':
      if (!values.email) return 'Email is required.';
      return isValidEmail(values.email) ? '' : 'Invalid email format.';
    case 'phone':
      if (!values.phone) return '';
      return isValidPhone(values.phone) ? '' : 'Must start with 09 and be 11 digits.';
    case 'pass':
      return passwordError(values.pass);
    case 'confirm':
      return values.pass === values.confirm ? '' : 'Passwords do not match.';
    default: return '';
  }
}

export function SignupPage({ setPage, setUser, onToast }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', pass: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = key => e => {
    const value = key === 'phone' ? digitsOnly(e.target.value, 11) : e.target.value;
    const next = { ...form, [key]: value };
    setForm(next);
    setErrors(prevErr => {
      if (!prevErr[key] && !(key === 'pass' && prevErr.confirm)) return prevErr;
      const nextErr = { ...prevErr };
      if (prevErr[key]) nextErr[key] = validateSignupField(key, next);
      if (key === 'pass' && prevErr.confirm) nextErr.confirm = validateSignupField('confirm', next);
      return nextErr;
    });
  };

  const handleBlur = key => () => setErrors(prev => ({ ...prev, [key]: validateSignupField(key, form) }));

  const handleSubmit = async () => {
    const fieldErrors = {
      name: validateSignupField('name', form),
      email: validateSignupField('email', form),
      phone: validateSignupField('phone', form),
      pass: validateSignupField('pass', form),
      confirm: validateSignupField('confirm', form),
    };
    setErrors(fieldErrors);
    if (Object.values(fieldErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, password: form.pass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not create your account.');
      setUser(data);
      setPage('dashboard');
    } catch (err) {
      onToast(err.message || 'Could not create your account.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - branded panel. Decorative only, so it's dropped on small
          screens rather than squeezed - the form is what matters there. */}
      <div className="hidden lg:flex flex-col lg:w-1/2 relative overflow-hidden bg-[#1e2318] px-10 py-10">
        <img src={coconutHero} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(2,44,34,0.45) 0%, rgba(2,44,34,0.35) 40%, rgba(2,44,34,0.92) 100%)' }}
        />

        <div className="relative z-10 flex flex-col h-full">
          <div className="inline-flex items-center gap-2 mb-8 text-emerald-50 text-xs font-semibold uppercase tracking-wider w-fit px-3 py-1 rounded-full bg-black/25 border border-white/20 backdrop-blur-sm">
            <Sprout className="w-3.5 h-3.5" /> BOCOFAC Coconut Farmers Cooperative
          </div>

          <h1 className="font-serif text-white text-3xl font-extrabold leading-tight mb-3">Welcome to BOCOFAC!</h1>
          <p className="text-emerald-100/80 text-sm leading-relaxed max-w-sm">
            Create your account to manage your membership, track your share capital, and shop the marketplace — all in one place.
          </p>

          {/* Real coconut grove photo fills the rest of the panel - the
              gradient scrim keeps the feature row below readable without
              needing a separate illustration on top of it. */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-2xl" />
              <img
                src={bocofacLogo}
                alt="BOCOFAC"
                className="relative w-40 h-40 sm:w-52 sm:h-52 rounded-full object-cover shadow-2xl ring-4 ring-white/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/20">
            <div className="text-center">
              <div className="w-9 h-9 mx-auto mb-2 rounded-lg bg-black/30 backdrop-blur-sm flex items-center justify-center">
                <ShieldCheck className="w-4.5 h-4.5 text-emerald-300" />
              </div>
              <p className="text-white text-xs font-bold">Secure Access</p>
              <p className="text-emerald-50/80 text-[10.5px] mt-1 leading-snug">Your account and data stay protected.</p>
            </div>
            <div className="text-center">
              <div className="w-9 h-9 mx-auto mb-2 rounded-lg bg-black/30 backdrop-blur-sm flex items-center justify-center">
                <Handshake className="w-4.5 h-4.5 text-emerald-300" />
              </div>
              <p className="text-white text-xs font-bold">Coop Benefits</p>
              <p className="text-emerald-50/80 text-[10.5px] mt-1 leading-snug">Shared capital and fair trade pricing.</p>
            </div>
            <div className="text-center">
              <div className="w-9 h-9 mx-auto mb-2 rounded-lg bg-black/30 backdrop-blur-sm flex items-center justify-center">
                <ShoppingBag className="w-4.5 h-4.5 text-emerald-300" />
              </div>
              <p className="text-white text-xs font-bold">Marketplace</p>
              <p className="text-emerald-50/80 text-[10.5px] mt-1 leading-snug">Buy and sell coconut products directly.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right - the form itself. Warm beige, paired with the brand forest
          green (see logo) instead of the earlier blue-sky wash. The shared
          FormInput/GreenBtn pick up their colors from CSS vars, so
          overriding those locally is enough to reskin them for this
          surface without touching the components. */}
      <div className="w-full lg:w-1/2 relative overflow-hidden bg-[#ede6db] flex items-center justify-center px-6 py-10 sm:px-12">
        <div className="absolute -right-24 -top-24 w-72 h-72 bg-emerald-300/30 rounded-full blur-3xl" />
        <div className="absolute -left-24 -bottom-24 w-80 h-80 bg-amber-200/30 rounded-full blur-3xl" />
        <div
          className="auth-dark-panel relative w-full max-w-md"
          style={{
            '--card-bg': '#ffffff',
            '--text': '#2b2b2b',
            '--text-muted': '#726b5c',
            '--border': '#d9dcc7',
            '--green': '#6b7c52',
            '--green-dark': '#566343',
            '--green-light': 'rgba(107, 124, 82, 0.12)',
            '--tile-green-bg': '#ebebe0',
            '--tile-blue-bg': '#dbeafe',
            '--tile-amber-bg': '#fef3c7',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--green)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 10px',
            }}>
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <h1 className="font-serif" style={{ color: 'var(--green)', fontSize: 22, fontWeight: 700 }}>Create Account</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Fill in your details to join as a member.
            </p>
          </div>

          {/* This form only ever creates a Member account - Admin and Board
              accounts aren't self-registered. Everyone, staff included,
              signs in through the same shared form via the "Sign In" link
              below (see SigninPage), so no separate staff link is needed
              here. */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
            <FormInput label="Full Name" name="name" autoComplete="name" placeholder="Juan Dela Cruz" value={form.name} onChange={set('name')} onBlur={handleBlur('name')} error={errors.name} required />
            <FormInput label="Email Address" name="email" type="email" autoComplete="email" placeholder="youremail@example.com" value={form.email} onChange={set('email')} onBlur={handleBlur('email')} error={errors.email} required />
          </div>
          <div style={{ maxWidth: 220 }}>
            <FormInput label="Contact Number" name="phone" type="tel" inputMode="numeric" maxLength={11} autoComplete="tel" placeholder="09171234567" value={form.phone} onChange={set('phone')} onBlur={handleBlur('phone')} error={errors.phone} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
            <FormInput label="Password" name="new-password" type="password" autoComplete="new-password" placeholder="8+ characters, with a letter, number & symbol" value={form.pass} onChange={set('pass')} onBlur={handleBlur('pass')} error={errors.pass} required />
            <FormInput label="Confirm Password" name="confirm-password" type="password" autoComplete="new-password" placeholder="Re-enter your password" value={form.confirm} onChange={set('confirm')} onBlur={handleBlur('confirm')} error={errors.confirm} required />
          </div>

          <GreenBtn full onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating Account…' : 'Create Account'}
          </GreenBtn>

          <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <button
              onClick={() => setPage('signin')}
              style={{ color: 'var(--green)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}


// sign-in validation
function validateSigninField(key, values) {
  switch (key) {
    case 'email':
      if (!values.email) return 'Email is required.';
      return isValidEmail(values.email) ? '' : 'Invalid email format.';
    case 'pass':
      return values.pass ? '' : 'Password is required.';
    default: return '';
  }
}

// One shared sign-in form for every role (member/customer, admin, board) -
// there's nothing to pick beforehand. The backend's response tells us the
// account's actual role, and that alone decides which dashboard opens.
export function SigninPage({ setPage, setUser, setAdmin, setBod, onToast }) {
  const [form, setForm] = useState({ email: '', pass: '' });  //dito nai-store yung data sa email and pass
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [noAutofillId] = useState(() => Math.random().toString(36).slice(2));
  const noAutofillProps = {
    'data-lpignore': 'true', // LastPass
    'data-1p-ignore': '', // 1Password
    'data-bwignore': 'true', // Bitwarden
    'data-form-type': 'other', // Dashlane and other generic password managers
  };
  
  const [autofillGuardOn, setAutofillGuardOn] = useState(true);
  const dropAutofillGuard = () => setAutofillGuardOn(false);

  const set = key => e => {
    const value = e.target.value;
    const next = { ...form, [key]: value };
    setForm(next);
    setErrors(prevErr => (prevErr[key] ? { ...prevErr, [key]: validateSigninField(key, next) } : prevErr));
  };

// 359-401 login inputt validation

  const handleBlur = key => () => setErrors(prev => ({ ...prev, [key]: validateSigninField(key, form) }));

  const handleSubmit = async () => { // submit
    const fieldErrors = {
      email: validateSigninField('email', form),
      pass: validateSigninField('pass', form),
    };
    setErrors(fieldErrors);
    if (Object.values(fieldErrors).some(Boolean)) return;

    setSubmitting(true);
    try {

      // CONNECTION OF FRONTEND TO BACKEND
      const res = await fetch(`${API_BASE}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: form.email, password: form.pass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Invalid email or password.');

      if (data.role === 'admin') {
        setAdmin(data);
        setPage('admin-dashboard');
      } else if (data.role === 'board') {
        setBod(data);
        setPage('bod-dashboard');
      } else {
        setUser(data);
        setPage('dashboard');
      }
    } catch (err) {
      onToast(err.message || 'Could not sign in.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-7 relative">
        <button
          type="button"
          onClick={() => setPage('home')}
          aria-label="Back"
          className="absolute left-5 top-5 w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#313826] flex items-center justify-center mb-3 shadow-sm ring-4 ring-emerald-100 dark:ring-emerald-900/40">
            <UserCircle className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-serif text-emerald-600 dark:text-emerald-400 text-xl font-bold">Welcome Back</h1>
          <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">Enter your credentials to continue</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Email Address</label>
          <div className="relative">
            <Mail className="w-4.5 h-4.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              name={`signin-email-${noAutofillId}`}
              autoComplete="off"
              readOnly={autofillGuardOn}
              onFocus={dropAutofillGuard}
              {...noAutofillProps}
              value={form.email}
              onChange={set('email')}
              onBlur={handleBlur('email')}
              placeholder="youremail@example.com"
              className={`w-full pl-11 pr-4 py-2.5 rounded-xl border dark:bg-slate-950 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 ${errors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500'}`}
            />
          </div>
          {errors.email && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{errors.email}</p>}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Password</label>
          <div className="relative">
            <Lock className="w-4.5 h-4.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              name={`signin-password-${noAutofillId}`}
              autoComplete="off"
              readOnly={autofillGuardOn}
              onFocus={dropAutofillGuard}
              {...noAutofillProps}
              value={form.pass}
              onChange={set('pass')}
              onBlur={handleBlur('pass')}
              placeholder="Enter your password"
              className={`w-full pl-11 pr-4 py-2.5 rounded-xl border dark:bg-slate-950 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 ${errors.pass ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500'}`}
            />
          </div>
          {errors.pass && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{errors.pass}</p>}
          <button
            type="button"
            onClick={() => setPage('forgot-password')}
            className="mt-2 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
          >
            Forgot password?
          </button>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Signing In…' : 'Sign In'}
        </button>

        <p className="text-center mt-4 text-sm text-slate-700 dark:text-slate-300">
          Don't have an account?{' '}
          <button
            onClick={() => setPage('signup')}
            className="text-blue-600 dark:text-blue-400 font-semibold cursor-pointer hover:underline"
          >
            Sign Up
          </button>
        </p>
        <p className="text-center mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Staff (Admin/Board) accounts are created by BOCOFAC, not self-registered.
        </p>
      </div>
    </AuthShell>
  );
}

/* ── Forgot Password ── */
// Two steps in one page: request a code by email, then enter that code plus
// a new password. No link/token in a URL to click - the customer just types
// the code back into the same screen they requested it from.
export function ForgotPasswordPage({ setPage, onToast }) {
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [requestingCode, setRequestingCode] = useState(false);

  const [code, setCode] = useState('');
  const [form, setForm] = useState({ pass: '', confirm: '' });
  const [submitting, setSubmitting] = useState(false);

  const onEmailChange = e => {
    const value = e.target.value;
    setEmail(value);
    if (emailError) setEmailError(!value ? 'Email is required.' : isValidEmail(value) ? '' : 'Invalid email format.');
  };
  const onEmailBlur = () => setEmailError(!email ? 'Email is required.' : isValidEmail(email) ? '' : 'Invalid email format.');

  const requestCode = async () => {
    if (!email) return setEmailError('Email is required.');
    if (!isValidEmail(email)) return setEmailError('Invalid email format.');
    setRequestingCode(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not process your request.');
      setStep('code');
    } catch (err) {
      onToast(err.message || 'Could not process your request.', 'error');
    } finally {
      setRequestingCode(false);
    }
  };

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleReset = async () => {
    if (code.length !== 6) return onToast('Enter the 6-digit code from your email.', 'error');
    const passErr = passwordError(form.pass);
    if (passErr) return onToast(passErr, 'error');
    if (form.pass !== form.confirm) return onToast('Passwords do not match.', 'error');

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword: form.pass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not reset your password.');
      onToast('Password updated! Please sign in with your new password.', 'success');
      setPage('signin');
    } catch (err) {
      onToast(err.message || 'Could not reset your password.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-10 relative">
        <button
          type="button"
          onClick={() => (step === 'code' ? setStep('email') : setPage('signin'))}
          aria-label="Back"
          className="absolute left-6 top-6 w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {step === 'email' ? (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-600 flex items-center justify-center mb-4">
                <Mail className="w-7 h-7 text-white" />
              </div>
              <h1 className="font-serif text-emerald-600 dark:text-emerald-400 text-2xl font-bold">Forgot Password?</h1>
              <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">We'll email you a 6-digit code to reset it.</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="w-4.5 h-4.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={onEmailChange}
                  onBlur={onEmailBlur}
                  placeholder="youremail@example.com"
                  className={`w-full pl-11 pr-4 py-3 rounded-xl border dark:bg-slate-950 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 ${emailError ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700 focus:ring-emerald-500'}`}
                />
              </div>
              {emailError && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{emailError}</p>}
            </div>
            <button
              onClick={requestCode}
              disabled={requestingCode}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {requestingCode ? 'Sending…' : 'Send Code'}
            </button>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-600 flex items-center justify-center mb-4">
                <Lock className="w-7 h-7 text-white" />
              </div>
              <h1 className="font-serif text-emerald-600 dark:text-emerald-400 text-2xl font-bold">Enter Your Code</h1>
              <p className="text-slate-700 dark:text-slate-300 text-sm mt-1">
                If an account exists for <strong>{email}</strong>, a 6-digit code has been sent. It expires in 15 minutes.
              </p>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">6-Digit Code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={e => setCode(digitsOnly(e.target.value, 6))}
                placeholder="000000"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-950 text-center text-2xl font-bold tracking-[0.4em] text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">New Password</label>
              <div className="relative">
                <Lock className="w-4.5 h-4.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.pass}
                  onChange={set('pass')}
                  placeholder="8+ characters, with a letter, number & symbol"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-950 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Confirm New Password</label>
              <div className="relative">
                <Lock className="w-4.5 h-4.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={set('confirm')}
                  placeholder="Re-enter your new password"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-950 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={handleReset}
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving…' : 'Reset Password'}
            </button>
            <button
              type="button"
              onClick={requestCode}
              disabled={requestingCode}
              className="w-full mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer disabled:opacity-60"
            >
              {requestingCode ? 'Resending…' : "Didn't get a code? Resend"}
            </button>
          </>
        )}
      </div>
    </AuthShell>
  );
}
