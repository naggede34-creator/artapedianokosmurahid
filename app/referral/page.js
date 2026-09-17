"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/app/providers";

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
          <button
            onClick={copyLink}
            disabled={!link}
            className="press mt-4 rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {copied ? "Tersalin!" : "Salin link"}
          </button>
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
