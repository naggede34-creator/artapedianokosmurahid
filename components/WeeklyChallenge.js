"use client";

import { useEffect, useState } from "react";

export default function WeeklyChallenge({ token }) {
  const [data, setData] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/challenge?token=${token}`).then((r) => r.json()).then(setData);
  }, [token]);

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
      setMsg(`🎉 Berhasil! +Rp${Number(d.reward).toLocaleString("id-ID")}`);
      fetch(`/api/challenge?token=${token}`).then((r) => r.json()).then(setData);
    } else {
      setMsg(d.error || "Gagal klaim.");
    }
    setTimeout(() => setMsg(""), 4000);
  }

  if (!data) return <div className="skeleton h-28 rounded-xl" />;

  const pct = data.percent;
  const days = Math.ceil((new Date(data.endsAt) - Date.now()) / 86400000);

  return (
    <div className={`card p-5 ${data.completed && !data.claimed ? "border-amber" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-bold text-ink">🏆 Tantangan Mingguan</h2>
          <p className="text-xs text-muted mt-0.5">Berakhir dalam {days} hari</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Hadiah</p>
          <p className="text-sm font-extrabold text-amber-bright">Rp{Number(data.reward).toLocaleString("id-ID")}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-1.5 text-xs text-muted">
        <span>Beli nokos minggu ini</span>
        <span className="font-bold text-ink">{data.current}/{data.target}</span>
      </div>
      <div className="h-3 rounded-full bg-surface2 overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all bg-gradient-to-r from-amber to-amber-bright"
          style={{ width: `${pct}%` }}
        />
      </div>

      {msg && <p className="text-xs text-success font-semibold mb-2">{msg}</p>}

      {data.completed && !data.claimed ? (
        <button
          onClick={claim}
          disabled={claiming}
          className="w-full rounded-xl bg-amber py-2.5 text-sm font-bold text-white press disabled:opacity-60"
        >
          {claiming ? "Mengklaim..." : "🎁 Klaim Rp" + Number(data.reward).toLocaleString("id-ID")}
        </button>
      ) : data.claimed ? (
        <div className="text-center text-xs text-muted py-1">✓ Hadiah minggu ini sudah diklaim</div>
      ) : (
        <p className="text-xs text-center text-muted">
          {data.target - data.current} pembelian lagi untuk dapat hadiah!
        </p>
      )}
    </div>
  );
}
