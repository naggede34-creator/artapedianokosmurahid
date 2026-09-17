"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@/app/providers";
import { rupiah } from "@/components/ui";

const DEGREE_PER_SECTOR = 360 / 8;

export default function SpinWheelGame({ onSaldoWon }) {
  const { token, setBalance } = useUser();
  const [status, setStatus] = useState("idle"); // idle | spinning | done | already
  const [prize, setPrize] = useState(null);
  const [prizeIndex, setPrizeIndex] = useState(null);
  const [prizes, setPrizes] = useState([]);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const wheelRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/spinwheel?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        setPrizes(d.prizes || []);
        if (d.alreadyPlayed) setStatus("already");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function spin() {
    if (status !== "idle" || !token) return;
    setStatus("spinning");
    try {
      const res = await fetch("/api/spinwheel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.alreadyPlayed) { setStatus("already"); return; }

      const idx = data.prizeIndex ?? 0;
      // Spin beberapa putaran + berhenti di sektor yang menang
      const targetDeg = 360 * 5 + (360 - idx * DEGREE_PER_SECTOR - DEGREE_PER_SECTOR / 2);
      setRotation((prev) => prev + targetDeg);

      setPrize(data.prize);
      setPrizeIndex(idx);
      if (data.prize?.type === "saldo") {
        setBalance?.((b) => b + data.prize.amount);
        onSaldoWon?.(data.prize.amount);
      }

      setTimeout(() => setStatus("done"), 4000);
    } catch {
      setStatus("idle");
    }
  }

  // Build conic gradient from prizes
  const conicStops = prizes
    .map((p, i) => {
      const start = i * DEGREE_PER_SECTOR;
      const end = start + DEGREE_PER_SECTOR;
      return `${p.color} ${start}deg ${end}deg`;
    })
    .join(", ");

  if (loading) return <div className="skeleton h-48 rounded-2xl" />;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Wheel */}
      <div className="relative flex items-center justify-center">
        {/* Pointer */}
        <div className="absolute -top-3 z-10 flex justify-center" style={{ left: "50%", transform: "translateX(-50%)" }}>
          <div className="h-0 w-0 border-l-[10px] border-r-[10px] border-t-[20px] border-l-transparent border-r-transparent border-t-amber drop-shadow-md" />
        </div>

        <div
          ref={wheelRef}
          className="relative overflow-hidden rounded-full shadow-lift"
          style={{
            width: 200,
            height: 200,
            background: conicStops ? `conic-gradient(${conicStops})` : "#eee",
            transform: `rotate(${rotation}deg)`,
            transition: status === "spinning" ? "transform 4s cubic-bezier(0.17,0.67,0.12,0.99)" : "none"
          }}
        >
          {/* Labels on sectors */}
          {prizes.map((p, i) => {
            const angle = i * DEGREE_PER_SECTOR + DEGREE_PER_SECTOR / 2 - 90;
            const rad = (angle * Math.PI) / 180;
            const r = 68;
            const x = 100 + r * Math.cos(rad);
            const y = 100 + r * Math.sin(rad);
            return (
              <div
                key={i}
                className="pointer-events-none absolute text-[9px] font-bold leading-tight text-white drop-shadow"
                style={{
                  left: x,
                  top: y,
                  transform: `translate(-50%, -50%) rotate(${i * DEGREE_PER_SECTOR + DEGREE_PER_SECTOR / 2}deg)`,
                  textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                  maxWidth: 44,
                  textAlign: "center"
                }}
              >
                {p.label.replace(" Poin", "P").replace("Jackpot!", "🏆").replace("Saldo", "💰")}
              </div>
            );
          })}

          {/* Center circle */}
          <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lift flex items-center justify-center text-base font-extrabold text-amber-bright">
            🎡
          </div>
        </div>
      </div>

      {/* Result */}
      {status === "done" && prize && (
        <div className={`animate-scale-in rounded-2xl px-5 py-3 text-center ${prize.type === "none" ? "bg-surface2 text-muted" : "bg-amber-soft text-amber-bright"}`}>
          <p className="text-lg font-extrabold">{prize.label}</p>
          {prize.type !== "none" && (
            <p className="text-xs mt-0.5 text-muted">
              {prize.type === "saldo" ? `Saldo sudah ditambahkan!` : `Poin sudah ditambahkan ke akunmu`}
            </p>
          )}
        </div>
      )}

      {status === "already" && (
        <div className="rounded-2xl bg-surface2 px-5 py-3 text-center">
          <p className="text-sm font-semibold text-muted">Sudah main hari ini</p>
          <p className="text-xs text-muted mt-0.5">Kembali besok untuk spin lagi!</p>
        </div>
      )}

      <button
        onClick={spin}
        disabled={status !== "idle"}
        className="btn-3d rounded-xl bg-gradient-to-r from-amber to-amber-bright px-6 py-3 text-sm font-bold text-white shadow-3d disabled:opacity-50 transition-all"
      >
        {status === "spinning" ? "Berputar..." : status === "done" ? "Selesai!" : status === "already" ? "Besok lagi" : "Putar Sekarang!"}
      </button>
    </div>
  );
}
