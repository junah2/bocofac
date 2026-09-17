import React from 'react';
import {
  ShoppingBag,
  Users,
  Sprout,
  Handshake,
  TrendingUp,
  ArrowRight,
  Star,
  TreePalm
} from 'lucide-react';
import { resolveImageUrl } from '../utils/resolveImageUrl';
import coconutFarmerHero from '../assets/coconut-farmer-hero.jpg';
import coconutPalms from '../assets/coconut-palms-hero.jpg';
import coconutSeedlings from '../assets/images-tambo.jpg';
import galleryCoconutShells from '../assets/gallery-coconut-shells.jpg';
import galleryCoirProducts from '../assets/gallery-coir-products.jpg';
import galleryCoconutHusk from '../assets/gallery-coconut-husk.jpg';
import galleryShellBriquettes from '../assets/gallery-shell-briquettes.jpg';

const WHY_JOIN = [
  {
    icon: Handshake,
    title: 'Direct & Fair Trade',
    text: 'Sell and buy directly within the cooperative network, cutting out middlemen and securing fair farm-gate prices.',
  },
  {
    icon: TrendingUp,
    title: 'Shared Capital Growth',
    text: "Every member contributes to and benefits from the cooperative's growing share capital and dividend program.",
  },
  {
    icon: Sprout,
    title: 'Farmer Education (PMES)',
    text: 'Free Pre-Membership Education Seminars covering governance, farming practices, and financial literacy.',
  },
];

