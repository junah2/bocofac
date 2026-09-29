import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check } from 'lucide-react';

// Popup na pang-confirm (kapalit ng browser alert/confirm). May optional na text field, hal. dahilan ng pag-reject.
export default function ConfirmDialog({ prompt, onClose }) {
  const [note, setNote] = useState('');
  useEffect(() => { setNote(''); }, [prompt]);
  useEffect(() => {
    if (!prompt) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prompt, onClose]);

  if (!prompt) return null;
  const danger = prompt.tone === 'danger';
  return createPortal(
    <div className="fixed inset-0 z-[90] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 space-y-4 text-left shadow-2xl">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${danger ? 'bg-rose-100 dark:bg-rose-950/50' : 'bg-emerald-100 dark:bg-emerald-950/50'}`}>
          {danger
            ? <AlertTriangle size={24} className="text-rose-600 dark:text-rose-400" />
            : <Check size={24} className="text-emerald-600 dark:text-emerald-400" />}
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{prompt.title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{prompt.message}</p>
        </div>
        {prompt.noteLabel && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{prompt.noteLabel}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={prompt.notePlaceholder || ''}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 text-slate-700 font-semibold text-sm transition cursor-pointer"
          >
            Never mind
          </button>
          <button
            type="button"
            onClick={() => { prompt.onConfirm(note.trim()); onClose(); }}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition text-white cursor-pointer ${danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
          >
            {prompt.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
