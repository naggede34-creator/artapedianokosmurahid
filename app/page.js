"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SimCard from "@/components/SimCard";
import TransactionTicker from "@/components/TransactionTicker";
import LiveTicker from "@/components/LiveTicker";
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

const TESTIMONIALS = [
  { name: "Budi S.", loc: "Jakarta", text: "OTP WhatsApp langsung masuk dalam 30 detik. Sangat cepat dan harganya terjangkau!", rating: 5, avatar: "BS" },
  { name: "Rizky A.", loc: "Surabaya", text: "Udah langganan 3 bulan, belum pernah kecewa. CS responsif kalau ada masalah.", rating: 5, avatar: "RA" },
  { name: "Dewi P.", loc: "Bandung", text: "Beli followers Instagram disini hasilnya nyata dan bertahan lama. Recommended!", rating: 5, avatar: "DP" },
  { name: "Anto W.", loc: "Medan", text: "Deposit QRIS dari mana pun langsung masuk. Mudah dan aman banget.", rating: 5, avatar: "AW" },
  { name: "Siti N.", loc: "Yogyakarta", text: "Harga lebih murah dari tempat lain, tapi kualitasnya sama bagusnya. Puas!", rating: 5, avatar: "SN" },
  { name: "Fajar M.", loc: "Makassar", text: "Fitur garansi bikin tenang. Pas nomor bermasalah langsung direfund. Top!", rating: 5, avatar: "FM" }
];

const TRUST_BADGES = [
  { icon: "⚡", label: "Proses Instan", desc: "OTP masuk otomatis" },
  { icon: "🔒", label: "100% Aman", desc: "Transaksi terenkripsi" },
  { icon: "🛡️", label: "Garansi Refund", desc: "Nomor bermasalah? Kami refund" },
  { icon: "🕐", label: "24/7 Aktif", desc: "Layanan tidak pernah tutup" },
  { icon: "💳", label: "QRIS Resmi", desc: "Semua e-wallet & m-banking" },
  { icon: "🤝", label: "50.000+ User", desc: "Dipercaya banyak pengguna" }
];

const FAQS = [
  { q: "Apa itu nokos?", a: "Nokos (nomor sekali pakai) adalah nomor telepon virtual yang bisa kamu gunakan untuk menerima kode OTP dari aplikasi seperti WhatsApp, Telegram, Google, dll. Tanpa perlu kartu SIM fisik." },
  { q: "Berapa lama OTP masuk?", a: "Biasanya 5–60 detik setelah kamu meminta pengiriman OTP. Sistem kami memantau nomor secara real-time dan kode langsung tampil di halaman pesanan." },
  { q: "Apakah aman menggunakan Artapedia?", a: "Ya, sangat aman. Tidak ada data pribadi yang diminta. Kamu hanya perlu kode akun unik — tanpa email, tanpa password, tanpa nomor HP." },
  { q: "Bagaimana cara isi saldo?", a: "Buka halaman Deposit, masukkan nominal, pilih metode QRIS, scan kode QR dengan e-wallet atau m-banking mana pun. Saldo masuk otomatis begitu pembayaran terdeteksi." },
  { q: "Berapa minimal deposit?", a: "Minimal deposit hanya Rp2.000 — sangat terjangkau untuk kamu yang ingin coba terlebih dahulu." },
  { q: "Bisa refund kalau nomor bermasalah?", a: "Bisa! Gunakan fitur Klaim Garansi di Dashboard. Isi deskripsi masalah dan screenshot, lalu admin akan memproses dalam 1×24 jam. Jika disetujui, saldo dikembalikan." }
];

function useCountUp(target, duration = 1800) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (!target) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const prog = Math.min((ts - start) / duration, 1);
      setVal(Math.floor(prog * target));
      if (prog < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);
  return val;
}