export default function PublicHome({ products, memberCount, onShopNow, onApplyMembership }) {
  const featuredProducts = [...products]
    .sort((a, b) => b.ordersCount - a.ordersCount)
    .slice(0, 3);

  return (
    <div className="animate-in fade-in duration-500">

      {/* Hero - full-bleed farm photo with the headline layered on top,
          mirroring a photo-first hero instead of a flat gradient panel */}
      <section className="relative overflow-hidden">
        <img src={coconutFarmerHero} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1e2318]/80 via-[#1e2318]/50 to-[#1e2318]/85" />

        <div className="relative max-w-3xl mx-auto px-6 py-24 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold uppercase tracking-wider shadow-lg mb-6">
            <Sprout className="w-3.5 h-3.5" />
            BOCOFAC Coconut Farmers Cooperative
          </div>

          <div className="bg-[#faf8f4]/95 backdrop-blur-sm rounded-2xl px-6 py-8 sm:px-10 sm:py-10 shadow-2xl space-y-4">
            <h1 className="font-serif text-3xl sm:text-5xl font-extrabold text-[#2b2b2b] tracking-tight leading-tight">
              Empowering Coconut Farmers Through Digital Innovation
            </h1>
            <p className="text-[#726b5c] text-sm sm:text-base font-light leading-relaxed max-w-xl mx-auto">
              Shop direct-to-farm organic coconut products and join a cooperative that shares capital, knowledge, and profits with its member-farmers.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8">
            <button
              onClick={onShopNow}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4.5 h-4.5" /> Shop Now
            </button>
            <button
              onClick={onApplyMembership}
              className="px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-[#313826] font-semibold shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Users className="w-4.5 h-4.5" /> Apply Membership
            </button>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-2xl sm:text-3xl font-extrabold text-[#313826] dark:text-emerald-400">{memberCount}+</p>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mt-1">Active Members</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-extrabold text-[#313826] dark:text-emerald-400">{products.length}+</p>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mt-1">Farm Products</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-extrabold text-[#313826] dark:text-emerald-400">100%</p>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mt-1">Organic Sourced</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-extrabold text-[#313826] dark:text-emerald-400">Direct</p>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mt-1">Farm-to-Buyer Trade</p>
          </div>
        </div>
      </section>

      {/* Why join - plain icon row (no card chrome), closer to a
          brochure-style feature strip than a grid of shadowed cards */}
      <section className="relative max-w-6xl mx-auto px-6 py-16 overflow-hidden">
        <TreePalm className="hidden sm:block absolute -top-4 right-2 w-28 h-28 text-emerald-100 dark:text-emerald-950/60 -rotate-12 pointer-events-none" />
        <div className="relative text-center max-w-2xl mx-auto space-y-3 mb-12">
          <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Why Coconut Farmers Choose BOCOFAC</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">A member-owned cooperative built on fair trade, shared capital, and continuous agricultural education.</p>
        </div>
        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-10 text-center">
          {WHY_JOIN.map(item => (
            <div key={item.title} className="space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full border-2 border-emerald-600 dark:border-emerald-400 flex items-center justify-center">
                <item.icon className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">{item.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-[220px] mx-auto">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About-style split - dark panel paired with real farm photos,
          instead of the plain full-width CTA banner this copy used to
          sit in on its own */}
      <section className="grid grid-cols-1 lg:grid-cols-2">
        <div className="bg-[#1e2318] text-white px-8 py-16 sm:px-14 flex flex-col justify-center gap-4 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
          <div className="relative w-12 h-12 rounded-full bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center">
            <Sprout className="w-5 h-5 text-emerald-300" />
          </div>
          <h2 className="relative font-serif text-2xl sm:text-3xl font-extrabold leading-tight">Ready to become a BOCOFAC shareholder?</h2>
          <span className="relative w-14 h-1 rounded-full bg-emerald-500" />
          <p className="relative text-emerald-100/80 text-sm leading-relaxed max-w-sm">
            Apply today and attend a free PMES seminar to unlock full membership benefits.
          </p>
          <button
            onClick={onApplyMembership}
            className="relative mt-2 w-fit px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all cursor-pointer flex items-center gap-2"
          >
            Apply Membership <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2">
          <img src={coconutPalms} alt="" className="w-full h-64 lg:h-full object-cover" />
          <img src={coconutSeedlings} alt="" className="w-full h-64 lg:h-full object-cover" />
        </div>
      </section>

      {/* Featured products */}
      {featuredProducts.length > 0 && (
        <section className="bg-[#faf8f4] dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-6 py-16 space-y-10">
            <div className="text-center space-y-2">
              <p className="text-xs font-mono uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold">Marketplace</p>
              <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Popular Coconut Products</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {featuredProducts.map(product => (
                <div
                  key={product.id}
                  onClick={onShopNow}
                  className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden hover-lift cursor-pointer group"
                >
                  <div className="relative h-40 overflow-hidden bg-slate-100 dark:bg-slate-950">
                    <img
                      src={resolveImageUrl(product.image)}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute -bottom-3 right-3 w-9 h-9 rounded-lg bg-amber-500 shadow-md flex flex-col items-center justify-center text-white leading-none">
                      <Star className="w-3 h-3 fill-white" />
                      <span className="text-[10px] font-bold mt-0.5">{product.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="p-4 pt-5 space-y-1 text-left">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">{product.name}</h3>
                    <p className="text-emerald-800 dark:text-emerald-400 font-extrabold">₱{product.price.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={onShopNow}
                className="px-6 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 transition cursor-pointer inline-flex items-center gap-1.5"
              >
                View More <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Gallery - real cooperative + marketplace photos in an asymmetric
          grid (one large photo, two smaller ones stacked beside it) */}
      <section className="bg-[#faf8f4] dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-16 space-y-10">
          <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white text-center">Our Gallery</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <img src={galleryCoirProducts} alt="" className="w-full h-64 sm:h-full rounded-xl object-cover" />
            <div className="grid grid-cols-2 gap-3">
              <img src={galleryCoconutShells} alt="" className="col-span-2 w-full h-32 rounded-xl object-cover" />
              <img src={galleryCoconutHusk} alt="" className="w-full h-28 rounded-xl object-cover" />
              <img src={galleryShellBriquettes} alt="" className="w-full h-28 rounded-xl object-cover" />
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
