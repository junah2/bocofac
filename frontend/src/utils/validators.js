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

// Whether the typed reference number matches the receipt's own digits,
// checked from the very first digit typed: what's typed so far must be the
// start of the reference number OCR read off the receipt.
//   true  - matches so far (or fully, once all 13 digits are in)
//   false - the receipt shows a different reference number
//   null  - nothing to check against: no receipt, or OCR couldn't read any
//           reference-like number off it (e.g. a blurry photo of a phone
//           screen) - so it shouldn't block anyone; the admin still
//           compares it against the screenshot by hand.
// Deliberately exact: fuzzy matching let wrong references through
// (9044493480657 "matched" a receipt showing 9044493480965). Receipts are
// upscaled before OCR (see receiptOcr.js), which reads them exactly. The one
// allowance is a receipt run of exactly 12 digits - OCR visibly dropped a
// digit - where the typed digits may skip one digit of it.
export function refNumberMatchesReceipt(digitRuns, ref) {
  if (!digitRuns || !ref) return null;
  // Reference-like runs only: a mobile number (09xxxxxxxxx / 639xxxxxxxxx)
  // on the receipt says nothing about the reference.
  const candidates = digitRuns.filter((run) => run.length >= 12 && !/^(09\d{9}|639\d{9})$/.test(run));
  if (candidates.length === 0) return null;
  return candidates.some((run) => {
    if (run.length === 12) {
      if (run.startsWith(ref)) return true;
      // Never the first digit, so a wrong first digit is caught immediately.
      for (let i = 1; i < ref.length; i++) if (run.startsWith(ref.slice(0, i) + ref.slice(i + 1))) return true;
      return false;
    }
    // A run longer than 13 has other digits from the same line joined on
    // (e.g. a date), so the reference can start anywhere a full 13 fit.
    for (let i = 0; i + 13 <= run.length; i++) {
      if (run.startsWith(ref, i)) return true;
    }
    return false;
  });
}
