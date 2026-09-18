"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function rupiah(v) { return `Rp${Number(v).toLocaleString("id-ID")}`; }

function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [toast, onDone]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-24 sm:bottom-6 left-1/2 z-[100] -translate-x-1/2 px-4 w-full max-w-sm pointer-events-none">
      <div className="flex items-center gap-3 rounded-2xl bg-ink text-bg shadow-2xl px-4 py-3.5 animate-[toastIn_0.4s_cubic-bezier(0.34,1.56,0.64,1)_both]">
        <span className="text-2xl shrink-0">{toast.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">{toast.title}</p>
          <p className="text-xs opacity-70 mt-0.5">{toast.body}</p>
        </div>
        {toast.reward && (
          <div className="shrink-0 rounded-lg bg-amber px-2.5 py-1 text-xs font-extrabold text-white">
            {toast.reward}
          </div>
        )}
      </div>
      <style>{`
        @keyframes toastIn {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function MissionCard({ m, onClaim }) {
  const pct = Math.min(100, Math.round(((m.progress || 0) / m.target) * 100));
  const done = m.completed && !m.claimed;
  const claimed = m.claimed;

  return (
    <div className={`rounded-2xl border p-4 transition-all duration-300 relative overflow-hidden
      ${done ? "border-amber bg-amber-soft/60 shadow-sm shadow-amber/20" : claimed ? "border-line bg-surface opacity-70" : "border-line bg-surface"}`}>

      {done && (
        <div className="absolute top-0 right-0 text-[9px] font-extrabold bg-amber text-white px-2.5 py-1 rounded-bl-xl tracking-wide">
          SIAP KLAIM
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`relative shrink-0 flex h-11 w-11 items-center justify-center rounded-xl text-2xl
          ${done ? "bg-amber/20" : claimed ? "bg-surface2 grayscale" : "bg-surface2"}`}>
          {m.icon}
          {claimed && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-success/20">
              <span className="text-sm text-success font-bold">✓</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className={`text-sm font-bold leading-tight ${claimed ? "text-muted line-through" : "text-ink"}`}>
              {m.title}
            </p>
            <span className={`shrink-0 text-[11px] font-extrabold px-2 py-0.5 rounded-lg whitespace-nowrap
              ${done ? "bg-amber text-white" : claimed ? "bg-success/15 text-success" : "bg-surface2 text-muted"}`}>
              {m.reward.type === "saldo" ? `+${rupiah(m.reward.amount)}` : `+${m.reward.amount} poin`}
            </span>
          </div>
          <p className="text-xs text-muted leading-relaxed">{m.desc}</p>

          {/* Progress */}
          <div className="mt-2.5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-muted">Progress</span>
              <span className="text-[10px] font-bold tabular-nums text-ink">{m.progress}/{m.target}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500
                  ${pct >= 100 ? "bg-amber" : pct > 60 ? "bg-amber/80" : pct > 30 ? "bg-amber/60" : "bg-amber/40"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Claim button */}
      {done && (
        <button
          onClick={() => onClaim(m)}
          className="mt-3 w-full rounded-xl bg-gradient-to-r from-amber to-amber-bright py-2.5 text-xs font-extrabold text-white press shadow-md shadow-amber/25"
        >
          🎁 Klaim Hadiah
        </button>
      )}

      {claimed && (
        <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-success">
          <span>✓</span><span>Sudah diklaim</span>
        </div>
      )}
    </div>
  );
}

export default function MissionsPanel({ token }) {
  const [data, setData] = useState(null);
  const [toast, setToast] = useState(null);

  function load() {
    if (!token) return;
    fetch(`/api/missions?token=${token}`).then((r) => r.json()).then(setData);
  }

  useEffect(() => { load(); }, [token]);

  async function claim(m) {
    const res = await fetch("/api/missions/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, missionId: m.id, progress: m.progress }),
    });
    const d = await res.json();
    if (d.ok) {
      const isRp = m.reward.type === "saldo";
      setToast({
        icon: isRp ? "💰" : "⭐",
        title: `Misi "${m.title}" selesai!`,
        body: isRp ? "Saldo langsung masuk ke akun kamu." : "Poin ditambahkan ke loyalitas kamu.",
        reward: isRp ? `+${rupiah(m.reward.amount)}` : `+${m.reward.amount} poin`,
      });
      load();
    } else {
      setToast({
        icon: "⚠️",
        title: "Gagal klaim",
        body: d.error || "Coba lagi sebentar.",
        reward: null,
      });
    }
  }

  const claimableCount = (data?.daily?.filter((m) => m.completed && !m.claimed).length || 0)
    + (data?.weekly?.filter((m) => m.completed && !m.claimed).length || 0);

  return (
    <>
      <Toast toast={toast} onDone={() => setToast(null)} />

      <div className="card p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
              🎯 Misi
              {claimableCount > 0 && (
                <span className="text-[10px] font-extrabold bg-rose text-white px-2 py-0.5 rounded-full animate-pulse">
                  {claimableCount} siap klaim!
                </span>
              )}
            </h2>
            <p className="text-xs text-muted mt-0.5">Selesaikan & klaim hadiah</p>
          </div>
          <Link href="/misi" className="text-xs font-semibold text-amber-bright hover:underline press">
            Lihat semua →
          </Link>
        </div>

        {/* Loading */}
        {!data ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="skeleton h-11 w-11 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-3/4 rounded" />
                  <div className="skeleton h-3 w-full rounded" />
                  <div className="skeleton h-2 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Daily */}
            <div className="mb-1">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[11px] font-extrabold text-muted uppercase tracking-widest">Harian</span>
                <div className="flex-1 h-px bg-line" />
                <span className="text-[10px] text-muted">Reset tiap hari</span>
              </div>
              <div className="space-y-2">
                {data.daily.slice(0, 3).map((m) => (
                  <MissionCard key={m.id} m={m} onClaim={claim} />
                ))}
              </div>
            </div>

            {/* Weekly */}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[11px] font-extrabold text-muted uppercase tracking-widest">Mingguan</span>
                <div className="flex-1 h-px bg-line" />
                <span className="text-[10px] text-muted">Reset Senin</span>
              </div>
              <div className="space-y-2">
                {data.weekly.slice(0, 2).map((m) => (
                  <MissionCard key={m.id} m={m} onClaim={claim} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
