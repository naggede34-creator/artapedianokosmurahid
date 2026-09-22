"use client";

import { useEffect, useState, useCallback } from "react";

// Pose config — expressions mapped to states
const POSES = {
  idle: {
    src: "/chars/char-idle.jpg",
    alt: "Karakter anime idle",
    label: "😊"
  },
  angel: {
    src: "/chars/char-angel.jpg",
    alt: "Karakter anime senang",
    label: "😇"
  },
  suit: {
    src: "/chars/char-suit.jpg",
    alt: "Karakter anime serius",
    label: "😤"
  },
  surprised: {
    src: "/chars/char-surprised.jpg",
    alt: "Karakter anime kaget",
    label: "😳"
  }
};

// Dialogues per state
const DIALOGUES = {
  idle: [
    { text: "Haii~ Aku elang Arta Pedia Support! Mau beli nokos hari ini? 🦅", pose: "idle" },
    { text: "Nomor OTP murah meriah ada di sini! Yuk cobain sekarang~ 🛒", pose: "idle" },
    { text: "Aku selalu siap bantuin kamu cari nokos terbaik! 💖", pose: "idle" },
  ],
  low_balance: [
    { text: "H-Hei! Saldo kamu tinggal sedikit...! Cepat isi dulu ya!? 😳", pose: "surprised" },
    { text: "Jangan sampai kehabisan saldo pas butuh OTP! Isi sekarang! 💦", pose: "surprised" },
    { text: "Eh, saldo kamu mepet banget... Deposit dulu dong! 😰", pose: "surprised" },
  ],
  promo: [
    { text: "Psst! Ada Flash Sale sekarang~ Jangan sampai ketinggalan! ⚡", pose: "suit" },
    { text: "Sebagai asisten profesional, aku rekomendasiin beli nokos sekarang! 📋", pose: "suit" },
    { text: "Harga nokos hari ini super terjangkau! Ambil sekarang sebelum habis~ 🎯", pose: "suit" },
    { text: "Kamu udah coba OTP WhatsApp kita? Cepat, murah, terpercaya! ✨", pose: "suit" },
  ],
  success: [
    { text: "Yeay! Transaksinya berhasil! Aku bangga sama kamu~ 🎉", pose: "angel" },
    { text: "OTP udah masuk kan? Kalau ada masalah, aku di sini lho! 💕", pose: "angel" },
    { text: "Makasih udah belanja di Artapedia! Kamu pelanggan terbaik~ 😇", pose: "angel" },
  ],
  welcome: [
    { text: "Selamat datang kembali! Aku udah nunggu kamu~ 🌸", pose: "angel" },
    { text: "Hai! Mau OTP apa hari ini? WhatsApp? Telegram? Semua ada! 👀", pose: "angel" },
  ]
};

// Flatten all dialogues into a sequence
function buildSequence(balance, hasRecentOrder) {
  const lines = [];
  if (balance !== undefined && balance < 2000) {
    lines.push(...DIALOGUES.low_balance);
  }
  if (hasRecentOrder) {
    lines.push(...DIALOGUES.success);
  }
  lines.push(...DIALOGUES.promo, ...DIALOGUES.idle);
  return lines;
}

