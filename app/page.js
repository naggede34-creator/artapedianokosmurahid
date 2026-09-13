"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";
import OtpMascot from "@/components/OtpMascot";
import TiltCard from "@/components/TiltCard";

const quickActions = [
  {
    href: "/otp",
    label: "Nomor OTP",
    bg: "bg-amber-soft",
    fg: "text-amber-bright",
    glow: "shadow-glow",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="6" y="3" width="12" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M9 18h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  },
  {
    href: "/deposit",
    label: "Deposit",
    bg: "bg-teal-soft",
    fg: "text-teal-bright",
    glow: "shadow-glow-pink",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="16.5" cy="14" r="1.1" fill="currentColor" />
      </svg>
    )
  },
  {
    href: "/riwayat",
    label: "Riwayat",
    bg: "bg-surface2",
    fg: "text-ink",
    glow: "shadow-lift",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M6 4h9l4 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 12h6M9 16h6M9 8h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  },
  {
    href: "/cara-pakai",
    label: "Panduan",
    bg: "bg-rose-soft",
    fg: "text-rose",
    glow: "shadow-glow-pink",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  },
  {
    href: "/referral",
    label: "Undang Teman",
    bg: "bg-teal-soft",
    fg: "text-teal-bright",
    glow: "shadow-glow-pink",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M17 8h4M19 6v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    )
  }
];

const statusItems = [
  { title: "Deposit QRIS", desc: "Terverifikasi otomatis, biasanya dalam hitungan detik." },
  { title: "Katalog nomor OTP", desc: "Ratusan layanan, bukan cuma WhatsApp." },
  { title: "Harga & stok", desc: "Tampil di depan sebelum kamu order, tanpa biaya tersembunyi." },
  { title: "Riwayat transaksi", desc: "Deposit & pembelian tercatat, bisa dicek pakai kode akun." }
];

const steps = [
  { n: "1", title: "Isi saldo pakai QRIS", desc: "Scan dari e-wallet atau m-banking apa saja, saldo masuk otomatis." },
  { n: "2", title: "Pilih layanan & negara", desc: "Harga per operator tampil jelas sebelum kamu order." },
  { n: "3", title: "Terima kode OTP", desc: "Nomor diberikan begitu order dibuat, kode muncul otomatis." }
];

