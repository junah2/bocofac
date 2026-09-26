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

// Pulls every digit run out of OCR'd receipt text, joining runs only split by
// spaces WITHIN the same line (receipts commonly print "1234 5678 9012 3") -
// scoped per line so an amount, date, or phone number on a *different* line
// never gets concatenated with the reference number into one long blob that
// could coincidentally contain whatever a user happens to type.
export function extractDigitRuns(ocrText) {
  return ocrText
    .split(/\r?\n/)
    .flatMap((line) => line.replace(/[ \t]+/g, '').match(/\d+/g) || []);
}

// True once a receipt has been scanned AND the typed reference number
// actually appears among its digit runs - a 13-digit value that's simply
// well-formed but absent from the receipt itself shouldn't pass as "correct".
// Returns null (neither true nor false) when there's no receipt yet to check
// against, so callers can tell "not checked" apart from "checked and wrong."
export function refNumberMatchesReceipt(digitRuns, ref) {
  if (!digitRuns || !ref) return null;
  return digitRuns.some((run) => run.includes(ref));
}
