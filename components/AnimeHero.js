"use client";

import { useEffect, useState } from "react";

const DEFAULT_CHARS = [
  { emoji: "🥷", name: "Gojo",   accent: "#818cf8", glow: "#6366f1", sub: "Infinite Nokos ✨",             line: "Dengan mata tak terbatas... aku melihat nokos paling murah!" },
  { emoji: "⚡", name: "Shadow", accent: "#fcd34d", glow: "#f59e0b", sub: "Shadow Clone OTP 🌀",           line: "Seribu bayangan... semua beli OTP di Artapedia!" },
  { emoji: "🤖", name: "Cyber",  accent: "#2dd4bf", glow: "#14b8a6", sub: 'System.execute("buy_nokos") 💻', line: "Sistem optimal: nokos cepat, harga minimal, proses instan!" },
  { emoji: "🌸", name: "Aria",   accent: "#fb7185", glow: "#f43f5e", sub: "Magic Bonus ✦ +EXP",            line: "Abrakadabra! Saldo kamu bertambah dengan tiap transaksi bersama ku~" },
];

export default function AnimeHero() {
  const [chars, setChars]         = useState(DEFAULT_CHARS);
  const [idx, setIdx]             = useState(0);
  const [animating, setAnimating] = useState(false);
  const [burstKey, setBurstKey]   = useState(0);

  // Fetch admin-customized chars, fallback silently to defaults
  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.heroChars) && d.heroChars.length > 0) setChars(d.heroChars);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (chars.length <= 1) return;
    const t = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setIdx((i) => (i + 1) % chars.length);
        setBurstKey((k) => k + 1);
        setAnimating(false);
      }, 320);
    }, 4200);
    return () => clearInterval(t);
  }, [chars.length]);

  function switchTo(i) {
    if (i === idx) return;
    setAnimating(true);
    setTimeout(() => {
      setIdx(i);
      setBurstKey((k) => k + 1);
      setAnimating(false);
    }, 320);
  }

  const char = chars[idx] || DEFAULT_CHARS[0];

  return (
    <div className="relative overflow-hidden rounded-3xl p-5"
      style={{
        minHeight: 170,
        background: "linear-gradient(135deg, #0a0f1e 0%, #0d1530 50%, #120829 100%)",
        border: `2px solid ${char.accent}30`,
        boxShadow: `4px 4px 0 #000, 0 0 40px ${char.glow}40`,
        transition: "box-shadow 0.5s, border-color 0.5s",
      }}>

      {/* Halftone manga pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{
        backgroundImage: "radial-gradient(circle, white 0.7px, transparent 0.7px)",
        backgroundSize: "9px 9px",
      }} />

      {/* Speed lines */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: "repeating-linear-gradient(85deg, transparent 0px, transparent 18px, rgba(255,255,255,0.9) 18px, rgba(255,255,255,0.9) 19px)",
      }} />

      {/* Scan lines */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.8) 0px, rgba(0,0,0,0.8) 1px, transparent 1px, transparent 3px)",
      }} />

      {/* Action burst on character switch */}
      <div key={burstKey} className="pointer-events-none absolute -right-6 -top-6 w-44 h-44"
        style={{ opacity: 0, animation: "burst-in 0.5s ease-out forwards" }}>
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <div key={deg} className="absolute top-1/2 left-1/2 h-px w-24 origin-left"
            style={{ transform: `rotate(${deg}deg)`, background: char.glow + "60" }} />
        ))}
      </div>

      {/* Accent bar top */}
      <div className="absolute top-0 left-6 right-6 h-0.5 rounded-b-full"
        style={{ background: `linear-gradient(90deg, transparent, ${char.accent}, transparent)`, opacity: 0.7 }} />

      {/* Character + speech bubble */}
      <div className={`flex items-center gap-4 transition-all duration-300 ${animating ? "opacity-0 scale-95 translate-x-3" : "opacity-100 scale-100 translate-x-0"}`}>
        {/* Avatar */}
        <div className="shrink-0 relative">
          <div className="w-[78px] h-[78px] rounded-2xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${char.glow}30, ${char.glow}15)`,
              border: `2px solid ${char.accent}50`,
              boxShadow: `0 0 24px ${char.glow}60, 4px 4px 0 rgba(0,0,0,0.6)`,
              animation: "char-float 3s ease-in-out infinite",
            }}>
            <span className="text-4xl select-none">{char.emoji}</span>
          </div>
          {/* Name badge */}
          <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest backdrop-blur"
            style={{ background: `${char.glow}30`, border: `1px solid ${char.accent}40`, color: char.accent }}>
            {char.name}
          </span>
          {/* Glow ring */}
          <div className="absolute -inset-1 rounded-3xl pointer-events-none"
            style={{ background: `radial-gradient(circle, ${char.glow}30 0%, transparent 70%)` }} />
        </div>

        {/* Speech bubble */}
        <div className="flex-1 relative">
          {/* Tail */}
          <div className="absolute -left-3 top-5 w-0 h-0" style={{
            borderTop: "6px solid transparent",
            borderBottom: "6px solid transparent",
            borderRight: `10px solid ${char.accent}30`,
          }} />
          <div className="rounded-2xl rounded-tl-none px-4 py-3 backdrop-blur-sm"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${char.accent}25`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 2px 2px 0 rgba(0,0,0,0.4)`,
            }}>
            <p className="text-[11px] font-black uppercase tracking-widest mb-1"
              style={{ color: char.accent }}>
              {char.sub}
            </p>
            <p className="text-sm font-bold leading-snug text-white/90">{char.line}</p>
          </div>
        </div>
      </div>

      {/* Dot nav */}
      <div className="mt-4 flex justify-center items-center gap-2">
        {chars.map((c, i) => (
          <button key={i} onClick={() => switchTo(i)}
            className="transition-all duration-300"
            style={{
              height: 6,
              width: i === idx ? 24 : 6,
              borderRadius: 99,
              background: i === idx ? c.accent : "rgba(255,255,255,0.2)",
              boxShadow: i === idx ? `0 0 8px ${c.glow}` : "none",
            }}
          />
        ))}
      </div>

      {/* HOT stamp */}
      <div className="absolute top-3 right-3 rotate-12">
        <div className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur"
          style={{
            border: `2px solid ${char.accent}60`,
            background: `${char.glow}20`,
            color: char.accent,
          }}>
          🔥 HOT
        </div>
      </div>

      <style>{`
        @keyframes burst-in {
          0%   { opacity: 0.3; transform: scale(0.6); }
          60%  { opacity: 0.15; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