export default function MangaWaifu({ balance, hasRecentOrder }) {
  const [sequence, setSequence] = useState([]);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [typed, setTyped] = useState("");
  const [typing, setTyping] = useState(false);

  // Build dialogue sequence
  useEffect(() => {
    const seq = buildSequence(balance, hasRecentOrder);
    setSequence(seq);
    setIdx(0);
    setVisible(true);
  }, [balance, hasRecentOrder]);

  const currentLine = sequence[idx] || { text: "Haii~ Aku Arta Pedia Support! Yuk beli nokos~ 🦅", pose: "idle" };
  const pose = POSES[currentLine.pose] || POSES.idle;

  // Typewriter effect
  useEffect(() => {
    if (!currentLine.text) return;
    setTyped("");
    setTyping(true);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setTyped(currentLine.text.slice(0, i));
      if (i >= currentLine.text.length) {
        clearInterval(interval);
        setTyping(false);
      }
    }, 28);
    return () => clearInterval(interval);
  }, [idx, currentLine.text]);

  // Auto-advance every 5s when done typing
  useEffect(() => {
    if (typing || !sequence.length) return;
    const t = setTimeout(() => advance(), 4500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing, idx, sequence.length]);

  const advance = useCallback(() => {
    if (!sequence.length) return;
    setTransitioning(true);
    setTimeout(() => {
      setIdx((i) => (i + 1) % sequence.length);
      setTransitioning(false);
    }, 200);
  }, [sequence.length]);

  function skipTyping() {
    if (typing) {
      setTyped(currentLine.text);
      setTyping(false);
    } else {
      advance();
    }
  }

  if (!visible || !sequence.length) return null;

  return (
    <div
      className="manga-enter relative flex items-end gap-0 overflow-visible cursor-pointer select-none"
      onClick={skipTyping}
      role="button"
      aria-label="Klik untuk lanjut dialog"
      style={{ minHeight: 180 }}
    >
      {/* ── Speech bubble (left side) ── */}
      <div className={`flex-1 relative transition-all duration-200 ${transitioning ? "opacity-0 translate-x-2" : "opacity-100 translate-x-0"}`}>
        {/* Manga panel border */}
        <div className="relative rounded-2xl rounded-br-none border-2 border-slate-800 dark:border-slate-300 bg-white dark:bg-slate-950 shadow-[4px_4px_0_0_rgb(6_14_30)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.15)] p-4">
          {/* Comic halftone top-right */}
          <div className="absolute top-0 right-0 w-16 h-16 rounded-tr-2xl overflow-hidden pointer-events-none opacity-10">
            <div style={{
              width: "100%", height: "100%",
              backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
              backgroundSize: "6px 6px"
            }} />
          </div>

          {/* Character name badge */}
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5">
            <span className="text-xs">{pose.label}</span>
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">ARTA PEDIA SUPPORT</span>
            {typing && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
          </div>

          {/* Dialogue text — typewriter */}
          <p className="text-sm font-bold leading-relaxed text-slate-900 dark:text-slate-100 min-h-[3rem]">
            {typed}
            {typing && <span className="inline-block w-0.5 h-4 bg-slate-800 dark:bg-slate-200 animate-pulse ml-0.5 align-middle" />}
          </p>

          {/* Click hint */}
          {!typing && (
            <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
              <span className="animate-bounce">▼</span>
              <span>Klik untuk lanjut</span>
            </div>
          )}

          {/* Dialogue counter dots */}
          <div className="mt-2 flex gap-1">
            {sequence.slice(0, Math.min(sequence.length, 8)).map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all ${i === idx % Math.min(sequence.length, 8) ? "w-4 bg-amber-400" : "w-1.5 bg-slate-200 dark:bg-slate-700"}`}
              />
            ))}
          </div>
        </div>

        {/* Bubble tail pointing right */}
        <div className="absolute -right-4 bottom-6 w-0 h-0"
          style={{
            borderTop: "8px solid transparent",
            borderBottom: "8px solid transparent",
            borderLeft: "16px solid rgb(6 14 30)"
          }}
        />
        <div className="absolute -right-[13px] bottom-[7px] w-0 h-0"
          style={{
            borderTop: "7px solid transparent",
            borderBottom: "7px solid transparent",
            borderLeft: "14px solid white"
          }}
        />
      </div>

      {/* ── Character image (right side) ── */}
      <div
        className={`shrink-0 relative transition-all duration-200 ${transitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
        style={{ width: 130, height: 180, marginLeft: 8 }}
      >
        {/* White base to support multiply blend */}
        <div className="absolute inset-0 rounded-t-2xl bg-white" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={pose.src}
          src={pose.src}
          alt={pose.alt}
          className="relative w-full h-full object-cover object-top rounded-t-2xl"
          style={{
            mixBlendMode: "multiply",
            filter: "contrast(1.05) saturate(1.1)",
          }}
          draggable={false}
        />
        {/* Bottom fade to blend with page */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/80 dark:from-slate-950/80 to-transparent pointer-events-none rounded-b-2xl" />
      </div>
    </div>
  );
}
