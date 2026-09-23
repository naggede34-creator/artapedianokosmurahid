"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SimCard from "@/components/SimCard";
import HeroMascot from "@/components/HeroMascot";
import TransactionTicker from "@/components/TransactionTicker";
import LiveTicker from "@/components/LiveTicker";
import { Icon } from "@/components/ui";

const products = [
  { href: "/otp",     title: "Beli nokos",   desc: "OTP WhatsApp, Telegram, Google & ratusan aplikasi.", icon: Icon.phone,    tone: "bg-amber text-white",         emoji: "📱" },
  { href: "/deposit", title: "Isi saldo",    desc: "Bayar pakai QRIS dari e-wallet atau m-banking.",   icon: Icon.qris,     tone: "bg-success text-white",       emoji: "💳" },
  { href: "/riwayat", title: "Riwayat",      desc: "Pantau kode OTP dan status deposit.",     icon: Icon.history,  tone: "bg-surface3 text-ink",        emoji: "📋" },
];

const steps = [
  { num: "01", title: "Isi saldo lewat QRIS",  desc: "Mulai dari Rp2.000. Saldo masuk otomatis begitu pembayaran terdeteksi.", emoji: "💳", color: "bg-amber text-white" },
  { num: "02", title: "Pilih layanan",          desc: "Nomor OTP per negara & server. Harga tampil di depan.", emoji: "🎯", color: "bg-teal-bright text-white" },
  { num: "03", title: "Terima hasilnya",        desc: "Kode OTP langsung muncul di halaman pesanan.", emoji: "⚡", color: "bg-success text-white" },
];

const TESTIMONIALS = [
  { name: "Budi S.",  loc: "Jakarta",     text: "OTP WhatsApp langsung masuk dalam 30 detik. Sangat cepat dan harganya terjangkau!", rating: 5, avatar: "BS", color: "from-amber to-amber-bright" },
  { name: "Rizky A.", loc: "Surabaya",    text: "Udah langganan 3 bulan, belum pernah kecewa. CS responsif kalau ada masalah.",       rating: 5, avatar: "RA", color: "from-teal to-teal-bright" },
  { name: "Dewi P.",  loc: "Bandung",     text: "Beli followers Instagram disini hasilnya nyata dan bertahan lama. Recommended!",      rating: 5, avatar: "DP", color: "from-rose to-[#ff6b8a]" },
  { name: "Anto W.",  loc: "Medan",       text: "Deposit QRIS dari mana pun langsung masuk. Mudah dan aman banget.",                  rating: 5, avatar: "AW", color: "from-success to-[#22c55e]" },
  { name: "Siti N.",  loc: "Yogyakarta",  text: "Harga lebih murah dari tempat lain, tapi kualitasnya sama bagusnya. Puas!",           rating: 5, avatar: "SN", color: "from-amber to-amber-bright" },
  { name: "Fajar M.", loc: "Makassar",    text: "Fitur garansi bikin tenang. Pas nomor bermasalah langsung direfund. Top!",            rating: 5, avatar: "FM", color: "from-teal to-teal-bright" },
];

const TRUST_BADGES = [
  { icon: "⚡", label: "Proses Instan",  desc: "OTP masuk otomatis",         color: "bg-amber/10 border-amber/30 hover:bg-amber/20"     },
  { icon: "🔒", label: "100% Aman",      desc: "Transaksi terenkripsi",       color: "bg-teal-soft border-teal/30 hover:bg-teal/20"      },
  { icon: "🛡️", label: "Garansi Refund", desc: "Nomor bermasalah? Kami refund", color: "bg-rose-soft border-rose/30 hover:bg-rose-soft/60" },
  { icon: "🕐", label: "24/7 Aktif",     desc: "Layanan tidak pernah tutup",  color: "bg-success-soft border-success/30 hover:bg-success-soft/80" },
  { icon: "💳", label: "QRIS Resmi",     desc: "Semua e-wallet & m-banking",  color: "bg-amber/10 border-amber/30 hover:bg-amber/20"     },
  { icon: "🤝", label: "50.000+ User",   desc: "Dipercaya banyak pengguna",   color: "bg-teal-soft border-teal/30 hover:bg-teal/20"      },
];

