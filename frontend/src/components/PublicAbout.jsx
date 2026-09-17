import React, { useEffect, useRef, useState } from 'react';
import { Sprout, Target, Eye, Users, ShieldCheck, ArrowRight } from 'lucide-react';
import coconutFarmerHero from '../assets/coconut-farmer-hero.jpg';
import coconutSeedlings from '../assets/images-tambo.jpg';
import aboutHeroVideo from '../assets/about-hero-video.mp4';

const HERO_SLIDES = [
  { type: 'video', duration: 8000 },
  { type: 'image', src: coconutSeedlings, caption: 'Nurturing New Growth — member-run coconut nurseries', duration: 4000 },
  { type: 'image', src: coconutFarmerHero, caption: 'Our Farmer-Members at Work', duration: 4000 },
];

export default function PublicAbout({ onApplyMembership }) {
  const videoRef = useRef(null);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const resume = () => {
      video.play().catch(() => {});
    };

    video.addEventListener('pause', resume);
    document.addEventListener('visibilitychange', resume);

    return () => {
      video.removeEventListener('pause', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, HERO_SLIDES[activeSlide].duration);

    return () => clearTimeout(timer);
  }, [activeSlide]);

  return (
    <div className="animate-in fade-in duration-500">

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#1e2318]">
        <div className="relative max-w-6xl mx-auto px-6 py-20 sm:py-28 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold uppercase tracking-wider backdrop-blur">
              <Sprout className="w-3.5 h-3.5" /> About the Cooperative
            </div>
            <h1 className="font-serif text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight">Who We Are</h1>
            <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto lg:mx-0 font-light leading-relaxed">
              BOCOFAC (Coconut Farmers Cooperative) is a member-owned agricultural cooperative dedicated to
              uplifting rural coconut farming communities through fair trade commerce, shared capital, and
              continuous education.
            </p>
          </div>

          <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 aspect-[4/5] max-w-sm mx-auto lg:mx-0">
            {/* Video layer — keeps playing underneath even while a photo is shown */}
            <video
              ref={videoRef}
              src={aboutHeroVideo}
              poster={coconutFarmerHero}
              autoPlay
              loop
              muted
              playsInline
              disablePictureInPicture
              controlsList="nodownload noplaybackrate nofullscreen"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-700"
              style={{
                filter: 'saturate(1.2) contrast(1.1) brightness(1.05)',
                opacity: HERO_SLIDES[activeSlide].type === 'video' ? 1 : 0,
              }}
            />

            {/* Photo layers — cross-fade in on top of the video */}
            {HERO_SLIDES.map((slide, i) =>
              slide.type === 'image' ? (
                <div
                  key={slide.src}
                  className="absolute inset-0 transition-opacity duration-700"
                  style={{ opacity: activeSlide === i ? 1 : 0 }}
                >
                  <img
                    src={slide.src}
                    alt={slide.caption}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-white text-sm font-semibold">{slide.caption}</p>
                  </div>
                </div>
              ) : null
            )}

            {/* Slide indicators */}
            <div className="absolute top-3 right-3 flex gap-1.5 z-10">
              {HERO_SLIDES.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    activeSlide === i ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
                  }`}
                />
              ))}
            </div>

            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="max-w-6xl mx-auto px-6 py-20 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Our Purpose</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">What drives BOCOFAC forward, member by member.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm hover-lift p-8 space-y-4 text-left">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
              <Target className="w-7 h-7 text-emerald-700 dark:text-emerald-400" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-xl">Our Mission</h3>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
              To empower smallholder coconut farmers through a digitally-enabled cooperative marketplace,
              direct-trade partnerships, and transparent share capital management.
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-sm hover-lift p-8 space-y-4 text-left">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
              <Eye className="w-7 h-7 text-amber-700 dark:text-amber-400" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-xl">Our Vision</h3>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
              A thriving, self-sustaining agrarian community where every coconut farmer-member shares equitably
              in the cooperative's growth and prosperity.
            </p>
          </div>
        </div>
      </section>

      {/* Governance & Compliance */}
      <section className="bg-[#FDFCF7] dark:bg-slate-950 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-20 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Governance & Compliance</h2>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">Operated under the Cooperative Development Authority (CDA) with a democratically elected Board of Directors.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center">
                <Users className="w-7 h-7 text-emerald-700 dark:text-emerald-400" />
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white">Member-Owned</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">One member, one vote governance structure.</p>
            </div>
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-emerald-700 dark:text-emerald-400" />
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white">GAAP Compliant</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Audited share capital ledger and financial reporting.</p>
            </div>
            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center">
                <Sprout className="w-7 h-7 text-emerald-700 dark:text-emerald-400" />
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white">Sustainable Farming</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Promoting organic, environmentally sound practices.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="rounded-2xl bg-[#313826] text-white px-8 py-12 sm:px-14 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="text-center sm:text-left space-y-1 relative">
            <h3 className="text-xl sm:text-2xl font-extrabold">Join the Cooperative</h3>
            <p className="text-emerald-200 text-sm">Coconut farmers, copra producers, and agri-artisans are welcome to apply for shareholder membership.</p>
          </div>
          <button
            onClick={onApplyMembership}
            className="relative px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shrink-0 transition-all cursor-pointer flex items-center gap-2"
          >
            Apply for Membership <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

    </div>
  );
}
