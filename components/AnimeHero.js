"use client";

import { useEffect, useState } from "react";

const CHARS = [
  {
    id: "gojo",
    name: "Gojo",
    emoji: "🥷",
    color: "from-indigo-600 to-violet-700",
    glow: "shadow-[0_0_30px_rgba(99,102,241,0.6)]",
    line: "Dengan mata tak terbatas... aku melihat nokos paling murah!",
    sub: "Infinite Nokos ✨"
  },
  {
    id: "ninja",
    name: "Shadow",
    emoji: "⚡",
    color: "from-amber-500 to-orange-600",
    glow: "shadow-[0_0_30px_rgba(251,191,36,0.6)]",
    line: "Seribu bayangan... semua beli OTP di Artapedia!",
    sub: "Shadow Clone OTP 🌀"
  },
  {
    id: "cyber",
    name: "Cyber",
    emoji: "🤖",
    color: "from-teal-500 to-cyan-600",
    glow: "shadow-[0_0_30px_rgba(20,184,166,0.6)]",
    line: "Sistem optimal: nokos cepat, harga minimal, proses instan!",
    sub: "System.execute(\"buy_nokos\") 💻"
  }
];

export default function AnimeHero() {
  const [idx, setIdx] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setIdx((i) => (i + 1) % CHARS.length);
        setAnimating(false);
      }, 300);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const char = CHARS[idx];

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-indigo-500/30 bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 p-5 shadow-2xl" style={{ minHeight: 160 }}>
      {/* Halftone manga pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{
        backgroundImage: "radial-gradient(circle, white 0.8px, transparent 0.8px)",
        backgroundSize: "10px 10px"
      }} />

      {/* Speed lines */}
      <div className="pointer-events-none absolute inset-0 opacity-10" style={{
        backgroundImage: "repeating-linear-gradient(85deg, transparent 0px, transparent 18px, rgba(255,255,255,0.8) 18px, rgba(255,255,255,0.8) 19px)"
      }} />

      {/* Comic action burst */}
      <div className="pointer-events-none absolute -right-8 -top-8 w-48 h-48 opacity-10">
        {[0,45,90,135,180,225,270,315].map(deg => (
          <div key={deg} className="absolute top-1/2 left-1/2 h-1 w-24 origin-left bg-white"
            style={{ transform: `rotate(${deg}deg)` }} />
        ))}
      </div>

      <div className={`flex items-center gap-4 transition-all duration-300 ${animating ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}`}>
        {/* Character avatar */}
        <div className={`shrink-0 relative w-20 h-20 rounded-2xl bg-gradient-to-br ${char.color} ${char.glow} flex items-center justify-center border-2 border-white/20 char-float`}>
          <span className="text-4xl">{char.emoji}</span>
          {/* Character name badge */}
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/20 backdrop-blur px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
            {char.name}
          </span>
        </div>

        {/* Speech bubble */}
        <div className="flex-1 relative">
          {/* Bubble tail */}
          <div className="absolute -left-3 top-5 w-0 h-0" style={{
            borderTop: "5px solid transparent",
            borderBottom: "5px solid transparent",
            borderRight: "10px solid rgba(255,255,255,0.15)"
          }} />
          <div className="rounded-2xl rounded-tl-none border border-white/20 bg-white/10 backdrop-blur px-4 py-3">
            <p className="text-xs font-black uppercase tracking-widest text-amber-300 mb-1">{char.sub}</p>
            <p className="text-sm font-bold leading-snug text-white">{char.line}</p>
          </div>
        </div>
      </div>

      {/* Character dots */}
      <div className="mt-4 flex justify-center gap-1.5">
        {CHARS.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-amber-400" : "w-1.5 bg-white/30"}`}
          />
        ))}
      </div>

      {/* Comic-style "BELI SEKARANG" stamp */}
      <div className="absolute top-3 right-3 rotate-12">
        <div className="rounded-full border-2 border-amber-400 bg-amber-400/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300 backdrop-blur">
          🔥 HOT
        </div>
      </div>
    </div>
  );
}
