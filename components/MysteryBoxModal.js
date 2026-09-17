"use client";

import { useState, useEffect } from "react";

const PRIZE_TIERS = {
  empty:  { glow: "",                  stars: 0, rarity: "",          bg: "bg-surface2"           },
  bronze: { glow: "shadow-amber/30",   stars: 1, rarity: "Biasa",     bg: "bg-amber-soft"         },
  silver: { glow: "shadow-slate-300/50",stars: 2, rarity: "Langka",   bg: "bg-slate-100"          },
  gold:   { glow: "shadow-amber/60",   stars: 3, rarity: "Keren!",    bg: "bg-amber/10"           },
  rare:   { glow: "shadow-purple-400/60",stars: 4, rarity: "LANGKA!!", bg: "bg-purple-50"          },
};

function getPrizeTier(prize) {
  if (!prize || prize.type === "empty") return "empty";
  if (prize.type === "poin") {
    if (prize.value >= 200) return "gold";
    if (prize.value >= 100) return "silver";
    return "bronze";
  }
  if (prize.type === "saldo") {
    if (prize.value >= 2000) return "rare";
    if (prize.value >= 1000) return "gold";
    if (prize.value >= 500) return "silver";
    return "bronze";
  }
  return "bronze";
}

function Stars({ count }) {
  return (
    <div className="flex items-center justify-center gap-1 my-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <span key={i} className={`text-base transition-all ${i < count ? "text-amber" : "text-surface2"}`}>★</span>
      ))}
    </div>
  );
}

function Particle({ style }) {
  return <div className="absolute w-2 h-2 rounded-full pointer-events-none" style={style} />;
}

function Confetti({ active }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!active) return;
    const colors = ["#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#3b82f6", "#ec4899"];
    const list = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      background: colors[Math.floor(Math.random() * colors.length)],
      width: `${4 + Math.random() * 8}px`,
      height: `${4 + Math.random() * 8}px`,
      borderRadius: Math.random() > 0.5 ? "50%" : "2px",
      animation: `confettiFall ${0.8 + Math.random() * 1.2}s ease-out forwards`,
      animationDelay: `${Math.random() * 0.5}s`,
      top: "-10px",
    }));
    setParticles(list);
    const t = setTimeout(() => setParticles([]), 2500);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
      {particles.map((p) => <Particle key={p.id} style={p} />)}
    </div>
  );
}

