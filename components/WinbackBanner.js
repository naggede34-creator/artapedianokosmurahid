"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";
import { rupiah } from "@/components/ui";

const WINBACK_KEY = "artapedia_winback_claimed";
const WINBACK_SEEN_KEY = "artapedia_winback_seen";
const WINBACK_DAYS = 1; // hari tidak transaksi sebelum banner muncul
const BONUS_AMOUNT = 500;

export default function WinbackBanner() {
  const { token, balance, refreshBalance } = useUser();
  const [visible, setVisible] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    try {
      if (localStorage.getItem(WINBACK_CLAIMED_KEY(token))) return;
      const seen = localStorage.getItem(WINBACK_SEEN_KEY + "_" + token);
      if (seen && Date.now() - Number(seen) < 12 * 60 * 60 * 1000) return;
    } catch {}

    fetch(`/api/otp/history?token=${encodeURIComponent(token)}&limit=1`)
      .then((r) => r.json())
      .then((d) => {
        const items = Array.isArray(d.items) ? d.items : [];
        if (items.length === 0) {
          setVisible(true);
          return;
        }
        const last = new Date(items[0].createdAt).getTime();
        const daysDiff = (Date.now() - last) / (1000 * 60 * 60 * 24);
        if (daysDiff >= WINBACK_DAYS && daysDiff <= 30) {
          setVisible(true);
        }
      })
      .catch(() => {});
  }, [token]);

  function WINBACK_CLAIMED_KEY(t) { return WINBACK_KEY + "_" + t; }

  function dismiss() {
    try { localStorage.setItem(WINBACK_SEEN_KEY + "_" + token, Date.now()); } catch {}
    setDismissed(true);
  }

  async function claim() {
    if (!token || claiming) return;
    setClaiming(true);
    setErrMsg("");
    try {
      const res = await fetch("/api/winback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal klaim bonus.");
      try { localStorage.setItem(WINBACK_CLAIMED_KEY(token), "1"); } catch {}
      setClaimed(true);
      refreshBalance?.();
    } catch (e) {
      setErrMsg(e.message);
    } finally {
      setClaiming(false);
    }
  }

  if (!visible || dismissed) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-amber/60 bg-gradient-to-br from-amber/10 via-amber-soft to-amber/5 p-4 shadow-soft anime-panel">
      {/* Comic halftone dots */}
      <div className="pointer-events-none absolute inset-0 opacity-10" style={{
        backgroundImage: "radial-gradient(circle, rgb(var(--c-blue)) 1px, transparent 1px)",
        backgroundSize: "12px 12px"
      }} />

      {/* Character bubble */}
      <div className="relative flex items-start gap-3">
        {/* Anime character mini icon */}
        <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl shadow-md border-2 border-white/20 float-particle">
          🥷
        </div>

        {/* Speech bubble */}
        <div className="flex-1 relative">
          <div className="absolute -left-3 top-3 w-0 h-0" style={{
            borderTop: "6px solid transparent",
            borderBottom: "6px solid transparent",
            borderRight: "10px solid rgb(var(--c-amber-bright) / 0.3)"
          }} />
          <div className="rounded-xl rounded-tl-none border border-amber/30 bg-white/80 dark:bg-slate-900/80 px-3 py-2.5 shadow-inner">
            <p className="text-[11px] font-black uppercase tracking-widest text-amber-bright mb-0.5">✨ Hai, kami kangen kamu!</p>
            {claimed ? (
              <p className="text-sm font-bold text-teal-bright">
                🎉 <span className="font-black">{rupiah(BONUS_AMOUNT)}</span> sudah masuk ke saldo kamu!
              </p>
            ) : (
              <p className="text-sm font-bold text-ink">
                Sudah lama tidak belanja? Ambil bonus <span className="text-amber-bright font-black">{rupiah(BONUS_AMOUNT)}</span> gratis buat kamu! 🎁
              </p>
            )}
            {errMsg && <p className="mt-1 text-xs text-rose">{errMsg}</p>}
          </div>
        </div>

        {/* Close */}
        <button onClick={dismiss} className="shrink-0 text-muted hover:text-ink transition-colors p-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      {!claimed && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={claim}
            disabled={claiming}
            className="flex-1 rounded-xl bg-amber-bright py-2.5 text-sm font-black text-white shadow-md transition-all active:scale-95 disabled:opacity-60"
            style={{ boxShadow: "0 4px 0 0 rgba(180,100,0,0.4)" }}
          >
            {claiming ? "⏳ Mengklaim..." : "🎁 Ambil Bonus Sekarang!"}
          </button>
          <button onClick={dismiss} className="rounded-xl border border-line px-4 text-sm text-muted hover:text-ink transition-colors">
            Nanti
          </button>
        </div>
      )}
    </div>
  );
}
