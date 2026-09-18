"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";
import { rupiah } from "@/components/ui";

function MissionCard({ m, onClaim }) {
  const pct = Math.min(100, Math.round(((m.progress || 0) / m.target) * 100));

  return (
    <div className={`rounded-2xl border p-4 transition-all ${m.completed && !m.claimed ? "border-amber bg-amber-soft" : "border-line bg-surface"}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${m.completed && !m.claimed ? "bg-amber/20" : "bg-surface2"}`}>
          {m.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-ink">{m.title}</p>
              <p className="text-xs text-muted mt-0.5">{m.desc}</p>
            </div>
            <div className={`shrink-0 rounded-xl px-3 py-1 text-xs font-bold ${m.completed ? "bg-amber text-white" : "bg-surface2 text-muted"}`}>
              {m.reward.type === "saldo" ? `+${rupiah(m.reward.amount)}` : `+${m.reward.amount} poin`}
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>Progress</span>
              <span className="font-mono font-bold text-ink">{m.progress}/{m.target}</span>
            </div>
            <div className="h-2 rounded-full bg-surface2 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber to-amber-bright transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      {m.completed && !m.claimed && (
        <button
          onClick={() => onClaim(m)}
          className="mt-3 w-full rounded-xl bg-amber py-2.5 text-sm font-bold text-white press"
        >
          🎁 Klaim Hadiah
        </button>
      )}
      {m.claimed && (
        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted">
          <span>✓</span> <span>Sudah diklaim</span>
        </div>
      )}
    </div>
  );
}

export default function MisiPage() {
  const { token, ready } = useUser();
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState({ text: "", ok: true });

  function load() {
    if (!token) return;
    fetch(`/api/missions?token=${token}`).then((r) => r.json()).then(setData);
  }

  useEffect(() => { if (ready) load(); }, [token, ready]);

  async function claim(m) {
    const res = await fetch("/api/missions/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, missionId: m.id, progress: m.progress }),
    });
    const d = await res.json();
    if (d.ok) {
      setMsg({ text: `🎉 Berhasil klaim ${m.reward.type === "saldo" ? rupiah(m.reward.amount) : `${m.reward.amount} poin`}!`, ok: true });
      load();
    } else {
      setMsg({ text: d.error || "Gagal klaim.", ok: false });
    }
    setTimeout(() => setMsg({ text: "", ok: true }), 3000);
  }

  const dailyDone = data?.daily?.filter((m) => m.completed && !m.claimed).length || 0;
  const weeklyDone = data?.weekly?.filter((m) => m.completed && !m.claimed).length || 0;
  const totalClaimable = dailyDone + weeklyDone;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink">🎯 Misi</h1>
        <p className="text-sm text-muted mt-1">Selesaikan misi untuk dapat poin & saldo gratis</p>
      </div>

      {totalClaimable > 0 && (
        <div className="mb-4 rounded-xl bg-amber px-4 py-3 flex items-center gap-3">
          <span className="text-2xl animate-bounce">🎁</span>
          <div>
            <p className="text-sm font-bold text-white">{totalClaimable} hadiah siap diklaim!</p>
            <p className="text-xs text-white/80">Scroll ke bawah untuk klaim</p>
          </div>
        </div>
      )}

      {msg.text && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${msg.ok ? "bg-success/10 text-success border border-success/30" : "bg-rose-soft text-rose border border-rose/30"}`}>
          {msg.text}
        </div>
      )}

      {!data ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : (
        <>
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base font-bold text-ink">Misi Harian</span>
              <span className="text-xs bg-surface2 text-muted px-2 py-0.5 rounded-full">Reset tiap hari</span>
            </div>
            <div className="space-y-3">
              {data.daily.map((m) => <MissionCard key={m.id} m={m} onClaim={claim} />)}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base font-bold text-ink">Misi Mingguan</span>
              <span className="text-xs bg-surface2 text-muted px-2 py-0.5 rounded-full">Reset tiap Senin</span>
            </div>
            <div className="space-y-3">
              {data.weekly.map((m) => <MissionCard key={m.id} m={m} onClaim={claim} />)}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
