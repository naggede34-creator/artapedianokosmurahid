"use client";

import { useEffect, useState } from "react";

function MissionCard({ m, onClaim }) {
  const pct = Math.min(100, Math.round(((m.progress || 0) / m.target) * 100));
  const done = m.completed;
  const claimed = m.claimed;

  return (
    <div className={`rounded-xl border p-3.5 transition-all ${done && !claimed ? "border-amber bg-amber-soft/50" : "border-line bg-surface"}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{m.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink truncate">{m.title}</p>
            <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${done ? "bg-amber text-white" : "bg-surface2 text-muted"}`}>
              {m.reward.type === "saldo" ? `+Rp${m.reward.amount.toLocaleString("id-ID")}` : `+${m.reward.amount} poin`}
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">{m.desc}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-surface2 overflow-hidden">
              <div className="h-full rounded-full bg-amber transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-mono text-muted shrink-0">{m.progress}/{m.target}</span>
          </div>
        </div>
      </div>
      {done && !claimed && (
        <button
          onClick={() => onClaim(m)}
          className="mt-2.5 w-full rounded-lg bg-amber py-1.5 text-xs font-bold text-white press"
        >
          Klaim Hadiah 🎁
        </button>
      )}
      {claimed && (
        <div className="mt-2 text-center text-xs text-muted">✓ Hadiah sudah diklaim</div>
      )}
    </div>
  );
}

export default function MissionsPanel({ token }) {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/missions?token=${token}`).then((r) => r.json()).then(setData);
  }, [token]);

  async function claim(m) {
    const res = await fetch("/api/missions/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, missionId: m.id, progress: m.progress }),
    });
    const d = await res.json();
    if (d.ok) {
      setMsg(`🎉 Berhasil klaim ${m.reward.type === "saldo" ? `Rp${m.reward.amount.toLocaleString("id-ID")}` : `${m.reward.amount} poin`}!`);
      fetch(`/api/missions?token=${token}`).then((r) => r.json()).then(setData);
      setTimeout(() => setMsg(""), 3000);
    } else {
      setMsg(d.error || "Gagal klaim.");
      setTimeout(() => setMsg(""), 3000);
    }
  }

  const hasDailyDone = data?.daily?.some((m) => m.completed && !m.claimed);
  const hasWeeklyDone = data?.weekly?.some((m) => m.completed && !m.claimed);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-ink">🎯 Misi Harian & Mingguan</h2>
          <p className="text-xs text-muted mt-0.5">Selesaikan misi untuk dapat hadiah</p>
        </div>
        {(hasDailyDone || hasWeeklyDone) && (
          <span className="animate-pulse text-xs font-bold bg-amber text-white px-2 py-1 rounded-full">Ada hadiah!</span>
        )}
      </div>

      {msg && (
        <div className="mb-3 rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-xs font-semibold text-success">{msg}</div>
      )}

      {!data ? (
        <div className="space-y-2">
          {[1,2,3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Harian</p>
          <div className="space-y-2 mb-4">
            {data.daily.map((m) => <MissionCard key={m.id} m={m} onClaim={claim} />)}
          </div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Mingguan</p>
          <div className="space-y-2">
            {data.weekly.map((m) => <MissionCard key={m.id} m={m} onClaim={claim} />)}
          </div>
        </>
      )}
    </div>
  );
}