export default function MysteryBoxModal({ open, onClose, token, orderId }) {
  const [phase, setPhase] = useState("idle"); // idle | shaking | opening | revealed
  const [prize, setPrize] = useState(null);
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);

  async function openBox() {
    if (phase !== "idle") return;
    setShake(true);
    setPhase("shaking");
    setErr("");

    setTimeout(async () => {
      setShake(false);
      setPhase("opening");
      try {
        const res = await fetch("/api/mystery-box", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, orderId }),
        });
        const d = await res.json();
        if (!res.ok) { setErr(d.error || "Gagal buka kotak."); setPhase("idle"); return; }
        setTimeout(() => { setPrize(d); setPhase("revealed"); }, 800);
      } catch {
        setErr("Gagal menghubungi server."); setPhase("idle");
      }
    }, 700);
  }

  function handleClose() {
    setPhase("idle"); setPrize(null); setErr(""); setShake(false);
    onClose();
  }

  if (!open) return null;

  const tier = prize ? getPrizeTier(prize.prize) : "bronze";
  const tierStyle = PRIZE_TIERS[tier];
  const isWin = prize?.prize?.type !== "empty";

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
        }
        @keyframes boxShake {
          0%,100% { transform: translateX(0) rotate(0deg); }
          15%      { transform: translateX(-10px) rotate(-6deg); }
          30%      { transform: translateX(10px)  rotate(6deg); }
          45%      { transform: translateX(-8px)  rotate(-4deg); }
          60%      { transform: translateX(8px)   rotate(4deg); }
          75%      { transform: translateX(-4px)  rotate(-2deg); }
          90%      { transform: translateX(4px)   rotate(2deg); }
        }
        @keyframes revealPop {
          0%   { transform: scale(0.3) rotate(-10deg); opacity: 0; }
          60%  { transform: scale(1.15) rotate(3deg);  opacity: 1; }
          80%  { transform: scale(0.95) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg);     opacity: 1; }
        }
        @keyframes glowPulse {
          0%,100% { box-shadow: 0 0 20px 4px rgb(245 158 11 / 0.4); }
          50%      { box-shadow: 0 0 40px 10px rgb(245 158 11 / 0.7); }
        }
        @keyframes spinnerDots {
          0%,80%,100% { transform: scale(0); opacity:0.3; }
          40%          { transform: scale(1); opacity:1;   }
        }
        .box-shake { animation: boxShake 0.7s ease-in-out; }
        .reveal-pop { animation: revealPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
        .glow-gold { animation: glowPulse 1.5s ease-in-out infinite; }
      `}</style>

      <div
        className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: "rgb(0 0 0 / 0.75)", backdropFilter: "blur(4px)" }}
      >
        <div className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-surface overflow-hidden shadow-2xl">
          <Confetti active={phase === "revealed" && isWin} />

          {/* Decorative top bar */}
          <div className={`h-1.5 w-full ${isWin && phase === "revealed" ? "bg-gradient-to-r from-amber via-rose to-amber animate-pulse" : "bg-amber"}`} />

          <div className="p-7 text-center">

            {/* ── IDLE ── */}
            {phase === "idle" && (
              <div className="space-y-4">
                <div className="relative inline-block">
                  <div className="text-7xl leading-none select-none">🎁</div>
                  <div className="absolute -top-1 -right-1 text-2xl animate-bounce">✨</div>
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-ink tracking-tight">Kotak Misteri!</h2>
                  <p className="text-sm text-muted mt-1.5 leading-relaxed">
                    Selamat sudah beli nokos! Kamu dapat<br />
                    <span className="font-bold text-ink">1 kotak hadiah acak</span> — buka sekarang?
                  </p>
                </div>
                {err && (
                  <div className="rounded-xl bg-rose-soft border border-rose/30 px-4 py-2.5 text-xs font-semibold text-rose">
                    ⚠️ {err}
                  </div>
                )}
                <div className="rounded-xl border border-line bg-surface2 p-3 text-left">
                  <p className="text-[11px] font-bold text-muted mb-2 uppercase tracking-wide">Kemungkinan isi:</p>
                  <div className="grid grid-cols-2 gap-1.5 text-xs text-muted">
                    <span>💰 Saldo Rp500</span>
                    <span>💵 Saldo Rp1.000</span>
                    <span>💸 Saldo Rp2.000</span>
                    <span>⭐ 50–200 Poin</span>
                  </div>
                </div>
                <button
                  onClick={openBox}
                  className="w-full rounded-2xl bg-gradient-to-r from-amber to-amber-bright py-3.5 text-sm font-extrabold text-white press shadow-lg shadow-amber/30"
                >
                  🎊 Buka Kotak Sekarang!
                </button>
                <button onClick={handleClose} className="w-full text-xs text-muted py-1.5 hover:text-ink">
                  Lewati
                </button>
              </div>
            )}

            {/* ── SHAKING ── */}
            {phase === "shaking" && (
              <div className="py-6 space-y-4">
                <div className={`text-7xl leading-none select-none inline-block box-shake`}>🎁</div>
                <p className="text-sm font-bold text-ink">Sedang dikocok...</p>
                <p className="text-xs text-muted">Siap-siap ya!</p>
              </div>
            )}

            {/* ── OPENING ── */}
            {phase === "opening" && (
              <div className="py-6 space-y-4">
                <div className="inline-flex gap-2 justify-center">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-full bg-amber"
                      style={{ animation: `spinnerDots 1.2s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </div>
                <p className="text-sm font-bold text-ink">Membuka kotak...</p>
              </div>
            )}

            {/* ── REVEALED ── */}
            {phase === "revealed" && prize && (
              <div className="space-y-4">
                {/* Prize icon */}
                <div className={`relative inline-flex h-24 w-24 items-center justify-center rounded-2xl mx-auto reveal-pop
                  ${tierStyle.bg} ${tier === "gold" || tier === "rare" ? "glow-gold" : ""}`}>
                  <span className="text-5xl">{prize.prize.icon}</span>
                </div>

                {/* Stars */}
                <Stars count={tierStyle.stars} />

                {/* Title */}
                <div>
                  {tierStyle.rarity && (
                    <span className={`text-[11px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full
                      ${tier === "rare" ? "bg-purple-100 text-purple-600" : "bg-amber/20 text-amber-bright"}`}>
                      {tierStyle.rarity}
                    </span>
                  )}
                  <h2 className="text-xl font-extrabold text-ink mt-2">{prize.prize.label}</h2>
                </div>

                {/* Reward card */}
                {isWin ? (
                  <div className={`rounded-2xl border p-4 ${tier === "rare" ? "border-purple-200 bg-purple-50/50" : "border-amber/30 bg-amber-soft"}`}>
                    <p className="text-xs text-muted mb-1">
                      {prize.prize.type === "saldo" ? "Saldo ditambahkan" : "Poin ditambahkan"}
                    </p>
                    <p className={`text-3xl font-extrabold ${tier === "rare" ? "text-purple-600" : "text-amber-bright"}`}>
                      {prize.prize.type === "saldo"
                        ? `+Rp${Number(prize.prize.value).toLocaleString("id-ID")}`
                        : `+${prize.prize.value} Poin`}
                    </p>
                    <p className="text-xs text-muted mt-1">Langsung masuk ke akun kamu 🎉</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-line bg-surface2 p-4">
                    <p className="text-sm text-muted">Sayang, kali ini belum beruntung.</p>
                    <p className="text-xs text-muted/70 mt-1">Coba lagi di pembelian berikutnya!</p>
                  </div>
                )}

                <button
                  onClick={handleClose}
                  className={`w-full rounded-2xl py-3.5 text-sm font-extrabold text-white press shadow-lg
                    ${isWin
                      ? tier === "rare"
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 shadow-purple-300/40"
                        : "bg-gradient-to-r from-amber to-amber-bright shadow-amber/30"
                      : "bg-surface2 !text-ink"}`}
                >
                  {isWin ? "Seru banget! Tutup ✨" : "Tutup"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
