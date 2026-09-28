// [VALIDATION] Contact number: 11 digits, nagsisimula sa 09
export const isValidPhone11 = (value) => /^09\d{9}$/.test(value);
// [VALIDATION] GCash reference number: eksaktong 13 digits
export const isValidGcashRef13 = (value) => /^\d{13}$/.test(value);
export const digitsOnly = (value, maxLen) => value.replace(/\D/g, '').slice(0, maxLen);

export function validationBorderClass(value, isValid) {
  if (!value) return 'border-slate-300 dark:border-slate-700';
  return isValid
    ? 'border-emerald-500 focus:ring-emerald-500 dark:border-emerald-500'
    : 'border-red-500 focus:ring-red-500 dark:border-red-500';
}

export function extractDigitRuns(ocrText) {
  return ocrText
    .split(/\r?\n/)
    .flatMap((line) => line.replace(/[ \t]+/g, '').match(/\d+/g) || []);
}

const RECEIPT_OCR_KEYWORDS = [
  'gcash', 'reference', 'ref no', 'ref.', 'amount', 'transaction', 'payment',
  'sent', 'ransfer', 'total', 'php', 'received', 'date & time',
  'successful', 'paid',
];

// [VALIDATION] OCR: chine-check kung mukhang GCash receipt ang in-upload na picture
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

// [VALIDATION] Tinatapat ang tinype na reference sa nasa picture, simula sa unang digit
export function refNumberMatchesReceipt(digitRuns, ref) {
  if (!digitRuns || !ref) return null;
  const candidates = digitRuns.filter((run) => run.length >= 12 && !/^(09\d{9}|639\d{9})$/.test(run));
  if (candidates.length === 0) return null;
  return candidates.some((run) => {
    if (run.length === 12) {
      if (run.startsWith(ref)) return true;
      for (let i = 1; i < ref.length; i++) if (run.startsWith(ref.slice(0, i) + ref.slice(i + 1))) return true;
      return false;
    }
    for (let i = 0; i + 13 <= run.length; i++) {
      if (run.startsWith(ref, i)) return true;
    }
    return false;
  });
}
