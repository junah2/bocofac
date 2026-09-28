import React from 'react';
import { isValidGcashRef13, refNumberMatchesReceipt } from '../utils/validators';

export default function RefMatchHint({ value, receiptDigitRuns, hasReceipt }) {
  const match = refNumberMatchesReceipt(receiptDigitRuns, value);
  const complete = isValidGcashRef13(value);

  let tone = 'text-red-600 dark:text-red-400 font-medium';
  let text = "Warning: The reference number you entered must match the one shown in your receipt screenshot. Payment will not be accepted if they don't match.";

  if (value && match === false) {
    tone = 'text-red-600 dark:text-red-400 font-bold';
    text = "This doesn't match the reference number on your attached receipt. Please double-check and correct it.";
  } else if (value && !complete && match === true) {
    tone = 'text-emerald-600 dark:text-emerald-400 font-bold';
    text = `So far so good - ${value.length}/13 digits match your receipt.`;
  } else if (value && !complete) {
    tone = 'text-slate-500 dark:text-slate-400 font-medium';
    text = `${value.length}/13 digits - keep typing the reference number from your receipt.`;
  } else if (complete && match === true) {
    tone = 'text-emerald-600 dark:text-emerald-400 font-bold';
    text = 'Matches the reference number on your attached receipt.';
  } else if (complete && hasReceipt && match === null) {
    tone = 'text-amber-600 dark:text-amber-400 font-medium';
    text = "We couldn't read the reference number from your picture, so it will be checked by hand. A clear, uncropped screenshot lets us check it right away.";
  }

  return <p className={`mt-1.5 text-[11px] ${tone}`} aria-live="polite">{text}</p>;
}
