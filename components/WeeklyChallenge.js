"use client";

import { useEffect, useState } from "react";

function CelebrationOverlay({ show, reward, onDone }) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [show, onDone]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none">
      <div className="relative flex flex-col items-center gap-3 animate-[celebPop_0.5s_cubic-bezier(0.34,1.56,0.64,1)_both]">
        <div className="text-6xl">🏆</div>
        <div className="rounded-2xl bg-amber px-8 py-4 shadow-2xl text-center">
          <p className="text-white/80 text-sm font-semibold">Tantangan Selesai!</p>
          <p className="text-white text-3xl font-extrabold">
            +Rp{Number(reward).toLocaleString("id-ID")}
          </p>
          <p className="text-white/80 text-xs mt-1">masuk ke saldo kamu 🎉</p>
        </div>
      </div>
      <style>{`
        @keyframes celebPop {
          0%   { transform: scale(0.3) translateY(40px); opacity:0; }
          60%  { transform: scale(1.1) translateY(-5px); opacity:1; }
          100% { transform: scale(1)   translateY(0);    opacity:1; }
        }
      `}</style>
    </div>
  );
}

const MILESTONES = [0, 3, 6, 10];

export default function WeeklyChallenge({ token }) {
  const [data, setData] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: true });
  const [celebrate, setCelebrate] = useState(false);
  const [celebReward, setCelebReward] = useState(0);

  function load() {
    if (!token) return;
    fetch(`/api/challenge?token=${token}`).then((r) => r.json()).then(setData);
  }

  useEffect(() => { load(); }, [token]);

  async function claim() {
    setClaiming(true);
    const res = await fetch("/api/challenge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const d = await res.json();
    setClaiming(false);
    if (d.ok) {
      setCelebReward(d.reward);
      setCelebrate(true);
      setMsg({ text: `🏆 Berhasil! Rp${Number(d.reward).toLocaleString("id-ID")} masuk ke saldo.`, ok: true });
      load();
    } else {
      setMsg({ text: d.error || "Gagal klaim.", ok: false });
    }
    setTimeout(() => setMsg({ text: "", ok: true }), 5000);
  }

  if (!data) {
    return (
      <div className="card p-5 space-y-3">
        <div className="skeleton h-5 w-40 rounded" />
        <div className="skeleton h-3 w-28 rounded" />
        <div className="skeleton h-4 rounded-full" />
        <div className="skeleton h-10 rounded-xl" />
      </div>
    );
  }

  const pct = data.percent;
  const days = Math.max(0, Math.ceil((new Date(data.endsAt) - Date.now()) / 86400000));
  const hours = Math.max(0, Math.ceil((new Date(data.endsAt) - Date.now()) / 3600000));

  return (
    <>
      <CelebrationOverlay show={celebrate} reward={celebReward} onDone={() => setCelebrate(false)} />

      <div className={`card p-5 relative overflow-hidden transition-all duration-300
        ${data.completed && !data.claimed ? "border-amber shadow-lg shadow-amber/10" : ""}`}>

        {/* Glow background when claimable */}
        {data.completed && !data.claimed && (
          <div className="absolute inset-0 bg-gradient-to-br from-amber/5 to-transparent pointer-events-none" />
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <h2 className="text-base font-extrabold text-ink">Tantangan Mingguan</h2>
              {data.completed && !data.claimed && (
                <span className="text-[10px] font-bold bg-amber text-white px-2 py-0.5 rounded-full animate-pulse">
                  Selesai!
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5 ml-7">
              {days > 0
                ? `Berakhir dalam ${days} hari${days === 1 ? ` (${hours} jam)` : ""}`
                : hours > 0 ? `Berakhir dalam ${hours} jam` : "Berakhir hari ini"}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted font-medium">Total hadiah</p>
            <p className="text-lg font-extrabold text-amber-bright leading-tight">
              Rp{Number(data.reward).toLocaleString("id-ID")}
            </p>
          </div>
        </div>

        {/* Progress stats */}
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-xs text-muted">Nokos minggu ini</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-extrabold tabular-nums text-ink">{data.current}</span>
              <span className="text-sm text-muted font-medium">/ {data.target}</span>
            </div>
          </div>
          <span className={`text-sm font-bold tabular-nums ${pct >= 100 ? "text-amber-bright" : "text-muted"}`}>
            {pct}%
          </span>
        </div>

        {/* Progress bar with milestones */}
        <div className="relative mb-4">
          <div className="h-3 rounded-full bg-surface2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out
                ${pct >= 100
                  ? "bg-gradient-to-r from-amber to-amber-bright"
                  : "bg-gradient-to-r from-amber/70 to-amber"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* Milestone markers */}
          <div className="absolute inset-0 flex items-center pointer-events-none">
            {MILESTONES.slice(1, -1).map((ms) => {
              const pos = (ms / data.target) * 100;
              const reached = data.current >= ms;
              return (
                <div key={ms} className="absolute flex flex-col items-center" style={{ left: `${pos}%`, transform: "translateX(-50%)" }}>
                  <div className={`h-3 w-0.5 ${reached ? "bg-white/60" : "bg-muted/30"}`} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Milestone badges */}
        <div className="flex justify-between mb-4 -mt-2">
          {MILESTONES.map((ms) => {
            const reached = data.current >= ms;
            return (
              <div key={ms} className="flex flex-col items-center gap-0.5">
                <div className={`h-2.5 w-2.5 rounded-full border-2 transition-all
                  ${ms === 0 ? "bg-amber border-amber" : reached ? "bg-amber border-amber" : "bg-surface border-line"}`} />
                <span className={`text-[10px] font-bold tabular-nums ${reached ? "text-amber-bright" : "text-muted"}`}>
                  {ms === data.target ? `${ms}✓` : ms}
                </span>
              </div>
            );
          })}
        </div>

        {/* Message */}
        {msg.text && (
          <div className={`mb-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold border
            ${msg.ok
              ? "bg-success/8 border-success/25 text-success"
              : "bg-rose-soft border-rose/25 text-rose"}`}>
            <span>{msg.ok ? "✓" : "⚠"}</span>
            <span>{msg.text}</span>
          </div>
        )}

        {/* CTA */}
        {data.completed && !data.claimed ? (
          <button
            onClick={claim}
            disabled={claiming}
            className="w-full rounded-xl bg-gradient-to-r from-amber to-amber-bright py-3 text-sm font-extrabold text-white press shadow-lg shadow-amber/30 disabled:opacity-60"
          >
            {claiming
              ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">⟳</span> Mengklaim...</span>
              : `🎁 Klaim Rp${Number(data.reward).toLocaleString("id-ID")} Sekarang!`}
          </button>
        ) : data.claimed ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-success/30 bg-success/8 py-2.5 text-xs font-semibold text-success">
            <span>✓</span>
            <span>Hadiah minggu ini sudah diklaim</span>
          </div>
        ) : (
          <div className="rounded-xl bg-surface2 px-4 py-3 text-center">
            <p className="text-xs font-semibold text-ink">
              {data.target - data.current} pembelian lagi untuk selesaikan tantangan
            </p>
            <p className="text-[11px] text-muted mt-0.5">
              Beli nokos sekarang dan dapatkan Rp{Number(data.reward).toLocaleString("id-ID")}!
            </p>
          </div>
        )}
      </div>
    </>
  );
}
