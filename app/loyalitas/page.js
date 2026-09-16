"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";

const BADGE_STYLE = {
  bronze: "from-amber-700 to-amber-500",
  silver: "from-slate-400 to-slate-200",
  gold: "from-amber-bright to-amber"
};

export default function LoyaltyPage() {
  const { token, ready, refreshBalance } = useUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redeemInput, setRedeemInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [msg, setMsg] = useState("");

  function load() {
    if (!token) return;
    setLoading(true);
    fetch(`/api/loyalty/info?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => setData(d.error ? null : d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (ready && token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  const badge = data?.badge;
  const next = data?.next;
  const progressPct = next
    ? Math.min(100, Math.max(0, ((data.totalSpent || 0) / next.target) * 100))
    : 100;

  const previewRupiah = redeemInput ? Math.floor(Number(redeemInput) * (data?.pointRupiahValue || 0)) : 0;

  async function submitRedeem(e) {
    e.preventDefault();
    setMsg("");
    setRedeeming(true);
    try {
      const res = await fetch("/api/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, points: Number(redeemInput) })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gagal menukar poin.");
      setMsg(`Berhasil! Rp${d.rupiah.toLocaleString("id-ID")} masuk ke saldo.`);
      setRedeemInput("");
      load();
      refreshBalance?.();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setRedeeming(false);
      setTimeout(() => setMsg(""), 3500);
    }
  }

  return (
    <div className="mx-auto max-w-content px-5 py-14">
      <p className="fade-up text-sm font-semibold uppercase tracking-wide text-amber-bright">Poin & Level</p>
      <h1 className="fade-up delay-1 mt-2 font-display text-display-sm font-semibold text-ink sm:text-display-md">
        Makin sering beli, makin banyak untungnya
      </h1>
      <p className="fade-up delay-2 mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Setiap transaksi OTP yang sukses dapat poin, dan setiap deposit langsung dapat cashback ke saldo.
        Poin bisa ditukar jadi saldo kapan saja.
      </p>

      {/* Badge card */}
      <div className="fade-up delay-2 card-shadow relative mt-8 overflow-hidden rounded-3xl bg-ink px-6 py-8 sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full bg-amber/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-6 h-52 w-52 rounded-full bg-teal/25 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <span
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl shadow-3d ${
              BADGE_STYLE[badge?.key || "bronze"]
            }`}
          >
            {loading ? "…" : badge?.icon || "🥉"}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Level kamu</p>
            <p className="mt-1 font-display text-2xl font-semibold text-white">
              {loading ? "Memuat..." : badge?.name || "Bronze"}
            </p>
          </div>
        </div>

        {next && (
          <div className="relative mt-6">
            <div className="flex items-center justify-between text-xs text-white/70">
              <span>Menuju {next.name} {next.icon}</span>
              <span>Rp{next.remaining.toLocaleString("id-ID")} lagi</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber to-amber-bright transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
        {!next && !loading && (
          <p className="relative mt-6 text-xs font-medium text-amber-bright">🎉 Kamu sudah di level tertinggi!</p>
        )}
      </div>

      {/* Statistik */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="hover-lift card-shadow rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs text-muted">Poin kamu</p>
          <p className="mt-1.5 font-display text-2xl font-semibold text-amber-bright">
            {loading ? "..." : (data?.points || 0).toLocaleString("id-ID")}
          </p>
        </div>
        <div className="hover-lift card-shadow rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs text-muted">Total transaksi sukses</p>
          <p className="mt-1.5 font-display text-2xl font-semibold text-ink">
            {loading ? "..." : `Rp${Number(data?.totalSpent || 0).toLocaleString("id-ID")}`}
          </p>
        </div>
        <div className="hover-lift card-shadow rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs text-muted">Total cashback didapat</p>
          <p className="mt-1.5 font-display text-2xl font-semibold text-teal-bright">
            {loading ? "..." : `Rp${Number(data?.cashbackTotal || 0).toLocaleString("id-ID")}`}
          </p>
        </div>
      </div>

      {/* Redeem poin */}
      <div className="fade-up mt-8 rounded-2xl border border-line bg-surface p-6 shadow-card-3d">
        <h3 className="font-display text-base font-semibold text-ink">Tukar poin ke saldo</h3>
        <p className="mt-1 text-xs text-muted">
          {data ? `1 poin = Rp${data.pointRupiahValue}. Minimal tukar ${data.minRedeemPoints?.toLocaleString("id-ID")} poin.` : "Memuat..."}
        </p>
        <form onSubmit={submitRedeem} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="number"
            min={data?.minRedeemPoints || 1}
            max={data?.points || 0}
            value={redeemInput}
            onChange={(e) => setRedeemInput(e.target.value)}
            placeholder="Jumlah poin"
            required
            className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-amber"
          />
          <button
            type="submit"
            disabled={redeeming || !redeemInput}
            className="btn-3d shrink-0 rounded-lg bg-gradient-to-r from-amber to-amber-bright px-5 py-2.5 text-sm font-semibold text-white shadow-3d disabled:opacity-60"
          >
            {redeeming ? "Menukar..." : "Tukar Sekarang"}
          </button>
        </form>
        {redeemInput > 0 && (
          <p className="mt-2 text-xs text-muted">≈ Rp{previewRupiah.toLocaleString("id-ID")} akan masuk ke saldo.</p>
        )}
        {msg && <p className="mt-2 text-xs font-medium text-teal-bright">{msg}</p>}
      </div>

      <div className="fade-up relative mt-8 overflow-hidden rounded-2xl border border-amber/25 bg-amber-soft p-6">
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber/15 blur-2xl" />
        <h3 className="relative font-display text-base font-medium text-ink">Cara dapat poin & cashback</h3>
        <ol className="relative mt-2 list-decimal space-y-1.5 pl-4 text-sm leading-relaxed text-muted">
          <li>Beli OTP dan tunggu sampai statusnya "Selesai" — poin otomatis masuk.</li>
          <li>Deposit saldo — cashback langsung otomatis masuk ke saldo, tanpa perlu klaim.</li>
          <li>Makin besar total transaksi sukses kamu, level badge otomatis naik dari Bronze → Silver → Gold.</li>
        </ol>
      </div>
    </div>
  );
}
