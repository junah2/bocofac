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

// Words a GCash/bank confirmation carries. Kept forgiving of common OCR slips
// ("ransfer" also matches a "Transfer" whose T got misread).
const RECEIPT_OCR_KEYWORDS = [
  'gcash', 'reference', 'ref no', 'ref.', 'amount', 'transaction', 'payment',
  'sent', 'ransfer', 'total', 'php', 'bank', 'received', 'date & time',
  'successful', 'paid',
];

// Content sanity check for an attached payment screenshot. Two keywords is
// enough on its own; failing that, a 13-digit GCash reference number next to
// any receipt-like signal (a keyword, a 09xxxxxxxxx mobile number, or a money
// amount like 4,000.00) also counts - GCash's Transaction History screen puts
// its labels in light gray / white-on-blue text that OCR often misses, while
// the numbers themselves come through clearly. A random photo has neither.
export function looksLikePaymentReceipt(ocrText) {
  const text = ocrText || '';
  const lower = text.toLowerCase();
  const keywordHits = RECEIPT_OCR_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  if (keywordHits >= 2) return true;

  const runs = extractDigitRuns(text);
  const hasReferenceNumber = runs.some((run) => run.length === 13);
  const hasMobileNumber = runs.some((run) => /^09\d{9}$/.test(run));
  const hasMoneyAmount = /\d{1,3}(,\d{3})*\.\d{2}\b/.test(text);
  return hasReferenceNumber && (keywordHits >= 1 || hasMobileNumber || hasMoneyAmount);
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