export default function HomePage() {
  const { token, balance, ready } = useUser();
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/otp/services")
      .then((r) => r.json())
      .then((d) => setServices(Array.isArray(d.items) ? d.items.slice(0, 10) : []))
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }, []);

  function copyToken() {
    if (!token) return;
    navigator.clipboard?.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-content px-5 pb-16 pt-6">
      {/* Dashboard header: brand + balance */}
      <div className="fade-up flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="btn-3d flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber to-amber-bright text-sm font-bold text-white shadow-3d">
            A
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-ink">Artapedia</span>
        </div>

        <div className="glass rounded-full px-3.5 py-1.5 text-right shadow-soft">
          <p className="text-[11px] leading-none text-muted">Saldo kamu</p>
          <p className="mt-0.5 text-sm font-semibold leading-none text-ink">
            {ready ? `Rp${balance.toLocaleString("id-ID")}` : "..."}
          </p>
        </div>
      </div>

      {/* Kode akun: langsung tampil di dashboard, tidak perlu klik dulu */}
      <div className="fade-up delay-1 glass mt-3 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl px-4 py-3 shadow-soft">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber to-amber-bright text-xs font-semibold text-white shadow-3d">
            {(token || "?")[0]?.toUpperCase()}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-teal" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] leading-none text-muted">Kode akun kamu</p>
            <code className="mt-1 block truncate font-mono text-sm font-semibold leading-none text-ink">
              {ready ? token || "-" : "..."}
            </code>
          </div>
        </div>
        <button
          onClick={copyToken}
          className="btn-3d shrink-0 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink transition-colors duration-200 hover:border-amber/40 hover:text-amber-bright"
        >
          {copied ? "Tersalin!" : "Salin kode"}
        </button>
      </div>

      {/* Hero banner */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="glow-ring fade-up delay-1 rounded-3xl">
          <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-8 shadow-card-3d sm:px-10 sm:py-11">
            <div className="absolute -right-14 -top-20 h-64 w-64 rounded-full bg-amber/30 blur-3xl" />
            <div className="absolute -bottom-20 left-6 h-52 w-52 rounded-full bg-teal/25 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle,white_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-soft/90">Layanan utama</p>
              <h1 className="mt-3 font-display text-3xl font-semibold leading-[1.05] tracking-tight text-white sm:text-display-md">
                Nomor OTP siap pakai,
                <br className="hidden sm:block" /> ratusan layanan
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/65">
                Praktis dan aman digunakan — dari deposit sampai kode OTP, semuanya berjalan otomatis.
              </p>
              <Link
                href="/otp"
                className="btn-3d mt-6 inline-flex items-center gap-1.5 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-ink shadow-3d transition-colors hover:bg-amber hover:text-white"
              >
                Beli Nomor
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="transition-transform group-hover:translate-x-0.5">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        <div className="fade-up delay-2">
          <TiltCard strength={6} glare={false}>
            <OtpMascot />
          </TiltCard>
        </div>
      </div>

      {/* Quick actions */}
      <div className="fade-up delay-2 glass mt-4 grid grid-cols-5 gap-2 rounded-2xl p-4 shadow-soft sm:gap-4 sm:p-5">
        {quickActions.map((a) => (
          <TiltCard key={a.href} strength={14} className="rounded-xl">
            <Link href={a.href} className="flex flex-col items-center gap-2 rounded-xl p-1.5 text-center">
              <span className={`flex h-12 w-12 items-center justify-center rounded-full ${a.bg} ${a.fg} ${a.glow} transition-transform duration-200`}>
                {a.icon}
              </span>
              <span className="text-xs font-medium text-ink sm:text-sm">{a.label}</span>
            </Link>
          </TiltCard>
        ))}
      </div>

      {/* Status / value props grid */}
      <div className="fade-up delay-3 mt-12">
        <h2 className="font-display text-display-sm font-semibold text-ink">Kenapa pakai Artapedia</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {statusItems.map((s) => (
            <TiltCard key={s.title} strength={6} className="rounded-2xl">
              <div className="glass flex h-full items-start justify-between gap-3 rounded-2xl p-4 shadow-soft transition-shadow duration-300 hover:shadow-card-3d">
                <div>
                  <p className="text-sm font-medium text-ink">{s.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{s.desc}</p>
                </div>
                <span className="mt-1 flex shrink-0 items-center gap-1.5 rounded-full bg-teal-soft px-2.5 py-1 text-[11px] font-medium text-teal-bright">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                  Aktif
                </span>
              </div>
            </TiltCard>
          ))}
        </div>
      </div>

      {/* Service available */}
      <div className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-display-sm font-semibold text-ink">Layanan Tersedia</h2>
          <Link href="/otp" className="underline-grow text-xs font-medium text-teal-bright">
            Lihat semua
          </Link>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {["Semua", "Populer", "Chat", "Marketplace"].map((tab, i) => (
            <span
              key={tab}
              className={`btn-3d shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                i === 0 ? "border-ink bg-ink text-white" : "border-line text-muted hover:border-amber/40 hover:text-ink"
              }`}
            >
              {tab}
            </span>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {servicesLoading
            ? Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="skeleton h-[92px] rounded-2xl border border-line" />
              ))
            : services.map((s, i) => (
                <TiltCard key={s.service_code} strength={10} className="rounded-2xl" style={{ animationDelay: `${0.03 * i}s` }}>
                  <Link
                    href={`/otp?q=${encodeURIComponent(s.service_name || "")}`}
                    className="scale-in glass flex flex-col items-center gap-2 rounded-2xl p-3 text-center shadow-soft transition-shadow duration-300 hover:shadow-card-3d"
                  >
                    {s.service_img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.service_img} alt="" className="h-8 w-8 rounded object-contain" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded bg-surface2 text-xs text-muted">
                        {(s.service_name || "?")[0]}
                      </span>
                    )}
                    <span className="line-clamp-1 text-[11px] font-medium text-ink">{s.service_name}</span>
                  </Link>
                </TiltCard>
              ))}
        </div>
      </div>

      {/* Cara kerja */}
      <div className="glass mt-12 rounded-3xl px-5 py-9 shadow-soft sm:px-10">
        <h2 className="font-display text-display-sm font-semibold text-ink">Cara kerjanya</h2>
        <div className="mt-7 grid gap-7 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="hover-lift rounded-2xl p-1">
              <span className="btn-3d flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-ink to-[#1D2A4A] font-display text-sm text-white shadow-3d">
                {s.n}
              </span>
              <h3 className="mt-3.5 font-display text-base font-medium text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="glow-ring mt-12 rounded-3xl">
        <div className="relative overflow-hidden rounded-3xl bg-surface px-6 py-12 text-center shadow-card-3d sm:px-16">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-teal/20 blur-3xl" />
          <h2 className="relative font-display text-display-sm font-semibold text-ink">Siap coba sekarang?</h2>
          <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            Mulai dari deposit Rp2.000. Kode akun kamu sudah siap dipakai, tidak perlu daftar apa pun.
          </p>
          <Link
            href="/deposit"
            className="btn-3d relative mt-6 inline-block rounded-lg bg-gradient-to-r from-amber to-amber-bright px-6 py-3 text-sm font-medium text-white shadow-3d transition-colors"
          >
            Deposit sekarang
          </Link>
        </div>
      </div>
    </div>
  );
}
