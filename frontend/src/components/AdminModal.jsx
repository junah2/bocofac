import React, { useEffect } from 'react';
import { X } from 'lucide-react';

// [UI] Pangkalahatang modal ng admin: berdeng header, Esc / click sa labas para isara
export default function AdminModal({ eyebrow, title, subtitle, icon: Icon, onClose, maxWidth = 'max-w-2xl', children, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden bg-white dark:bg-slate-950 rounded-3xl shadow-2xl text-left`}
      >
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-emerald-700 to-emerald-600 dark:from-emerald-900 dark:to-emerald-800 text-white px-5 sm:px-6 py-5">
          <div className="absolute -right-12 -top-16 w-48 h-48 rounded-full bg-white/5" aria-hidden="true" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              {eyebrow && (
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-50/80">
                  {Icon && <Icon className="w-3.5 h-3.5" />} {eyebrow}
                </p>
              )}
              <h3 className="text-xl font-extrabold mt-1 truncate">{title}</h3>
              {subtitle && <p className="text-xs text-emerald-50/80 mt-1">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
        {footer && <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 px-5 sm:px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
