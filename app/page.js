"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";
import SignalCard from "@/components/SignalCard";

const quickActions = [
  {
    href: "/otp",
    label: "Nomor OTP",
    bg: "bg-amber-soft",
    fg: "text-amber-bright",
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
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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
      {/* Dashboard header: brand + balance + akun */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber text-sm font-bold text-white">A</span>
          <span className="font-display text-lg font-semibold text-ink">Artapedia</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="card-shadow rounded-full border border-line bg-surface px-3.5 py-1.5 text-right">
            <p className="text-[11px] leading-none text-muted">Saldo kamu</p>
            <p className="mt-0.5 text-sm font-semibold leading-none text-ink">
              {ready ? `Rp${balance.toLocaleString("id-ID")}` : "..."}
            </p>
          </div>
          <button
            onClick={copyToken}
            title="Salin kode akun"
            className="card-shadow relative flex h-10 w-10 items-center justify-center rounded-full border border-line bg-amber-soft text-sm font-semibold text-amber-bright"
          >
            {(token || "?")[0]?.toUpperCase()}
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-teal" />
          </button>
        </div>
      </div>
      {copied && <p className="mt-1.5 text-right text-xs text-teal-bright">Kode akun disalin</p>}

      {/* Hero banner */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="card-shadow relative overflow-hidden rounded-2xl bg-ink px-6 py-7 sm:px-8">
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-teal/25 blur-3xl" />
          <div className="absolute -bottom-16 left-10 h-48 w-48 rounded-full bg-amber/20 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-medium uppercase tracking-wide text-teal-bright/90">Layanan utama</p>
            <h1 className="mt-3 font-display text-2xl font-semibold leading-tight text-white sm:text-3xl">
              Nomor OTP siap pakai, ratusan layanan
            </h1>
            <p className="mt-2 max-w-md text-sm text-white/70">
              Praktis dan aman digunakan — dari deposit sampai kode OTP, semuanya berjalan otomatis.
            </p>
            <Link
              href="/otp"
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-white/90"
            >
              Beli Nomor
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="hidden lg:block">
          <SignalCard />
        </div>
      </div>

      {/* Quick actions */}
      <div className="card-shadow mt-4 grid grid-cols-4 gap-2 rounded-2xl border border-line bg-surface p-4 sm:gap-4 sm:p-5">
        {quickActions.map((a) => (
          <Link key={a.href} href={a.href} className="flex flex-col items-center gap-2 text-center">
            <span className={`flex h-12 w-12 items-center justify-center rounded-full ${a.bg} ${a.fg}`}>{a.icon}</span>
            <span className="text-xs font-medium text-ink sm:text-sm">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Status / value props grid */}
      <div className="mt-10">
        <h2 className="font-display text-lg font-semibold text-ink sm:text-xl">Kenapa pakai Artapedia</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {statusItems.map((s) => (
            <div key={s.title} className="card-shadow flex items-start justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
              <div>
                <p className="text-sm font-medium text-ink">{s.title}</p>
                <p className="mt-1 text-xs text-muted">{s.desc}</p>
              </div>
              <span className="mt-1 flex shrink-0 items-center gap-1.5 rounded-full bg-teal-soft px-2.5 py-1 text-[11px] font-medium text-teal-bright">
                <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                Aktif
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Service available */}
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink sm:text-xl">Layanan Tersedia</h2>
          <Link href="/otp" className="text-xs font-medium text-teal-bright hover:underline">
            Lihat semua
          </Link>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {["Semua", "Populer", "Chat", "Marketplace"].map((tab, i) => (
            <span
              key={tab}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium ${
                i === 0 ? "border-ink bg-ink text-white" : "border-line text-muted"
              }`}
            >
              {tab}
            </span>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {servicesLoading
            ? Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-line bg-surface2 p-4" />
              ))
            : services.map((s) => (
                <Link
                  key={s.service_code}
                  href={`/otp?q=${encodeURIComponent(s.service_name || "")}`}
                  className="card-shadow flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-center"
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
              ))}
        </div>
      </div>

      {/* Cara kerja */}
      <div className="mt-10 rounded-2xl border border-line bg-surface2 px-5 py-8 sm:px-8">
        <h2 className="font-display text-lg font-semibold text-ink sm:text-xl">Cara kerjanya</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink font-display text-sm text-white">
                {s.n}
              </span>
              <h3 className="mt-3 font-display text-base font-medium text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-10 rounded-2xl border border-amber/25 bg-amber-soft px-6 py-10 text-center sm:px-16">
        <h2 className="font-display text-xl font-semibold text-ink sm:text-2xl">Siap coba sekarang?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Mulai dari deposit Rp2.000. Kode akun kamu sudah siap dipakai, tidak perlu daftar apa pun.
        </p>
        <Link
          href="/deposit"
          className="mt-5 inline-block rounded-lg bg-amber px-6 py-3 text-sm font-medium text-white transition hover:bg-amber-bright"
        >
          Deposit sekarang
        </Link>
      </div>
    </div>
  );
}
