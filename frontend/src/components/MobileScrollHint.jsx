// src/components/MobileScrollHint.jsx
// Sits just above a horizontally-scrollable data table (built for desktop's
// column count, not resized for mobile) so a phone screen doesn't just look
// like the table got cut off - it's a hint, not a restructure, so the table
// itself and the desktop view are untouched.
import React from 'react';
import { MoveHorizontal } from 'lucide-react';

export default function MobileScrollHint() {
  return (
    <p className="md:hidden flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 px-4 pt-2.5 pb-1">
      <MoveHorizontal className="w-3 h-3 shrink-0" /> Swipe sideways to see more columns
    </p>
  );
}
