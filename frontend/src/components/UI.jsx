// src/components/UI.jsx
import React from 'react';

/* ─────────────────────────────────────────
   GreenButton — primary / outline variants
───────────────────────────────────────── */
export function GreenBtn({ children, onClick, type = 'button', full, outline, small, disabled, ...rest }) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: full ? '100%' : 'auto',
    padding: small ? '8px 18px' : '13px 28px',
    background: outline ? 'transparent' : 'var(--green)',
    color: outline ? 'var(--green)' : '#fff',
    border: '1.5px solid var(--green)',
    borderRadius: 10,
    fontSize: small ? 13 : 15,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'background 0.15s, color 0.15s, transform 0.1s',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={base}
      {...rest}
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.background = outline ? 'var(--green-light)' : 'var(--green-dark)';
      }}
      onMouseLeave={e => {
        if (!disabled) e.currentTarget.style.background = outline ? 'transparent' : 'var(--green)';
      }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────
   FormInput — labeled input with optional icon
───────────────────────────────────────── */
export function FormInput({ label, placeholder, type = 'text', icon, value, onChange, onBlur, required, name, autoComplete, inputMode, maxLength, error }) {
  const restColor = error ? '#e24b4a' : 'var(--border)';
  return (
    <div style={{ marginBottom: 18 }}>
      {label && (
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>
          {label}
          {required && <span style={{ color: '#e24b4a' }}> *</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: '#9eb09e', fontSize: 16, pointerEvents: 'none',
          }}>
            {icon}
          </span>
        )}
        <input
          type={type}
          name={name}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          placeholder={placeholder}
          value={value || ''}
          onChange={onChange}
          onBlur={e => { e.target.style.borderColor = restColor; onBlur && onBlur(e); }}
          style={{
            width: '100%',
            padding: icon ? '11px 14px 11px 40px' : '11px 14px',
            border: `1.5px solid ${restColor}`,
            borderRadius: 10,
            fontSize: 14,
            color: 'var(--text)',
            background: 'var(--card-bg)',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = error ? '#e24b4a' : 'var(--green)')}
        />
      </div>
      {error && (
        <p style={{ color: '#e24b4a', fontSize: 11, fontWeight: 500, marginTop: 5 }}>{error}</p>
      )}
    </div>
  );
}

