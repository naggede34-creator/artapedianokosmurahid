"use client";

import { useEffect, useState } from "react";

const TIER_STYLES = {
  Bronze:  { bg: "from-amber-800/30 to-amber-600/10", ring: "ring-amber-600",   text: "text-amber-700 dark:text-amber-400",  emoji: "🥉", particles: ["🎉","✨","⭐","🎊","🔥"] },
  Silver:  { bg: "from-gray-400/30 to-gray-200/10",   ring: "ring-gray-400",    text: "text-gray-500",                        emoji: "🥈", particles: ["⭐","✨","💫","🌟","🎊"] },
  Gold:    { bg: "from-yellow-400/30 to-amber/10",    ring: "ring-yellow-400",  text: "text-yellow-600 dark:text-yellow-400", emoji: "🥇", particles: ["⭐","🌟","✨","🎊","💛"] },
  Diamond: { bg: "from-cyan-300/30 to-blue-300/10",   ring: "ring-cyan-400",    text: "text-cyan-500",                        emoji: "💎", particles: ["💎","✨","💫","🌟","⚡"] },
};

export default function LevelUpModal({ token, onClose }) {
  const [data, setData] = useState(null);
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/levelup-check?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.leveledUp) {
          setData(d);
          setParticles(Array.from({ length: 30 }, (_, i) => ({ id: i, x: Math.random() * 100, delay: Math.random() * 1 })));
        }
      });
  }, [token]);

  async function dismiss() {
    await fetch("/api/levelup-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setData(null);
    onClose?.();
  }

  if (!data) return null;

  const style = TIER_STYLES[data.tier.name] || TIER_STYLES.Bronze;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <style>{`
        @keyframes confettiFall { from { transform: translateY(-20px) rotate(0deg); opacity: 1; } to { transform: translateY(110vh) rotate(540deg); opacity: 0; } }
        @keyframes tierPop { 0% { transform: scale(0) rotate(-10deg); opacity: 0; } 50% { transform: scale(1.2) rotate(3deg); } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
        @keyframes shine { 0%,100% { background-position: -200% center; } 50% { background-position: 200% center; } }
        @keyframes bounceIn { 0%{transform:scale(0.3);opacity:0} 60%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
      `}</style>

      {particles.map((p) => {
        const icon = style.particles[p.id % style.particles.length];
        return (
          <div key={p.id} className="pointer-events-none fixed top-0 text-xl" style={{ left: `${p.x}%`, animation: `confettiFall ${1.5 + Math.random()}s ${p.delay}s ease-in forwards` }}>
            {icon}
          </div>
        );
      })}

      <div className={`relative w-full max-w-sm rounded-3xl overflow-hidden bg-bg border-2 ${style.ring} shadow-2xl`}
           style={{ animation: "bounceIn 0.6s cubic-bezier(0.34,1.56,0.64,1) both" }}>
        {/* Gradient bg */}
        <div className={`absolute inset-0 bg-gradient-to-br ${style.bg} pointer-events-none`} />

        <div className="relative p-8 text-center">
          {/* Tier badge */}
          <div className="mb-4 flex justify-center">
            <div className={`rounded-2xl ring-4 ${style.ring} p-2 bg-bg shadow-xl`}
                 style={{ animation: "tierPop 0.7s 0.3s cubic-bezier(0.34,1.56,0.64,1) both", opacity: 0 }}>
              <span className="text-6xl leading-none block">{style.emoji}</span>
            </div>
          </div>

          <div className="mb-2">
            <p className="text-xs font-bold text-muted uppercase tracking-widest">Level Naik!</p>
            <h2 className={`mt-1 text-3xl font-extrabold ${style.text}`}>{data.tier.name}</h2>
          </div>

          {data.prevTier && (
            <p className="text-sm text-muted mb-4">
              {data.prevTier.emoji} {data.prevTier.name} → <span className={`font-bold ${style.text}`}>{data.tier.emoji} {data.tier.name}</span>
            </p>
          )}

          <div className="rounded-2xl bg-surface p-4 mb-6 text-left space-y-2">
            <p className="text-xs font-extrabold text-muted uppercase tracking-wide mb-3">Keuntungan {data.tier.name}</p>
            {data.tier.name === "Bronze"  && <BenefitList items={["Akses semua fitur dasar","Poin x1.0","Spin wheel harian"]} />}
            {data.tier.name === "Silver"  && <BenefitList items={["Poin x1.2","Diskon lucky hour +1%","Mystery box lebih sering"]} />}
            {data.tier.name === "Gold"    && <BenefitList items={["Poin x1.5","Diskon lucky hour +2%","Flash sale eksklusif","Prioritas CS"]} />}
            {data.tier.name === "Diamond" && <BenefitList items={["Poin x2.0","Diskon lucky hour +5%","VIP flash sale","CS 24/7 prioritas","Mystery box langka"]} />}
          </div>

          <button
            onClick={dismiss}
            className={`w-full rounded-2xl py-3.5 text-sm font-extrabold text-white press shadow-lg`}
            style={{ background: `var(--c-amber)` }}
          >
            🎉 Terima kasih! Lanjutkan
          </button>
        </div>
      </div>
    </div>
  );
}

function BenefitList({ items }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2 text-xs text-ink">
          <span className="text-success font-bold">✓</span>
          {item}
        </li>
      ))}
    </ul>
  );
}
