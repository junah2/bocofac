// src/components/Footer.jsx
import React, { useLayoutEffect, useRef } from 'react';
import { MapPin, Phone, Mail } from 'lucide-react';

// Single, consistent footer used on every page: a thin contact-info bar,
// always fixed to the viewport bottom so it never disappears while
// scrolling. Its rendered height is exposed as --footer-h so every layout
// (public pages, Admin/Board dashboard shells) can reserve matching space
// and avoid hiding content underneath it.
export default function Footer() {
  const footerRef = useRef(null);

  useLayoutEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const updateHeight = () => {
      document.documentElement.style.setProperty('--footer-h', `${el.offsetHeight}px`);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty('--footer-h', '0px');
    };
  }, []);

  return (
    <footer
      ref={footerRef}
      className="fixed inset-x-0 bottom-0 z-30 bg-[#1e2318] dark:bg-black text-slate-300 border-t border-slate-800 shadow-[0_-4px_16px_rgba(0,0,0,0.12)]"
    >
      <div className="max-w-[1680px] mx-auto px-4 sm:px-8 h-11 flex items-center justify-center gap-x-6 gap-y-1 flex-wrap text-xs">
        <a
          href="https://www.google.com/maps/search/?api=1&query=Sitio+Torens%2C+North+Villazar%2C+Sipocot%2C+Camarines+Sur"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition"
        >
          <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          Sitio Torens, North Villazar, Sipocot, Camarines Sur
        </a>
        <a href="tel:+639178894402" className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition">
          <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          0917-889-4402
        </a>
        <a href="mailto:info@bocofac.coop" className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition">
          <Mail className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          info@bocofac.coop
        </a>
      </div>
    </footer>
  );
}