const FAQS = [
  { q: "Apa itu nokos?",                    a: "Nokos (nomor sekali pakai) adalah nomor telepon virtual untuk menerima kode OTP dari WhatsApp, Telegram, Google, dll. Tanpa kartu SIM fisik." },
  { q: "Berapa lama OTP masuk?",            a: "Biasanya 5–60 detik. Sistem kami memantau nomor secara real-time dan kode langsung tampil di halaman pesanan." },
  { q: "Apakah aman menggunakan Artapedia?",a: "Ya, sangat aman. Tidak ada data pribadi yang diminta. Kamu hanya perlu kode akun unik — tanpa email, tanpa password, tanpa nomor HP." },
  { q: "Bagaimana cara isi saldo?",         a: "Buka halaman Deposit, masukkan nominal, pilih metode QRIS, scan QR dengan e-wallet atau m-banking. Saldo masuk otomatis begitu terdeteksi." },
  { q: "Berapa minimal deposit?",           a: "Minimal deposit hanya Rp2.000 — sangat terjangkau untuk yang ingin coba terlebih dahulu." },
  { q: "Bisa refund kalau nomor bermasalah?",a: "Bisa! Gunakan fitur Klaim Garansi di Dashboard. Admin proses dalam 1×24 jam dan saldo dikembalikan jika disetujui." },
];

/* ---- Particles floating in hero ---- */
const PARTICLES = [
  { e: "✨", x: "7%",   y: "18%", s: "text-2xl" },
  { e: "⭐", x: "91%",  y: "14%", s: "text-lg"  },
  { e: "💫", x: "4%",   y: "65%", s: "text-xl"  },
  { e: "⚡", x: "93%",  y: "58%", s: "text-2xl" },
  { e: "🌟", x: "13%",  y: "82%", s: "text-lg"  },
  { e: "💥", x: "84%",  y: "78%", s: "text-xl"  },
  { e: "✨", x: "52%",  y: "6%",  s: "text-sm"  },
  { e: "⭐", x: "38%",  y: "92%", s: "text-sm"  },
  { e: "🔥", x: "22%",  y: "45%", s: "text-base"},
  { e: "💎", x: "78%",  y: "40%", s: "text-base"},
];

function FloatingParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {PARTICLES.map((p, i) => (
        <span key={i} className={`absolute select-none ${p.s} float-particle`}
          style={{ left: p.x, top: p.y }}>
          {p.e}
        </span>
      ))}
    </div>
  );
}

/* ---- Animated stat counter ---- */
function useCountUp(target, duration = 1800) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (!target) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const prog = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - prog, 3);
      setVal(Math.floor(ease * target));
      if (prog < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);
  return val;
}

function StatCounter({ value, suffix = "", label, accent, big }) {
  const [started, setStarted] = useState(false);
  const elRef = useRef(null);
  useEffect(() => {
    if (typeof IntersectionObserver !== "function") { setStarted(true); return; }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true); }, { threshold: 0.3 });
    if (elRef.current) obs.observe(elRef.current);
    // Jaring pengaman: kalau pengamatnya tidak pernah terpicu — panelnya
    // sudah terlihat sejak awal, layarnya sangat tinggi, atau halamannya
    // dirender jadi gambar — angkanya tetap muncul, bukan diam di 0. Nol
    // besar di bawah tulisan "dipercaya ribuan pengguna" jauh lebih merugikan
    // daripada kehilangan animasi hitungnya.
    const jaring = setTimeout(() => setStarted(true), 1600);
    return () => { obs.disconnect(); clearTimeout(jaring); };
  }, []);
  const count = useCountUp(started ? value : 0);
  return (
    <div ref={elRef} className="flex flex-col items-center gap-2 text-center">
      <p className={`tabular-nums font-extrabold leading-none ${big ? "text-5xl sm:text-6xl" : "text-3xl sm:text-4xl"} ${accent || "text-white"} neon-text`}>
        {count.toLocaleString("id-ID")}{suffix}
      </p>
      <p className="text-sm text-white/60 font-semibold uppercase tracking-wider">{label}</p>
    </div>
  );
}

