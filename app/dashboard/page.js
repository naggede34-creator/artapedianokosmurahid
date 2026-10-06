"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/providers";
import KartuSaldo from "@/components/KartuSaldo";
import GaransiModal from "@/components/GaransiModal";
import TiketBantuan from "@/components/TiketBantuan";
import NamePromptModal from "@/components/NamePromptModal";
import BannerRail from "@/components/BannerRail";
import OTPPriceWidget from "@/components/OTPPriceWidget";
import { rupiah, EmptyState } from "@/components/ui";

function sapaan() {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false }));
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

function Bars({ data, keyName, className }) {
  const max = Math.max(1, ...data.map((d) => d[keyName]));
  return (
    <div className="flex h-24 items-end gap-[3px]" role="img" aria-label={`Grafik ${keyName} 30 hari`}>
      {data.map((d) => (
        <span
          key={d.date}
          title={`${d.date}: ${keyName === "total" ? d[keyName] : rupiah(d[keyName])}`}
          className={`flex-1 rounded-t-[3px] ${d[keyName] > 0 ? className : "bg-surface2"}`}
          style={{ height: `${Math.max(4, (d[keyName] / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

// Jalan pintas: nokos & uang di baris atas, sisanya di bawah.
const AKSI = [
  { href: "/otp", label: "Beli Nokos", sub: "Nomor OTP termurah", ikon: "📱", warna: "from-[#1d4ed8] to-[#0a1e50]" },
  { href: "/deposit", label: "Isi Saldo", sub: "QRIS semua e-wallet", ikon: "💳", warna: "from-[#ea580c] to-[#9a3412]" },
  { href: "/riwayat", label: "Riwayat", sub: "Pesanan & deposit", ikon: "🧾", warna: "from-[#0891b2] to-[#164e63]" },
  { href: "/gateway", label: "QRIS Gateway", sub: "Terima bayaran QRIS", ikon: "💸", warna: "from-[#059669] to-[#064e3b]" },
  { href: "/apikey", label: "API Key", sub: "Beli nokos otomatis", ikon: "🔑", warna: "from-[#9333ea] to-[#3b0764]" },
  { href: "/referral", label: "Undang Teman", sub: "Dapat bonus saldo", ikon: "🎁", warna: "from-[#dc2626] to-[#7f1d1d]" }
];

export default function DashboardPage() {
  const { token, name, ready, balance } = useUser();
  const [stats, setStats] = useState(null);
  const [pesanan, setPesanan] = useState(null);
  const [garansiAktif, setGaransiAktif] = useState(true);
  const [garansiBuka, setGaransiBuka] = useState(false);
  const [csUser, setCsUser] = useState("teatlas");
  const [tanyaNama, setTanyaNama] = useState(false);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        if (d?.csUsername) setCsUser(String(d.csUsername).replace(/^@/, ""));
        setGaransiAktif(d?.warranty?.enabled !== false);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    const t = encodeURIComponent(token);
    fetch(`/api/user/stats?token=${t}`).then((r) => r.json()).then((d) => setStats(d.error ? { daily: [] } : d)).catch(() => setStats({ daily: [] }));
    fetch(`/api/otp/history?token=${t}&limit=5`).then((r) => r.json()).then((d) => setPesanan(Array.isArray(d.items) ? d.items.slice(0, 5) : [])).catch(() => setPesanan([]));
  }, [token]);

  // Minta nama sekali saja (tidak memaksa): ditunda 3 hari kalau ditutup.
  useEffect(() => {
    if (!ready || name) return;
    try {
      const tutup = localStorage.getItem("artapedia_name_dismissed");
      if (tutup && Date.now() - Number(tutup) < 3 * 24 * 3600_000) return;
    } catch {}
    const t = setTimeout(() => setTanyaNama(true), 1500);
    return () => clearTimeout(t);
  }, [ready, name]);

  const adaPesanan = useMemo(() => stats?.daily?.some((d) => d.total > 0), [stats]);
  const arus = useMemo(
    () => (stats?.daily || []).reduce((a, d) => ({ masuk: a.masuk + d.masuk, keluar: a.keluar + d.keluar }), { masuk: 0, keluar: 0 }),
    [stats]
  );

  return (
    <div className="user-dash mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      {tanyaNama && <NamePromptModal onClose={() => setTanyaNama(false)} />}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">{ready ? sapaan() : "Halo"},</p>
          <h1 className="truncate font-display text-3xl tracking-wide text-ink sm:text-4xl">{ready ? name || "Pelanggan Artapedia" : "…"}</h1>
        </div>
        <Link href="/profil" className="btn-3d flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-bold text-ink">
          👤 Profil akun
        </Link>
      </header>

      {ready && balance !== undefined && balance < 2000 && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-amber/40 bg-amber-soft px-4 py-3">
          <p className="text-sm font-bold text-amber-bright">⚠️ Saldo hampir habis — isi dulu supaya bisa terus beli nomor.</p>
          <Link href="/deposit" className="shrink-0 rounded-xl bg-amber px-4 py-2 text-xs font-bold text-white">Isi Saldo</Link>
        </div>
      )}

      <KartuSaldo className="mt-5 md:max-w-2xl" />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="aksi-utama">
        {AKSI.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`hover-lift group flex items-center gap-3 rounded-2xl border-2 border-ink/80 bg-gradient-to-br px-4 py-4 text-white shadow-lift transition-transform active:scale-[0.98] ${a.warna}`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-2xl transition-transform group-hover:scale-110">{a.ikon}</span>
            <span className="min-w-0">
              <span className="block text-sm font-black leading-tight">{a.label}</span>
              <span className="mt-0.5 block text-[11px] font-medium leading-snug text-white/80">{a.sub}</span>
            </span>
          </Link>
        ))}
      </div>

      <BannerRail placement="dashboard" className="mt-5" />

      <section className="card mt-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">🧾 Pesanan terakhir</h2>
          <Link href="/riwayat" className="text-xs font-semibold text-amber-bright hover:underline">Lihat semua →</Link>
        </div>
        {pesanan === null ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
        ) : pesanan.length === 0 ? (
          <EmptyState icon="📱" title="Belum ada pesanan" desc="Beli nomor pertamamu — prosesnya cuma beberapa detik." action={<Link href="/otp" className="btn-3d rounded-xl bg-amber px-4 py-2 text-sm font-black text-white">Beli Nokos</Link>} />
        ) : (
          <div className="space-y-2">
            {pesanan.map((o) => (
              <div key={o.orderId} className="flex items-center gap-3 rounded-xl border border-line bg-surface2 px-3.5 py-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${o.status === "done" || o.status === "success" ? "bg-teal-soft text-teal-bright" : o.status === "canceled" || o.status === "cancelled" || o.status === "expired" ? "bg-rose-soft text-rose" : "bg-amber-soft text-amber-bright"}`}>
                  {o.status === "done" || o.status === "success" ? "✓" : o.status === "canceled" || o.status === "cancelled" || o.status === "expired" ? "✗" : "⏳"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{o.serviceName} — {o.countryName}</p>
                  <p className="text-xs text-muted">{o.phoneNumber || "—"} · #{o.orderId?.slice(-8)}</p>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-ink">{rupiah(o.price)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-5">
        <OTPPriceWidget />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold text-ink">Pesanan 30 hari</h2>
            <span className="text-xs text-muted">{stats?.totalTransaksi ?? 0} transaksi · {stats?.otpBerhasil ?? 0} berhasil</span>
          </div>
          {!stats ? <div className="skeleton mt-4 h-24 rounded-xl" /> : adaPesanan ? <div className="mt-4"><Bars data={stats.daily} keyName="total" className="bg-amber" /></div> : <EmptyState icon="📈" title="Belum ada pesanan bulan ini" />}
        </div>
        <div className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold text-ink">Arus saldo 30 hari</h2>
            <span className="text-xs">
              <span className="font-semibold text-success">+{rupiah(arus.masuk)}</span>
              <span className="text-muted"> / </span>
              <span className="font-semibold text-rose">−{rupiah(arus.keluar)}</span>
            </span>
          </div>
          {!stats ? <div className="skeleton mt-4 h-24 rounded-xl" /> : arus.masuk + arus.keluar > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div><Bars data={stats.daily} keyName="masuk" className="bg-success" /><p className="mt-1.5 text-center text-[11px] text-muted">Masuk</p></div>
              <div><Bars data={stats.daily} keyName="keluar" className="bg-rose" /><p className="mt-1.5 text-center text-[11px] text-muted">Keluar</p></div>
            </div>
          ) : <EmptyState icon="💼" title="Belum ada pergerakan saldo" />}
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-black uppercase tracking-wider text-ink">Bantuan</h2>
      <div className="grid gap-3 sm:grid-cols-3" data-testid="bantuan-cepat">
        <a href={`https://t.me/${csUser}`} target="_blank" rel="noopener noreferrer" className="card hover-lift flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-soft text-2xl">✈️</span>
          <span><b className="block text-sm text-ink">Customer Service</b><small className="text-xs text-muted">Telegram @{csUser}</small></span>
        </a>
        {garansiAktif && (
          <button onClick={() => setGaransiBuka(true)} className="card hover-lift flex items-center gap-3 p-4 text-left">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-soft text-2xl">🛡️</span>
            <span><b className="block text-sm text-ink">Klaim Garansi</b><small className="text-xs text-muted">Nomor bermasalah? Saldo kembali</small></span>
          </button>
        )}
        <Link href="/cara-pakai" className="card hover-lift flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-soft text-2xl">📖</span>
          <span><b className="block text-sm text-ink">Cara Pakai</b><small className="text-xs text-muted">Panduan beli nokos</small></span>
        </Link>
      </div>
      <div className="mt-4"><TiketBantuan /></div>

      <GaransiModal open={garansiBuka} onClose={() => setGaransiBuka(false)} token={token} />
    </div>
  );
}
