"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HeroMascot from "@/components/HeroMascot";
import KartuSaldo from "@/components/KartuSaldo";
import TransactionTicker from "@/components/TransactionTicker";
import LiveTicker from "@/components/LiveTicker";
import BannerRail from "@/components/BannerRail";
import ChannelNotifCard from "@/components/ChannelNotifCard";
import GatewayTeaser from "@/components/GatewayTeaser";
import { useUser } from "@/app/providers";

const LANGKAH = [
  { no: "01", judul: "Isi saldo QRIS", isi: "Mulai Rp2.000, bayar dari e-wallet atau m-banking apa pun. Saldo masuk otomatis.", ikon: "💳", warna: "bg-amber text-white" },
  { no: "02", judul: "Pilih layanan & negara", isi: "Harga tampil di depan, tanpa biaya tersembunyi. Pilih server yang stoknya ada.", ikon: "🎯", warna: "bg-teal-bright text-white" },
  { no: "03", judul: "Terima kode OTP", isi: "Kode muncul langsung di halaman pesanan. Gagal masuk? Saldo kembali otomatis.", ikon: "⚡", warna: "bg-success text-white" }
];

const KEUNGGULAN = [
  { ikon: "⚡", judul: "Proses instan", isi: "Pesanan langsung jalan, kode OTP masuk otomatis." },
  { ikon: "🛡️", judul: "Garansi refund", isi: "Nomor bermasalah atau kedaluwarsa? Saldo dikembalikan." },
  { ikon: "🔒", judul: "Tanpa data pribadi", isi: "Cukup kode akun. Tidak perlu email atau nomor HP." },
  { ikon: "🕒", judul: "Aktif 24 jam", isi: "Deposit QRIS dan pembelian nomor jalan kapan saja." }
];

const TANYA = [
  { q: "Berapa lama kode OTP masuk?", a: "Biasanya hitungan detik sampai 1–2 menit, tergantung aplikasi tujuan. Kode muncul sendiri di halaman pesanan — tidak perlu muat ulang." },
  { q: "Bagaimana kalau OTP tidak masuk?", a: "Batalkan pesanan atau tunggu sampai kedaluwarsa; saldo otomatis kembali. Untuk nomor yang bermasalah setelah dipakai, ajukan klaim garansi dari dasbor." },
  { q: "Metode bayar apa saja?", a: "QRIS — bisa dari GoPay, OVO, DANA, ShopeePay, LinkAja, dan semua m-banking. Minimal deposit mengikuti pengaturan toko." },
  { q: "Apakah ada API untuk developer?", a: "Ada. Buat API key di halaman API untuk membeli nokos otomatis dari aplikasimu, dan pakai QRIS Gateway untuk menerima pembayaran." }
];

function Judul({ lencana, judul, sub }) {
  return (
    <div className="mb-5 text-center">
      {lencana && <span className="inline-block rounded-full border-2 border-ink bg-amber-soft px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-bright">{lencana}</span>}
      <h2 className="mt-2 font-display text-3xl tracking-wide text-ink sm:text-4xl">{judul}</h2>
      {sub && <p className="mx-auto mt-1.5 max-w-xl text-sm text-muted">{sub}</p>}
    </div>
  );
}

