"use client";

import { useState } from "react";

export default function MysteryBoxModal({ open, onClose, token, orderId }) {
  const [phase, setPhase] = useState("idle"); // idle | opening | revealed
  const [prize, setPrize] = useState(null);
  const [err, setErr] = useState("");

  async function open_box() {
    if (phase !== "idle") return;
    setPhase("opening");
    setErr("");
    try {
      const res = await fetch("/api/mystery-box", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, orderId }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Gagal buka kotak."); setPhase("idle"); return; }
      setTimeout(() => { setPrize(d); setPhase("revealed"); }, 1200);
    } catch {
      setErr("Gagal menghubungi server."); setPhase("idle");
    }
  }

  function handleClose() {
    setPhase("idle"); setPrize(null); setErr("");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgb(0 0 0 / 0.65)" }}>
      <div className="w-full max-w-xs rounded-2xl bg-surface p-6 text-center shadow-xl">
        {phase === "idle" && (
          <>
            <div className="text-6xl mb-3 animate-bounce">🎁</div>
            <h2 className="text-lg font-extrabold text-ink mb-1">Kotak Misteri!</h2>
            <p className="text-sm text-muted mb-4">Selamat! Kamu dapat hadiah acak dari pembelian ini. Buka sekarang?</p>
            {err && <p className="text-xs text-rose mb-3">{err}</p>}
            <button onClick={open_box} className="w-full rounded-xl bg-amber py-3 font-bold text-white press text-sm">
              🎊 Buka Kotak!
            </button>
            <button onClick={handleClose} className="mt-2 w-full text-xs text-muted py-2">Nanti saja</button>
          </>
        )}

        {phase === "opening" && (
          <div className="py-8">
            <div className="text-6xl mb-4 animate-spin">✨</div>
            <p className="text-sm font-semibold text-ink">Membuka kotak...</p>
          </div>
        )}

        {phase === "revealed" && prize && (
          <>
            <div className="text-6xl mb-3 animate-bounce">{prize.prize.icon}</div>
            <h2 className="text-xl font-extrabold text-ink mb-1">
              {prize.prize.label}
            </h2>
            <p className="text-sm text-muted mb-1">
              {prize.prize.type === "empty" ? "Sayang, kali ini belum beruntung." : prize.prize.type === "saldo" ? `Saldo Rp${prize.prize.value.toLocaleString("id-ID")} telah ditambahkan!` : `${prize.prize.value} poin telah ditambahkan!`}
            </p>
            {prize.prize.type !== "empty" && (
              <div className="my-3 rounded-xl bg-amber-soft border border-amber/30 py-3 px-4">
                <p className="text-2xl font-extrabold text-amber-bright">
                  {prize.prize.type === "saldo" ? `+Rp${prize.prize.value.toLocaleString("id-ID")}` : `+${prize.prize.value} Poin`}
                </p>
              </div>
            )}
            <button onClick={handleClose} className="mt-3 w-full rounded-xl bg-amber py-3 font-bold text-white press text-sm">
              Seru! Tutup
            </button>
          </>
        )}
      </div>
    </div>
  );
}
