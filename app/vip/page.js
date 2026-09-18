"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";
import Link from "next/link";
import { rupiah } from "@/components/ui";

const TIERS = [
  {
    name: "Bronze",
    icon: "🥉",
    color: "from-[#cd7f32] to-[#b8671a]",
    bg: "bg-[#cd7f32]/10",
    border: "border-[#cd7f32]/30",
    min: 0,
    max: 49999,
    perks: [
      "Akses semua layanan OTP",
      "Poin x1 tiap pembelian",
      "Misi harian & mingguan",
    ],
  },
  {
    name: "Silver",
    icon: "🥈",
    color: "from-slate-400 to-slate-600",
    bg: "bg-slate-400/10",
    border: "border-slate-400/30",
    min: 50000,
    max: 199999,
    perks: [
      "Semua benefit Bronze",
      "Poin x1.2 tiap pembelian",
      "Prioritas support",
      "Akses Lucky Hour eksklusif",
    ],
  },
  {
    name: "Gold",
    icon: "🥇",
    color: "from-amber-400 to-amber-600",
    bg: "bg-amber/10",
    border: "border-amber/30",
    min: 200000,
    max: 499999,
    perks: [
      "Semua benefit Silver",
      "Poin x1.5 tiap pembelian",
      "Diskon 5% semua pembelian",
      "Flash Sale early access",
      "Badge eksklusif di leaderboard",
    ],
  },
  {
    name: "Diamond",
    icon: "💎",
    color: "from-cyan-400 to-blue-500",
    bg: "bg-cyan-400/10",
    border: "border-cyan-400/30",
    min: 500000,
    max: Infinity,
    perks: [
      "Semua benefit Gold",
      "Poin x2 tiap pembelian",
      "Diskon 10% semua pembelian",
      "Kotak Misteri bonus tiap minggu",
      "Akses fitur beta eksklusif",
      "CS dedicated 24 jam",
    ],
  },
];

export default function VIPPage() {
  const { token, ready } = useUser();
  const [loyalty, setLoyalty] = useState(null);

  useEffect(() => {
    if (!token || !ready) return;
    fetch(`/api/loyalty?token=${token}`).then((r) => r.json()).then((d) => setLoyalty(d));
  }, [token, ready]);

  const currentTier = loyalty?.badge?.name || "Bronze";
  const totalSpend = loyalty?.totalSpend || 0;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink">💎 Level VIP</h1>
        <p className="text-sm text-muted mt-1">Semakin banyak belanja, semakin banyak keuntungan</p>
      </div>

      {/* Current status */}
      {loyalty && (
        <div className="mb-6 rounded-2xl border border-amber bg-amber-soft p-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{loyalty.badge?.icon || "🥉"}</span>
            <div className="flex-1">
              <p className="text-xs text-muted">Level kamu sekarang</p>
              <p className="text-lg font-extrabold text-ink">{currentTier}</p>
              <p className="text-xs text-muted mt-0.5">Total belanja: <span className="font-bold text-ink">{rupiah(totalSpend)}</span></p>
            </div>
            {loyalty.next && (
              <div className="text-right">
                <p className="text-[10px] text-muted">Menuju {loyalty.next.name}</p>
                <p className="text-xs font-bold text-amber-bright">{rupiah(loyalty.next.remaining)} lagi</p>
              </div>
            )}
          </div>
          {loyalty.next && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-surface2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber transition-all"
                  style={{ width: `${Math.min(100, ((totalSpend - loyalty.badge?.minSpend || 0) / (loyalty.next.minSpend - (loyalty.badge?.minSpend || 0))) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tier cards */}
      <div className="space-y-4">
        {TIERS.map((tier) => {
          const isCurrent = tier.name === currentTier;
          return (
            <div
              key={tier.name}
              className={`rounded-2xl border p-4 transition-all ${isCurrent ? `${tier.bg} ${tier.border} ring-2 ring-amber/30` : "border-line bg-surface"}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{tier.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-base font-extrabold text-ink">{tier.name}</p>
                    {isCurrent && <span className="text-xs bg-amber text-white px-2 py-0.5 rounded-full font-bold">Level Kamu</span>}
                  </div>
                  <p className="text-xs text-muted">
                    {tier.max === Infinity ? `${rupiah(tier.min)}+` : `${rupiah(tier.min)} – ${rupiah(tier.max)}`}
                  </p>
                </div>
              </div>
              <ul className="space-y-1.5">
                {tier.perks.map((p, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-ink">
                    <span className={`text-amber-bright shrink-0 ${tier.name === currentTier ? "" : "opacity-60"}`}>✓</span>
                    <span className={tier.name === currentTier ? "font-medium" : "text-muted"}>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <Link href="/otp" className="block w-full rounded-2xl bg-amber py-3.5 text-center text-sm font-bold text-white press">
          🛒 Beli Nokos Sekarang
        </Link>
        <Link href="/loyalitas" className="mt-2 block w-full rounded-2xl border border-line py-3 text-center text-sm font-semibold text-ink press">
          ⭐ Lihat Poin & Level
        </Link>
      </div>
    </div>
  );
}
