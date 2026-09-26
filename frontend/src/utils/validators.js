// Shared across every contact-number and GCash-reference input in the app so
// they all enforce (and visually flag) the same format.
export const isValidPhone11 = (value) => /^09\d{9}$/.test(value);
export const isValidGcashRef13 = (value) => /^\d{13}$/.test(value);
export const digitsOnly = (value, maxLen) => value.replace(/\D/g, '').slice(0, maxLen);

// Tailwind border classes for a live-typing valid/invalid/neutral input:
// neutral while empty, red while non-empty but not yet matching, green once
// it matches exactly - no need to wait for blur or submit to see feedback.
export function validationBorderClass(value, isValid) {
  if (!value) return 'border-slate-300 dark:border-slate-700';
  return isValid
    ? 'border-emerald-500 focus:ring-emerald-500 dark:border-emerald-500'
    : 'border-red-500 focus:ring-red-500 dark:border-red-500';
}