/* ---- Flash Sale Banner ---- */
function FlashSaleBanner() {
  const [timeLeft, setTimeLeft] = useState(null);
  useEffect(() => {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const tick = () => {
      const diff = end - Date.now();
      if (diff <= 0) { setTimeLeft(null); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);
  if (!timeLeft) return null;
  return (
    <div className="manga-panel relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose to-[#c0392b] px-5 py-4 text-white shine">
      <div className="action-burst absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-2xl beat">⚡</span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/70">⚡ Flash Sale Hari Ini</p>
            <p className="font-black text-base text-white">Deposit sekarang, saldo masuk lebih cepat!</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-white/20 px-3 py-2 text-center border border-white/30">
            <p className="font-mono text-xl font-extrabold">{timeLeft}</p>
            <p className="text-[10px] text-white/70">Berakhir dalam</p>
          </div>
          <Link href="/deposit" className="btn-glow rounded-xl bg-white px-5 py-2.5 text-sm font-black text-rose transition-all active:scale-95 border-2 border-ink">
            Deposit &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---- FAQ accordion ---- */
function FaqItem({ q, a, index }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-b-2 border-ink last:border-0 transition-colors ${open ? "bg-amber-soft/30" : ""}`}>
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-4 px-1 text-left font-bold text-ink hover:text-amber-bright transition-colors">
        <span className="flex items-center gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber text-white text-[11px] font-black border-2 border-ink">
            {index + 1}
          </span>
          <span className="text-sm">{q}</span>
        </span>
        <span className={`shrink-0 h-6 w-6 flex items-center justify-center rounded-full border-2 border-ink bg-surface text-ink font-black transition-transform ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      {open && (
        <div className="fade-up pb-5 px-1 pl-9">
          <div className="rounded-xl bg-surface2 border-2 border-ink p-3.5">
            <p className="text-sm leading-relaxed text-muted">{a}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Section header ---- */
function SectionHeader({ badge, title, sub }) {
  return (
    <div className="text-center">
      {badge && (
        <div className="sticker inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-amber-soft px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-amber-bright mb-4">
          {badge}
        </div>
      )}
      <h2 className="hd-title misprint text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h2>
      {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}
    </div>
  );
}

/* ========== PAGE ========== */
export default function HomePage() {
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
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
    fetch("/api/stats/public")
      .then((r) => r.json())
      .then((d) => setSiteStats(d))
      .catch(() => {});
    // Panel ini ditampilkan hanya kalau angkanya memang ada isinya. Halaman
    // depan yang berteriak "Dipercaya ribuan pengguna" tepat di atas deretan
    // "0+" merugikan lebih daripada tidak ada panelnya sama sekali.
  }, []);

  const statsSiap =
    siteStats &&
    [siteStats.users, siteStats.orders, siteStats.services, siteStats.countries].some(
      (n) => Number(n) > 0
    );

  return (
    <div className="mx-auto max-w-content px-4 pb-12 pt-4 sm:px-5 sm:pt-8">

      {/* Flash Sale */}
      <FlashSaleBanner />

      {/* ===== HERO ===== */}
      <section data-parallax-root
        className="hd-panel hd-paper ink-edge ink-edge-lg relative mt-6 overflow-hidden rounded-3xl border-3 border-ink bg-gradient-to-br from-surface via-surface to-amber-soft p-6 sm:p-10 lg:grid lg:grid-cols-[1fr_420px] lg:items-center lg:gap-12"
        style={{ border: "3px solid rgb(var(--c-ink))" }}>

        {/* Tiga lapisan hiasan dengan kedalaman berbeda. Angka data-parallax
            negatif = jauh (bergerak pelan & berlawanan), positif = dekat.
            Selisih kecepatan inilah yang dibaca mata sebagai ruang. */}
        <div data-parallax="-1.6" className="speed-lines pointer-events-none absolute -inset-8 opacity-60" />

        <div data-parallax="-0.7" className="pointer-events-none absolute inset-0">
          <FloatingParticles />
        </div>

        <span data-parallax="1.2"
          className="ono-text pointer-events-none absolute -right-4 top-4 select-none text-[88px] leading-none text-amber/[0.06] sm:text-[140px] rotate-12 font-extrabold" aria-hidden="true">
          POW!
        </span>

        <div className="relative order-2 lg:order-1 lg:pb-2">
          {/* live badge */}
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-teal-soft px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-teal-bright mb-5"
            style={{ boxShadow: "2px 2px 0 rgb(var(--c-ink))" }}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="pulse-live absolute inset-0 inline-flex rounded-full bg-teal-bright opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-bright" />
            </span>
            Aktif 24 jam · Proses Instan
          </div>

          {/* headline with glitch */}
          <h1 className="glitch-text misprint text-[34px] font-extrabold leading-[1.04] tracking-tight text-ink sm:text-[50px]"
            data-text="Nomor OTP murah, semua di sini.">
            Nomor OTP murah,
            <br />
            <span className="text-gradient-blue">semua di sini.</span>
          </h1>

          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
            Tanpa daftar, tanpa email. Kode akun dibuat otomatis — isi saldo dan semua layanan siap dipakai kapan saja.
          </p>

          {/* CTA buttons */}
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/otp" className="shine btn-glow inline-flex items-center gap-2 rounded-2xl border-[3px] border-ink bg-amber px-7 py-3.5 text-sm font-black uppercase tracking-wider text-white"
              style={{ boxShadow: "4px 4px 0 rgb(var(--c-ink))" }}>
              🚀 Beli Nomor OTP
            </Link>
            <Link href="/deposit" className="shine btn-glow inline-flex items-center gap-2 rounded-2xl border-[3px] border-ink bg-surface px-6 py-3.5 text-sm font-black uppercase tracking-wider text-ink"
              style={{ boxShadow: "4px 4px 0 rgb(var(--c-ink))" }}>
              💳 Isi Saldo
            </Link>
          </div>

          {/* mini badges */}
          <div className="mt-5 flex flex-wrap gap-2">
            {["⚡ OTP instan", "🔒 Tanpa data pribadi", "💰 Mulai Rp2.000", "🛡️ Garansi refund"].map((b) => (
              <span key={b} className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-surface px-3 py-1 text-xs font-bold text-ink"
                style={{ boxShadow: "2px 2px 0 rgb(var(--c-ink))" }}>
                {b}
              </span>
            ))}
          </div>
        </div>

        {/* lg:self-start — kolom ini sebelumnya ikut rata tengah, jadi kartu
            saldonya melayang di pertengahan tinggi panel dan maskot di sudut
            bawah tetap menabraknya. Ditarik ke atas, sudut bawahnya bebas. */}
        <div className="relative z-10 order-1 lg:order-2 lg:self-start">
          <div className="anime-simcard pointer-events-none absolute -right-4 -top-4 h-32 w-32 rounded-full bg-amber/10 blur-2xl" />
          <SimCard />
        </div>

        {/* Maskot ditaruh di sudut PANEL, bukan di dalam kolom kanan.
            Di dalam kolom dia akan berdiri tepat di bawah kartu saldo dan
            menimpanya, karena kolom itu tingginya hanya setinggi kartunya.
            Ruang kosong yang sebenarnya ada di sudut bawah panel, sisa dari
            kolom kiri yang lebih panjang. */}
        <HeroMascot />
      </section>

      {/* Live Purchase Ticker */}
      <section className="mt-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="pulse-live absolute inset-0 inline-flex rounded-full bg-teal-bright opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-bright beat" />
          </span>
          <p className="text-xs font-black uppercase tracking-widest text-muted">Pembelian terbaru</p>
        </div>
        <LiveTicker />
      </section>

      {/* ===== TRUST BADGES ===== */}
      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TRUST_BADGES.map((b, i) => (
          <div key={b.label}
            className={`card-wow shine group flex flex-col items-center gap-2.5 p-4 text-center cursor-default stagger-${i + 1} fade-up`}
            style={{ animationFillMode: "both" }}>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-soft border-2 border-ink text-2xl transition-transform group-hover:scale-110 group-hover:rubber-band"
              style={{ boxShadow: "2px 2px 0 rgb(var(--c-ink))" }}>
              {b.icon}
            </span>
            <div>
              <p className="text-xs font-black text-ink">{b.label}</p>
              <p className="text-[11px] text-muted mt-0.5">{b.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <TransactionTicker />

      {/* ===== STATS ===== */}
      {statsSiap && (
        <section className="hd-panel mt-10 relative overflow-hidden rounded-3xl"
          style={{ border: "3px solid rgb(var(--c-ink))" }}>
          <div className="action-burst absolute inset-0 opacity-40" />
          <div className="relative bg-gradient-to-br from-[#04091C] via-[#0a1830] to-[#0f2a70] px-6 py-10">
            <div className="text-center mb-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">📊 Angka Berbicara</p>
              <h2 className="mt-2 text-2xl font-extrabold text-white">Dipercaya Ribuan Pengguna</h2>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              <StatCounter value={siteStats.users}    suffix="+"      label="Pengguna Aktif"    accent="text-amber"      />
              <StatCounter value={siteStats.orders}   suffix="+"      label="OTP Berhasil"      accent="text-teal-bright"/>
              <StatCounter value={siteStats.services} suffix="+"      label="Layanan Tersedia"  accent="text-white"      />
              <StatCounter value={siteStats.countries}suffix=" negara" label="Pilihan Negara"   accent="text-amber"      />
            </div>
          </div>
        </section>
      )}

      {/* ===== PRODUCT CARDS ===== */}
      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {products.map((p) => {
          const I = p.icon;
          return (
            <Link key={p.href} href={p.href}
              className="card-wow card-tilt glare shine hd-gloss group flex flex-col gap-3 p-4 sm:p-5">
              <span className={`lift-3 flex h-12 w-12 items-center justify-center rounded-xl ${p.tone} border-2 border-ink text-2xl`}
                style={{ boxShadow: "2px 2px 0 rgb(var(--c-ink))" }}>
                {p.emoji}
              </span>
              <div className="lift-1">
                <p className="flex items-center gap-1 text-[15px] font-black text-ink">
                  {p.title}
                  <Icon.chevron className="text-muted transition-transform group-hover:translate-x-1" />
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{p.desc}</p>
              </div>
            </Link>
          );
        })}
      </section>

      {/* ===== SERVICES GRID ===== */}
      <section className="mt-12">
        <div className="flex items-end justify-between gap-3 mb-5">
          <div>
            <div className="sticker inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-amber-soft px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-bright mb-2">
              📱 OTP Populer
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-ink">Aplikasi paling dicari</h2>
            <p className="mt-1 text-sm text-muted">Ketuk untuk langsung pilih negara &amp; server.</p>
          </div>
          <Link href="/otp" className="shrink-0 rounded-xl border-2 border-ink bg-surface px-4 py-2 text-sm font-black text-amber-bright hover:bg-amber-soft transition-colors"
            style={{ boxShadow: "2px 2px 0 rgb(var(--c-ink))" }}>
            Semua →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
          {servicesLoading
            ? Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton h-[88px] rounded-2xl" />)
            : services.map((s, i) => (
                <Link key={s.service_code}
                  href={`/otp?q=${encodeURIComponent(s.service_name || "")}`}
                  className="card-wow shine hd-gloss group flex flex-col items-center gap-2 p-3 text-center">
                  {s.service_img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.service_img} alt="" className="h-9 w-9 rounded-lg object-contain transition-transform group-hover:scale-110" loading="lazy" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface2 border-2 border-ink text-sm font-black text-muted">
                      {(s.service_name || "?")[0]}
                    </span>
                  )}
                  <span className="line-clamp-1 text-xs font-bold text-ink">{s.service_name}</span>
                </Link>
              ))}
        </div>

        {/* Daftar layanan gagal dimuat atau memang kosong. Tanpa ini yang
            terlihat adalah judul menggantung di atas ruang kosong, yang
            tampak seperti halaman rusak. */}
        {!servicesLoading && services.length === 0 && (
          <div className="card-wow flex flex-col items-center gap-3 p-8 text-center">
            <span className="text-3xl">🛰️</span>
            <p className="text-sm font-black text-ink">Daftar layanan belum bisa dimuat</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted">
              Koneksi ke server nokos sedang tersendat. Daftar lengkapnya tetap bisa dibuka
              di halaman Beli Nokos.
            </p>
            <Link href="/otp"
              className="mt-1 rounded-xl border-2 border-ink bg-amber-soft px-4 py-2 text-sm font-black text-amber-bright"
              style={{ boxShadow: "2px 2px 0 rgb(var(--c-ink))" }}>
              Buka Beli Nokos →
            </Link>
          </div>
        )}
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="mt-14">
        <SectionHeader badge="⭐ Ulasan Nyata" title="Dipercaya ribuan pengguna" sub="Lihat apa kata mereka setelah pakai Artapedia" />
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <div key={t.name}
              className={`card-wow card-tilt glare manga-panel ink-edge gutter ${["panel-skew-a","panel-skew-b","panel-skew-c"][i % 3]} flex flex-col gap-3 p-5 stagger-${(i % 6) + 1} fade-up`}
              style={{ animationFillMode: "both" }}>
              {/* stars */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <svg key={j} width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                </div>
                <span className="sticker-right sticker inline-flex items-center gap-1 rounded-full border-2 border-ink bg-amber-soft px-2 py-0.5 text-[10px] font-black text-ink">
                  📍 {t.loc}
                </span>
              </div>
              {/* quote */}
              <div className="relative rounded-xl bg-surface2 border-2 border-ink p-3.5">
                <span className="absolute -top-2 left-3 text-2xl leading-none text-ink">"</span>
                <p className="text-sm leading-relaxed text-muted pt-1">{t.text}</p>
                <span className="absolute -bottom-3 right-3 text-2xl leading-none text-ink">"</span>
              </div>
              {/* avatar */}
              <div className="mt-1 flex items-center gap-2.5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${t.color} text-xs font-extrabold text-white border-2 border-ink`}
                  style={{ boxShadow: "2px 2px 0 rgb(var(--c-ink))" }}>
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-black text-ink">{t.name}</p>
                  <p className="text-[11px] text-muted">Pengguna Artapedia</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="mt-14">
        <SectionHeader badge="⚡ Cara Kerja" title="3 langkah selesai" sub="Semudah scan QR, se-instan itu juga." />
        <ol className="mt-7 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.num}
              className={`manga-panel hd-paper hd-gloss ink-edge relative rounded-[20px] bg-surface p-6 ${["panel-skew-b","panel-skew-c","panel-skew-a"][i % 3]} stagger-${i + 1} fade-up`}
              style={{ animationFillMode: "both", boxShadow: "5px 5px 0 rgb(var(--c-ink)), var(--hd-lift)" }}>
              {/* Angka besar sebagai latar. Dulu ditaruh di -right-2 -top-2 dan
                  terpotong di tepi kartu; sekarang ditahan di dalam panel. */}
              <span className="hd-step-num" aria-hidden="true">{s.num}</span>
              <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-ink text-2xl ${s.color} mb-4`}
                style={{ boxShadow: "3px 3px 0 rgb(var(--c-ink))" }}>
                {s.emoji}
              </span>
              <h3 className="text-[15px] font-black text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.desc}</p>
              {i < steps.length - 1 && (
                <span className="absolute -right-5 top-1/2 hidden -translate-y-1/2 text-2xl font-black text-ink sm:block" aria-hidden="true">→</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ===== FAQ ===== */}
      <section className="mt-14">
        <SectionHeader badge="❓ FAQ" title="Pertanyaan yang sering ditanya" sub="Ada yang kurang jelas? Cek dulu di sini" />
        <div className="manga-panel mt-6 rounded-2xl bg-surface px-5 py-2 overflow-hidden">
          {FAQS.map((faq, i) => (
            <FaqItem key={faq.q} {...faq} index={i} />
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          Masih ada pertanyaan?{" "}
        </p>
      </section>

      {/* ===== BOTTOM CTA ===== */}
      <section className="mt-14">
        <div className="relative overflow-hidden rounded-3xl text-white"
          style={{ border: "3px solid rgb(var(--c-ink))", boxShadow: "7px 7px 0 rgb(var(--c-ink))" }}>
          <div className="action-burst absolute inset-0 opacity-40" />
          <div className="scanlines absolute inset-0" />
          <div className="relative bg-gradient-to-br from-teal via-[#0a3080] to-teal-bright px-6 py-12 text-center">
            <FloatingParticles />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-white/30 bg-white/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest mb-5">
                🎮 Mulai Sekarang
              </span>
              <h2 className="text-3xl font-extrabold sm:text-4xl">
                <span className="text-gradient-rainbow">Gratis daftar, langsung pakai</span>
              </h2>
              <p className="mt-3 text-sm text-white/75 max-w-md mx-auto">
                Tidak perlu email atau nomor HP. Akun dibuat otomatis saat kamu masuk.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link href="/dashboard"
                  className="shine rounded-2xl border-[3px] border-white bg-white px-7 py-3.5 text-sm font-black text-teal-bright transition-all active:scale-95"
                  style={{ boxShadow: "4px 4px 0 rgba(0,0,0,0.3)" }}>
                  🚀 Masuk ke Dashboard
                </Link>
                <Link href="/otp"
                  className="shine rounded-2xl border-[3px] border-white/40 bg-white/10 px-7 py-3.5 text-sm font-black text-white ring-1 ring-inset ring-white/30 transition-all hover:bg-white/20"
                  style={{ boxShadow: "4px 4px 0 rgba(0,0,0,0.2)" }}>
                  💸 Lihat Harga OTP
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
