import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Full-size view ng image (GCash receipt, ID, certificate) na may X button; sarado rin sa Esc o pag-click sa labas
export default function ImageLightbox({ url, alt = '', onClose }) {
  useEffect(() => {
    if (!url) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [url, onClose]);

  if (!url) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-slate-950/85 flex items-center justify-center p-4 cursor-pointer"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        title="Close"
        className="absolute top-4 right-4 p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white cursor-pointer"
      >
        <X size={22} />
      </button>
      <img
        src={url}
        alt={alt}
        className="max-w-[92vw] max-h-[88vh] rounded-2xl object-contain cursor-default shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}
