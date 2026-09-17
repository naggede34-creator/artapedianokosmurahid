"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SimCard from "@/components/SimCard";
import TransactionTicker from "@/components/TransactionTicker";
import { Icon, rupiah } from "@/components/ui";
import { platformIcon } from "@/components/PlatformIcon";

const products = [
  {
    href: "/otp",
    title: "Beli nokos",
    desc: "Nomor OTP WhatsApp, Telegram, Google & ratusan aplikasi lain.",
    icon: Icon.phone,
    tone: "bg-amber text-white"
  },
  {
    href: "/suntik",
    title: "Suntik sosmed",
    desc: "Followers, likes, views untuk Instagram, TikTok, YouTube, dll.",
    icon: Icon.rocket,
    tone: "bg-teal-bright text-white"
  },
  {
    href: "/deposit",
    title: "Isi saldo",
    desc: "Bayar pakai QRIS dari e-wallet atau m-banking apa pun.",
    icon: Icon.qris,
    tone: "bg-success text-white"
  },
  {
    href: "/riwayat",
    title: "Riwayat",
    desc: "Pantau kode OTP, progres suntik, dan status deposit.",
    icon: Icon.history,
    tone: "bg-surface3 text-ink"
  }
];

const steps = [
  { title: "Isi saldo lewat QRIS", desc: "Mulai dari Rp2.000. Saldo masuk otomatis begitu pembayaran terdeteksi." },
  { title: "Pilih layanan", desc: "Nomor OTP per negara & server, atau paket suntik sesuai platform. Harga tampil di depan." },
  { title: "Terima hasilnya", desc: "Kode OTP muncul sendiri di halaman pesanan. Suntik berjalan otomatis sampai selesai." }
];

export default function HomePage() {
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [platforms, setPlatforms] = useState([]);

  useEffect(() => {
    fetch("/api/otp/services")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d.items) ? d.items : [];
        const wa = list.filter((s) => /whatsapp/i.test(s.service_name || ""));
        const rest = list.filter((s) => !/whatsapp/i.test(s.service_name || ""));
        setServices([...wa, ...rest].slice(0, 12));
      })
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
    fetch("/api/smm/platforms")
      .then((r) => r.json())
      .then((d) => setPlatforms(Array.isArray(d.items) ? d.items.slice(0, 8) : []))
      .catch(() => setPlatforms([]));
  }, []);

  return (
    <div className="mx-auto max-w-content px-4 pb-10 pt-4 sm:px-5 sm:pt-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_440px] lg:items-center lg:gap-12">
        <div className="order-2 lg:order-1">
          <h1 className="text-[30px] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-[44px]">
            Nokos, suntik sosmed,
            <br />
            dan isi saldo QRIS
            <span className="text-muted"> — tanpa daftar.</span>
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
            Kode akun kamu sudah dibuat otomatis. Isi saldo, pilih layanan, dan semuanya diproses sistem 24 jam.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/otp" className="btn-primary px-5">
              Beli nomor OTP
            </Link>
            <Link href="/suntik" className="btn-ghost px-5">
              Suntik sosmed
            </Link>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <SimCard />
        </div>
      </section>

      <TransactionTicker />

      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {products.map((p) => {
          const I = p.icon;
          return (
            <Link key={p.href} href={p.href} className="card hover-lift group flex flex-col gap-3 p-4 sm:p-5">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${p.tone}`}>
                <I width={22} height={22} />
              </span>
              <div>
                <p className="flex items-center gap-1 text-[15px] font-bold text-ink">
                  {p.title}
                  <Icon.chevron className="text-muted transition-transform group-hover:translate-x-0.5" />
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{p.desc}</p>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-ink">Aplikasi paling dicari</h2>
            <p className="mt-1 text-sm text-muted">Ketuk untuk langsung pilih negara & server.</p>
          </div>
          <Link href="/otp" className="shrink-0 text-sm font-semibold text-amber-bright">
            Semua aplikasi
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
          {servicesLoading
            ? Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton h-[88px] rounded-2xl" />)
            : services.map((s) => (
                <Link
                  key={s.service_code}
                  href={`/otp?q=${encodeURIComponent(s.service_name || "")}`}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-center transition-colors hover:border-amber/40"
                >
                  {s.service_img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.service_img} alt="" className="h-9 w-9 rounded-lg object-contain" loading="lazy" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface2 text-sm font-bold text-muted">
                      {(s.service_name || "?")[0]}
                    </span>
                  )}
                  <span className="line-clamp-1 text-xs font-semibold text-ink">{s.service_name}</span>
                </Link>
              ))}
        </div>
      </section>

      {platforms.length > 0 && (
        <section className="mt-12">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line p-5">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-ink">Suntik sosmed</h2>
                <p className="mt-1 text-sm text-muted">Harga mulai per 1.000 — pilih platform untuk lihat paketnya.</p>
              </div>
              <Link href="/suntik" className="btn-dark px-4 py-2.5">
                Mulai suntik
              </Link>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4">
              {platforms.map((p) => (
                <Link
                  key={p.platform}
                  href={`/suntik?platform=${encodeURIComponent(p.platform)}`}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-surface2"
                >
                  {platformIcon(p.platform, 32)}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-ink">{p.platform}</span>
                    <span className="block text-xs text-muted">mulai {rupiah(p.minPrice)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-xl font-extrabold tracking-tight text-ink">Cara kerjanya</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-[20px] border border-dashed border-line p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-bg">{i + 1}</span>
              <h3 className="mt-3 text-[15px] font-bold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