function StatCounter({ value, suffix = "", label, accent }) {
  const [started, setStarted] = useState(false);
  const elRef = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true); }, { threshold: 0.3 });
    if (elRef.current) obs.observe(elRef.current);
    return () => obs.disconnect();
  }, []);
  const count = useCountUp(started ? value : 0);
  return (
    <div ref={elRef} className="flex flex-col items-center gap-1 text-center">
      <p className={`text-3xl font-extrabold tabular-nums sm:text-4xl ${accent || "text-ink"}`}>
        {count.toLocaleString("id-ID")}{suffix}
      </p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

function FlashSaleBanner() {
  const [timeLeft, setTimeLeft] = useState(null);
  useEffect(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const tick = () => {
      const diff = end - Date.now();
      if (diff <= 0) { setTimeLeft(null); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (!timeLeft) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose to-[#c0392b] px-5 py-4 text-white shadow-soft">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-xl">⚡</span>
          <div>
            <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Flash Sale Hari Ini</p>
            <p className="font-bold text-base">Deposit sekarang, saldo masuk lebih cepat!</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-white/20 px-3 py-1.5 text-center">
            <p className="font-mono text-lg font-extrabold">{timeLeft}</p>
            <p className="text-[10px] text-white/70">Berakhir dalam</p>
          </div>
          <Link href="/deposit" className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-rose transition-transform active:scale-95">
            Deposit &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-4 text-left text-sm font-semibold text-ink hover:text-amber-bright transition-colors"
      >
        <span>{q}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && <p className="pb-4 text-sm leading-relaxed text-muted">{a}</p>}
    </div>
  );
}

export default function HomePage() {
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [platforms, setPlatforms] = useState([]);
  const [siteStats, setSiteStats] = useState(null);

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
    fetch("/api/stats/public")
      .then((r) => r.json())
      .then((d) => setSiteStats(d))
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-content px-4 pb-10 pt-4 sm:px-5 sm:pt-8">

      {/* Flash Sale Banner */}
      <FlashSaleBanner />

      <section className="relative mt-6 grid gap-6 lg:grid-cols-[1fr_440px] lg:items-center lg:gap-12">
        {/* background blobs */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-amber/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-10 h-60 w-60 rounded-full bg-teal/10 blur-3xl" />

        <div className="order-2 lg:order-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal-soft px-3 py-1.5 text-xs font-semibold text-teal-bright mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-teal-bright opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-bright" />
            </span>
            Aktif 24 jam · Proses Instan
          </div>
          <h1 className="text-[32px] font-extrabold leading-[1.06] tracking-tight text-ink sm:text-[46px]">
            Nomor OTP, suntik sosmed,
            <br />
            <span className="bg-gradient-to-r from-amber to-amber-bright bg-clip-text text-transparent">semua di satu tempat.</span>
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
            Tanpa daftar, tanpa email. Kode akun dibuat otomatis — isi saldo dan semua layanan siap dipakai kapan saja.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/otp" className="btn-primary px-6 py-3">
              🚀 Beli Nomor OTP
            </Link>
            <Link href="/deposit" className="btn-ghost px-5 py-3">
              💳 Isi Saldo
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted">
            {["⚡ OTP instan", "🔒 Tanpa data pribadi", "💰 Mulai Rp2.000", "🛡️ Garansi refund"].map((b) => (
              <span key={b} className="flex items-center gap-1">{b}</span>
            ))}
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <SimCard />
        </div>
      </section>

      {/* Live Purchase Ticker */}
      <section className="mt-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-teal-bright opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-bright" />
          </span>
          <p className="text-xs font-semibold text-muted">Pembelian terbaru</p>
        </div>
        <LiveTicker />
      </section>

      {/* Trust Badges */}
      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TRUST_BADGES.map((b) => (
          <div key={b.label} className="group flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-3.5 text-center transition-all hover:border-amber/40 hover:bg-amber-soft/40 hover:-translate-y-0.5 hover:shadow-soft">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-soft text-xl transition-transform group-hover:scale-110">{b.icon}</span>
            <div>
              <p className="text-xs font-bold text-ink">{b.label}</p>
              <p className="text-[11px] text-muted mt-0.5">{b.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <TransactionTicker />

      {/* Animated Stats Counter */}
      {siteStats && (
        <section className="mt-10 overflow-hidden rounded-3xl bg-gradient-to-br from-ink to-[#1a2d5a] px-6 py-8 shadow-lift">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-white/50">Dipercaya Ribuan Pengguna</p>
          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
            <StatCounter value={siteStats.users} suffix="+" label="Pengguna Aktif" accent="text-amber" />
            <StatCounter value={siteStats.orders} suffix="+" label="OTP Berhasil" accent="text-teal-bright" />
            <StatCounter value={siteStats.services} suffix="+" label="Layanan Tersedia" accent="text-white" />
            <StatCounter value={siteStats.countries} suffix=" negara" label="Pilihan Negara" accent="text-amber" />
          </div>
        </section>
      )}

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

      {/* Testimonials */}
      <section className="mt-12">
        <div className="text-center">
          <span className="inline-block rounded-full bg-amber-soft px-3 py-1 text-xs font-semibold text-amber-bright mb-3">⭐ Ulasan Pengguna</span>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink">Dipercaya ribuan pengguna</h2>
          <p className="mt-2 text-sm text-muted">Lihat apa kata mereka setelah pakai Artapedia</p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="card flex flex-col gap-3 p-5 hover:-translate-y-1 transition-transform hover:shadow-lift">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>
                <span className="text-[11px] text-muted">{t.loc}</span>
              </div>
              <p className="text-sm leading-relaxed text-muted">&ldquo;{t.text}&rdquo;</p>
              <div className="mt-auto flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber to-amber-bright text-xs font-extrabold text-white shadow-soft">
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">{t.name}</p>
                  <p className="text-[11px] text-muted">Pengguna Artapedia</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

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

      {/* FAQ */}
      <section className="mt-12">
        <div className="text-center">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">Pertanyaan yang sering ditanya</h2>
          <p className="mt-2 text-sm text-muted">Ada yang kurang jelas? Cek dulu di sini</p>
        </div>
        <div className="card mt-6 divide-y divide-line px-5">
          {FAQS.map((faq) => (
            <FaqItem key={faq.q} {...faq} />
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          Masih ada pertanyaan?{" "}
          <a href="https://t.me/diskusiduniotp" target="_blank" rel="noreferrer" className="font-semibold text-amber-bright hover:underline">
            Hubungi CS kami
          </a>
        </p>
      </section>

      {/* CTA Bottom */}
      <section className="mt-12">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal to-teal-bright px-6 py-10 text-center text-white shadow-lift">
          <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <p className="text-sm font-semibold text-white/70 uppercase tracking-wide">Mulai sekarang</p>
            <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">Gratis daftar, langsung pakai</h2>
            <p className="mt-2 text-sm text-white/80">Tidak perlu email atau nomor HP. Akun dibuat otomatis saat kamu masuk.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/dashboard" className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-teal-bright shadow-lift transition-transform active:scale-95">
                Masuk ke Dashboard
              </Link>
              <Link href="/otp" className="rounded-xl bg-white/15 px-6 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 transition-colors hover:bg-white/25">
                Lihat harga OTP
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
