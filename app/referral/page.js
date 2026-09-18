"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/app/providers";

const REFERRAL_TIERS = [
  { name: "Starter", min: 0, max: 4, icon: "🌱", color: "border-ochre/40 bg-surface text-ink", badge: "text-muted", benefit: "Bonus standar per referral" },
  { name: "Silver", min: 5, max: 14, icon: "🥈", color: "border-ochre/60 bg-ochre-soft text-ink", badge: "text-ink", benefit: "+0.5% bonus ekstra per referral" },
  { name: "Gold", min: 15, max: 29, icon: "🥇", color: "border-amber/50 bg-amber-soft text-amber-bright", badge: "text-amber-bright", benefit: "+1% bonus ekstra per referral" },
  { name: "Diamond", min: 30, max: Infinity, icon: "💎", color: "border-teal/50 bg-teal-soft text-teal-bright", badge: "text-teal-bright", benefit: "+2% bonus ekstra + prioritas layanan" },
];

export default function ReferralPage() {
  const { token, ready } = useUser();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && token) {
      setLink(`${window.location.origin}/?ref=${token}`);
    }
  }, [token]);

  useEffect(() => {
    if (!ready || !token) return;
    fetch(`/api/referral/info?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setStats(data);
      })
      .finally(() => setLoading(false));
  }, [ready, token]);

  const copyLink = () => {
    if (!link) return;
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const shareWhatsApp = () => {
    if (!link) return;
    const text = encodeURIComponent(`Daftar di Artapedia dan beli nomor OTP murah! Pakai link saya: ${link}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const shareTelegram = () => {
    if (!link) return;
    const text = encodeURIComponent(`Beli nomor OTP murah di Artapedia! Daftar via link saya:`);
    const url = encodeURIComponent(link);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, "_blank", "noopener,noreferrer");
  };

  const shareTwitter = () => {
    if (!link) return;
    const text = encodeURIComponent(`Beli nomor OTP murah & cepat di Artapedia! Daftar via link undanganku dan kita sama-sama dapat bonus 🎁`);
    const url = encodeURIComponent(link);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <p className="fade-up text-sm font-semibold text-teal-bright">Undang Teman</p>
      <h1 className="fade-up delay-1 mt-2 text-[26px] font-extrabold tracking-tight text-ink sm:text-[32px]">
        Ajak teman, dapat bonus saldo
      </h1>
      <p className="fade-up delay-2 mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Bagikan link kode akun kamu. Begitu teman yang mendaftar lewat link ini melakukan deposit pertama kali,
        kamu otomatis dapat bonus saldo{stats?.bonusPercent ? ` sebesar ${stats.bonusPercent}% dari nominal depositnya` : ""}.
      </p>

      {/* Kartu link referral */}
      <div className="fade-up delay-2 card-shadow relative mt-8 overflow-hidden rounded-3xl bg-ink px-6 py-8 sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full bg-amber/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-6 h-52 w-52 rounded-full bg-teal/25 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold text-teal-soft/90">Link undanganmu</p>
          <p className="mt-3 break-all rounded-xl bg-white/10 px-4 py-3 font-mono text-sm text-white">
            {link || "Memuat..."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={copyLink}
              disabled={!link}
              className="press rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {copied ? "✓ Tersalin!" : "📋 Salin link"}
            </button>
            <button
              onClick={shareWhatsApp}
              disabled={!link}
              className="press rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              💬 WhatsApp
            </button>
            <button
              onClick={shareTelegram}
              disabled={!link}
              className="press rounded-full bg-[#0088cc] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              ✈️ Telegram
            </button>
            <button
              onClick={shareTwitter}
              disabled={!link}
              className="press rounded-full bg-[#1DA1F2] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              🐦 Twitter/X
            </button>
          </div>
        </div>
      </div>

      {/* Statistik */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="hover-lift card-shadow rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs text-muted">Teman berhasil diundang</p>
          <p className="mt-1.5 font-display text-2xl font-semibold text-ink">
            {loading ? "..." : stats?.referralCount ?? 0}
          </p>
        </div>
        <div className="hover-lift card-shadow rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs text-muted">Total bonus didapat</p>
          <p className="mt-1.5 font-display text-2xl font-semibold text-teal-bright">
            {loading ? "..." : `Rp${Number(stats?.referralEarnings || 0).toLocaleString("id-ID")}`}
          </p>
        </div>
      </div>

      <div className="fade-up relative mt-10 overflow-hidden rounded-2xl border border-amber/25 bg-amber-soft p-6">
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber/15 blur-2xl" />
        <h3 className="relative font-display text-base font-medium text-ink">Cara kerjanya</h3>
        <ol className="relative mt-2 list-decimal space-y-1.5 pl-4 text-sm leading-relaxed text-muted">
          <li>Bagikan link di atas ke teman kamu.</li>
          <li>Teman membuka link tersebut, kode akun barunya otomatis tertaut ke kamu sebagai pengundang.</li>
          <li>Saat teman itu deposit pertama kali dan berhasil, bonus langsung masuk ke saldo kamu.</li>
        </ol>
      </div>

      {/* Referral Tiers */}
      <div className="mt-8">
        <h2 className="text-base font-bold text-ink">🎯 Level Pengundang</h2>
        <p className="mt-1 text-sm text-muted">Undang lebih banyak teman untuk naik level dan dapat bonus lebih besar.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {REFERRAL_TIERS.map((tier) => {
            const count = stats?.referralCount ?? 0;
            const isCurrent = count >= tier.min && (tier.max === Infinity || count <= tier.max);
            const isAchieved = count >= tier.min;
            return (
              <div
                key={tier.name}
                className={`relative rounded-2xl border p-4 transition-all ${tier.color} ${
                  isCurrent ? "ring-2 ring-amber/60 shadow-glow" : isAchieved ? "opacity-80" : "opacity-50"
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-2.5 right-3 rounded-full bg-amber px-2 py-0.5 text-[10px] font-bold text-white shadow">
                    Level Kamu
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{tier.icon}</span>
                  <div>
                    <p className="font-bold text-sm">{tier.name}</p>
                    <p className="text-[11px] text-muted">
                      {tier.max === Infinity ? `${tier.min}+ referral` : `${tier.min}–${tier.max} referral`}
                    </p>
                  </div>
                </div>
                <p className="mt-2.5 text-xs text-muted">{tier.benefit}</p>
                {isCurrent && tier.max !== Infinity && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-muted mb-1">
                      <span>{stats?.referralCount ?? 0} / {tier.max + 1}</span>
                      <span>{tier.max + 1 - (stats?.referralCount ?? 0)} lagi ke {REFERRAL_TIERS[REFERRAL_TIERS.indexOf(tier) + 1]?.name}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-line overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber transition-all"
                        style={{ width: `${Math.min(100, (((stats?.referralCount ?? 0) - tier.min) / (tier.max - tier.min + 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Link
        href="/leaderboard"
        className="fade-up hover-lift mt-6 flex items-center justify-between rounded-2xl border border-teal/25 bg-teal-soft px-6 py-4 text-sm font-medium text-teal-bright transition-colors"
      >
        🏆 Lihat leaderboard pengundang teman bulan ini
        <span>→</span>
      </Link>
    </div>
  );
}