export default function HomePage() {
  const { token, ready } = useUser();
  const [layanan, setLayanan] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [stat, setStat] = useState(null);
  const [buka, setBuka] = useState(0);

  useEffect(() => {
    fetch("/api/otp/services")
      .then((r) => r.json())
      .then((d) => {
        const daftar = Array.isArray(d.items) ? d.items : [];
        const wa = daftar.filter((s) => /whatsapp/i.test(s.service_name || ""));
        const sisa = daftar.filter((s) => !/whatsapp/i.test(s.service_name || ""));
        setLayanan([...wa, ...sisa].slice(0, 12));
      })
      .catch(() => setLayanan([]))
      .finally(() => setMemuat(false));
    fetch("/api/stats/public").then((r) => r.json()).then(setStat).catch(() => {});
  }, []);

  // Angka hanya ditampilkan kalau memang ada isinya: "0 pesanan" di halaman depan merugikan.
  const statSiap = stat && (Number(stat.users) > 0 || Number(stat.orders) > 0);

  return (
    <div className="mx-auto max-w-content px-4 pb-12 pt-4 sm:px-5 sm:pt-8">
      {/* ===== HERO ===== */}
      <section
        data-parallax-root
        className="hd-panel hd-paper ink-edge ink-edge-lg relative mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-surface via-surface to-amber-soft p-6 sm:p-10 lg:grid lg:grid-cols-[1fr_420px] lg:items-center lg:gap-12"
        style={{ border: "3px solid rgb(var(--c-ink))" }}
      >
        <div data-parallax="-1.6" className="speed-lines pointer-events-none absolute -inset-8 opacity-50" />
        <div className="relative order-2 lg:order-1 lg:pb-2">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-teal-soft px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-teal-bright" style={{ boxShadow: "2px 2px 0 rgb(var(--c-ink))" }}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="pulse-live absolute inset-0 inline-flex rounded-full bg-teal-bright opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-bright" />
            </span>
            Aktif 24 jam · Proses instan
          </div>
          <h1 className="font-display text-[40px] leading-[1.02] tracking-wide text-ink sm:text-[58px]">
            Nomor OTP murah,
            <br />
            <span className="text-gradient-blue">cepat &amp; aman.</span>
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
            Beli nokos untuk WhatsApp, Telegram, Google dan ratusan aplikasi lain. Bayar QRIS, kode OTP muncul otomatis.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/otp" className="shine btn-glow inline-flex items-center gap-2 rounded-2xl bg-amber px-7 py-3.5 text-sm font-black uppercase tracking-wider text-white" style={{ border: "3px solid rgb(var(--c-ink))", boxShadow: "4px 4px 0 rgb(var(--c-ink))" }}>
              🚀 Beli Nomor OTP
            </Link>
            <Link href="/deposit" className="shine btn-glow inline-flex items-center gap-2 rounded-2xl bg-surface px-6 py-3.5 text-sm font-black uppercase tracking-wider text-ink" style={{ border: "3px solid rgb(var(--c-ink))", boxShadow: "4px 4px 0 rgb(var(--c-ink))" }}>
              💳 Isi Saldo
            </Link>
          </div>
          {statSiap && (
            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm" data-testid="stat-beranda">
              {Number(stat.users) > 0 && <div><dt className="text-[11px] font-bold uppercase tracking-wider text-muted">Pengguna</dt><dd className="font-display text-2xl text-ink">{Number(stat.users).toLocaleString("id-ID")}</dd></div>}
              {Number(stat.orders) > 0 && <div><dt className="text-[11px] font-bold uppercase tracking-wider text-muted">Pesanan sukses</dt><dd className="font-display text-2xl text-ink">{Number(stat.orders).toLocaleString("id-ID")}</dd></div>}
            </dl>
          )}
        </div>

        <div className="relative z-10 order-1 lg:order-2 lg:self-start">
          {ready && token ? (
            <KartuSaldo />
          ) : (
            <div className="card balok-3d p-5 text-center">
              <p className="font-display text-2xl tracking-wide text-ink">Mulai dalam 10 detik</p>
              <p className="mt-1 text-sm text-muted">Kode akun dibuat otomatis — tanpa email.</p>
              <Link href="/dashboard" className="btn-3d mt-4 inline-block rounded-xl bg-amber px-6 py-2.5 text-sm font-black text-white">Masuk ke Dasbor</Link>
            </div>
          )}
        </div>
        <HeroMascot />
      </section>

      <BannerRail placement="homepage" className="mt-6" />

      {/* ===== TRANSAKSI LIVE ===== */}
      <section className="mt-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="pulse-live inline-flex h-2 w-2 rounded-full bg-success" />
          <p className="text-xs font-black uppercase tracking-wider text-muted">Pembelian terbaru</p>
        </div>
        <TransactionTicker />
        <LiveTicker />
      </section>
      <ChannelNotifCard className="mt-5" />

      {/* ===== LAYANAN POPULER ===== */}
      <section className="mt-12">
        <Judul lencana="Populer" judul="Layanan favorit" sub="Pilih aplikasi, lalu negara & server. Harga tampil sebelum kamu bayar." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {memuat
            ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)
            : layanan.map((s) => (
                <Link key={s.service_code} href={`/otp?q=${encodeURIComponent(s.service_name || "")}`} className="card hover-lift flex items-center gap-3 p-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-soft text-lg font-black text-amber-bright">{String(s.service_name || "?").charAt(0).toUpperCase()}</span>
                  <span className="min-w-0 truncate text-sm font-bold text-ink">{s.service_name}</span>
                </Link>
              ))}
        </div>
        <div className="mt-4 text-center">
          <Link href="/otp" className="text-sm font-bold text-amber-bright hover:underline">Lihat semua layanan →</Link>
        </div>
      </section>

      {/* ===== CARA KERJA ===== */}
      <section className="mt-14">
        <Judul lencana="Cara kerja" judul="3 langkah, selesai" />
        <div className="grid gap-4 md:grid-cols-3">
          {LANGKAH.map((l) => (
            <div key={l.no} className="card hover-lift relative p-5">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${l.warna}`} style={{ boxShadow: "3px 3px 0 rgb(var(--c-ink))" }}>{l.ikon}</span>
              <span className="absolute right-4 top-3 font-display text-4xl text-ink/10">{l.no}</span>
              <h3 className="mt-4 text-base font-extrabold text-ink">{l.judul}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{l.isi}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== KEUNGGULAN ===== */}
      <section className="mt-14 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KEUNGGULAN.map((k) => (
          <div key={k.judul} className="card p-4">
            <span className="text-2xl" aria-hidden="true">{k.ikon}</span>
            <p className="mt-2 text-sm font-extrabold text-ink">{k.judul}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{k.isi}</p>
          </div>
        ))}
      </section>

      {/* ===== BISNIS & DEVELOPER ===== */}
      <section className="mt-14">
        <Judul lencana="Untuk bisnis" judul="Otomatiskan semuanya" />
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/apikey" className="card hover-lift tepi-tebal group block p-5 sm:p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-soft text-2xl">🔑</span>
            <h3 className="mt-3 text-lg font-extrabold text-ink">API Nokos</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">Beli nomor OTP dari aplikasimu sendiri lewat API key. Dokumentasi lengkap, harga sama dengan di web.</p>
            <span className="mt-3 inline-block text-sm font-bold text-amber-bright group-hover:underline">Buat API key →</span>
          </Link>
          <GatewayTeaser />
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="mt-14">
        <Judul lencana="FAQ" judul="Pertanyaan umum" />
        <div className="mx-auto max-w-2xl space-y-2.5">
          {TANYA.map((t, i) => (
            <div key={t.q} className="card overflow-hidden">
              <button onClick={() => setBuka(buka === i ? -1 : i)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left" aria-expanded={buka === i}>
                <span className="text-sm font-bold text-ink">{t.q}</span>
                <span className="shrink-0 text-muted" aria-hidden="true">{buka === i ? "−" : "+"}</span>
              </button>
              {buka === i && <p className="border-t border-line px-4 py-3 text-sm leading-relaxed text-muted">{t.a}</p>}
            </div>
          ))}
          <p className="pt-1 text-center text-sm"><Link href="/faq" className="font-bold text-amber-bright hover:underline">Pertanyaan lainnya →</Link></p>
        </div>
      </section>

      {/* ===== CTA AKHIR ===== */}
      <section className="mt-14">
        <div className="hd-panel rounded-3xl bg-gradient-to-br from-amber to-[#9a3412] p-8 text-center text-white" style={{ border: "3px solid rgb(var(--c-ink))" }}>
          <h2 className="font-display text-3xl tracking-wide sm:text-4xl">Siap beli nomor pertamamu?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/85">Isi saldo mulai Rp2.000, pilih layanan, kode OTP masuk otomatis.</p>
          <Link href="/otp" className="btn-3d mt-5 inline-block rounded-2xl bg-white px-8 py-3 text-sm font-black uppercase tracking-wider text-ink">Mulai Sekarang</Link>
        </div>
      </section>
    </div>
  );
}
