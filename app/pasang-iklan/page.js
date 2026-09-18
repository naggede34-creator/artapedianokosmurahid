"use client";

import { useState } from "react";
import Link from "next/link";

const PACKAGES = [
  {
    id: "starter",
    name: "Starter",
    emoji: "🌱",
    price: 50000,
    duration: 7,
    placement: "homepage",
    placementLabel: "Homepage",
    description: "Tampil di halaman utama selama 7 hari",
    features: ["Banner di Homepage", "Ukuran 728×90 px", "Link klik-through aktif", "Laporan tayangan dasar"],
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    emoji: "🚀",
    price: 120000,
    duration: 14,
    placement: "order",
    placementLabel: "Halaman Order",
    description: "Tampil di halaman order — audiens paling aktif",
    features: ["Banner di Halaman Order", "Ukuran 728×90 px", "Link klik-through aktif", "Laporan tayangan detail", "Prioritas penempatan"],
    highlight: true,
  },
  {
    id: "premium",
    name: "Premium",
    emoji: "👑",
    price: 200000,
    duration: 30,
    placement: "dashboard",
    placementLabel: "Dashboard User",
    description: "Tampil di dashboard — terlihat setiap login",
    features: ["Banner di Dashboard User", "Ukuran 728×90 px", "Link klik-through aktif", "Laporan tayangan penuh", "Prioritas pertama", "Dukungan desain banner"],
    highlight: false,
  },
];

const TNC_ITEMS = [
  {
    title: "1. Konten yang Diperbolehkan",
    body: "Iklan harus berkaitan dengan produk atau layanan digital yang sah. Konten promosi bisnis umum, aplikasi, kursus online, dan layanan SaaS diperbolehkan.",
  },
  {
    title: "2. Konten yang Dilarang",
    body: "Dilarang keras: konten dewasa / pornografi, perjudian, penipuan, produk ilegal, SARA, hoaks, MLM / money game, dan konten yang melanggar hak cipta pihak ketiga.",
  },
  {
    title: "3. Format & Spesifikasi Banner",
    body: "Gambar banner berformat JPG/PNG/WebP, ukuran 728×90 px (leaderboard) atau 300×250 px (medium rectangle). Ukuran file maksimal 500 KB. Teks dalam gambar harus terbaca jelas.",
  },
  {
    title: "4. Proses Review",
    body: "Setiap iklan melalui proses review oleh tim kami (1–2 hari kerja). Kami berhak menolak iklan yang tidak sesuai syarat tanpa perlu memberikan alasan rinci. Uang muka tidak dikembalikan untuk iklan yang ditolak karena pelanggaran konten.",
  },
  {
    title: "5. Pembayaran",
    body: "Pembayaran dilakukan melalui saldo akun atau transfer manual. Iklan aktif setelah pembayaran dikonfirmasi. Tidak ada refund untuk iklan yang sudah tayang.",
  },
  {
    title: "6. Penempatan & Rotasi",
    body: "Posisi banner ditentukan oleh paket yang dipilih dan ketersediaan slot. Kami tidak menjamin posisi tertentu dalam halaman kecuali disebutkan secara eksplisit dalam paket.",
  },
  {
    title: "7. Masa Tayang",
    body: "Iklan tayang sesuai durasi paket terhitung sejak diaktifkan admin. Masa tayang tidak diperpanjang otomatis. Habis masa tayang, iklan dinonaktifkan.",
  },
  {
    title: "8. Perubahan & Penangguhan",
    body: "Kami berhak menangguhkan atau menghapus iklan kapan saja jika ditemukan pelanggaran syarat, tanpa pemberitahuan sebelumnya. Klien dapat meminta perubahan konten 1 kali selama masa tayang.",
  },
  {
    title: "9. Tanggung Jawab",
    body: "Pengiklan bertanggung jawab penuh atas akurasi dan keabsahan konten iklan. Kami tidak bertanggung jawab atas klaim pihak ketiga yang timbul dari konten iklan.",
  },
  {
    title: "10. Hubungi Kami",
    body: "Ada pertanyaan? Buat tiket support dari dashboard akun kamu, atau hubungi admin melalui Telegram.",
  },
];

function TncItem({ title, body }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line last:border-0">
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-3.5 text-left">
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="shrink-0 text-muted text-lg">{open ? "▲" : "▼"}</span>
      </button>
      {open && <p className="pb-4 text-sm text-muted leading-relaxed">{body}</p>}
    </div>
  );
}

export default function PasangIklanPage() {
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: "", contact: "", imageUrl: "", linkUrl: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState({ text: "", ok: false });
  const [agreed, setAgreed] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selected || !agreed) return;
    setSubmitting(true);
    setMsg({ text: "", ok: false });
    try {
      const pkg = PACKAGES.find((p) => p.id === selected);
      const r = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "ANON",
          subject: `[IKLAN] ${pkg.name} — ${form.name}`,
          message:
            `Paket: ${pkg.name} (${pkg.placementLabel}, ${pkg.duration} hari, Rp${pkg.price.toLocaleString("id-ID")})\n` +
            `Nama/Brand: ${form.name}\n` +
            `Kontak: ${form.contact}\n` +
            `URL Gambar Banner: ${form.imageUrl || "-"}\n` +
            `Link Tujuan: ${form.linkUrl || "-"}\n` +
            `Catatan: ${form.notes || "-"}`,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setMsg({ text: "Pesanan iklan berhasil dikirim! Admin akan menghubungi kamu dalam 1–2 hari kerja.", ok: true });
        setForm({ name: "", contact: "", imageUrl: "", linkUrl: "", notes: "" });
        setSelected(null);
        setAgreed(false);
      } else {
        setMsg({ text: d.error || "Gagal mengirim. Coba lagi.", ok: false });
      }
    } catch {
      setMsg({ text: "Terjadi kesalahan. Coba lagi.", ok: false });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-content px-4 py-8 sm:px-5 sm:py-12">
      {/* Hero */}
      <div className="mb-10 text-center">
        <span className="inline-block rounded-full bg-amber-soft border border-amber/30 px-4 py-1 text-xs font-bold text-amber-bright mb-4">
          📢 Iklan & Promosi
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-ink mb-3">
          Pasang Iklan di <span className="text-rose">Artapedia</span>
        </h1>
        <p className="text-muted text-base max-w-xl mx-auto leading-relaxed">
          Jangkau ribuan pengguna aktif yang membeli nomor OTP dan layanan digital setiap hari. Promosi produk kamu tepat sasaran.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {[
          { label: "Pengguna Aktif", value: "50.000+" },
          { label: "Order / Hari", value: "5.000+" },
          { label: "Uptime", value: "99.9%" },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-2xl font-extrabold text-rose">{s.value}</p>
            <p className="text-xs text-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Packages */}
      <h2 className="text-xl font-extrabold text-ink mb-5">Pilih Paket Iklan</h2>
      <div className="grid gap-5 sm:grid-cols-3 mb-10">
        {PACKAGES.map((pkg) => (
          <button key={pkg.id} type="button" onClick={() => setSelected(pkg.id)}
            className={`card p-5 text-left transition-all ${
              selected === pkg.id
                ? "border-2 border-rose shadow-lg scale-[1.02]"
                : "hover:border-rose/30 hover:shadow-md"
            } ${pkg.highlight ? "ring-2 ring-amber/50" : ""}`}>
            {pkg.highlight && (
              <span className="inline-block bg-amber text-white text-[10px] font-black px-2 py-0.5 rounded-full mb-3">
                ⭐ PALING POPULER
              </span>
            )}
            <div className="text-3xl mb-2">{pkg.emoji}</div>
            <h3 className="font-extrabold text-ink text-lg">{pkg.name}</h3>
            <p className="text-2xl font-extrabold text-rose mt-1">
              Rp{pkg.price.toLocaleString("id-ID")}
              <span className="text-sm text-muted font-normal"> / {pkg.duration} hari</span>
            </p>
            <p className="text-xs text-muted mt-2 mb-4 leading-relaxed">{pkg.description}</p>
            <ul className="space-y-1.5">
              {pkg.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-ink">
                  <span className="text-teal-bright">✓</span> {f}
                </li>
              ))}
            </ul>
            {selected === pkg.id && (
              <div className="mt-4 rounded-xl bg-rose text-white text-xs font-bold text-center py-2">
                ✓ Dipilih
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Order Form */}
      {selected && (
        <div className="card p-6 mb-10">
          <h2 className="text-xl font-extrabold text-ink mb-1">Form Pemesanan Iklan</h2>
          <p className="text-sm text-muted mb-5">
            Paket: <strong className="text-ink">{PACKAGES.find((p) => p.id === selected)?.name}</strong> ·{" "}
            <strong className="text-rose">Rp{PACKAGES.find((p) => p.id === selected)?.price.toLocaleString("id-ID")}</strong>
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">Nama / Brand <span className="text-rose">*</span></label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nama brand atau produk kamu" required maxLength={200}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-rose" />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">Kontak <span className="text-rose">*</span></label>
                <input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                  placeholder="Email atau Telegram @username" required maxLength={200}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-rose" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">URL Gambar Banner <span className="text-muted font-normal">(opsional, bisa dikirim nanti)</span></label>
              <input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://... (JPG/PNG/WebP, 728×90px, maks 500KB)" maxLength={500}
                className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-rose" />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">Link Tujuan (URL klik banner)</label>
              <input value={form.linkUrl} onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
                placeholder="https://..." maxLength={500}
                className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-rose" />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">Catatan tambahan</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Jadwal tayang, preferensi, pertanyaan, dll." rows={3} maxLength={1000}
                className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-rose resize-none" />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-rose shrink-0" />
              <span className="text-xs text-muted leading-relaxed">
                Saya telah membaca dan menyetujui{" "}
                <button type="button" onClick={() => document.getElementById("tnc-section")?.scrollIntoView({ behavior: "smooth" })}
                  className="text-rose font-semibold hover:underline">
                  Syarat & Ketentuan
                </button>{" "}
                pemasangan iklan di Artapedia.
              </span>
            </label>

            {msg.text && (
              <div className={`rounded-xl border p-3.5 text-xs font-semibold flex items-start gap-2 ${
                msg.ok ? "bg-teal-soft border-teal/30 text-teal-bright" : "bg-rose-soft border-rose/30 text-rose"
              }`}>
                <span>{msg.ok ? "✅" : "❌"}</span>
                <span>{msg.text}</span>
              </div>
            )}

            <button type="submit" disabled={submitting || !agreed}
              className="w-full rounded-2xl bg-rose py-3.5 text-sm font-extrabold text-white transition-all active:scale-95 disabled:opacity-50"
              style={{ boxShadow: "0 6px 0 0 rgba(180,0,0,0.3)" }}>
              {submitting ? "⏳ Mengirim pesanan..." : "📢 Kirim Pesanan Iklan"}
            </button>
          </form>
        </div>
      )}

      {/* Syarat & Ketentuan */}
      <div id="tnc-section" className="card p-6">
        <h2 className="text-xl font-extrabold text-ink mb-1">📋 Syarat & Ketentuan Iklan</h2>
        <p className="text-sm text-muted mb-5">Harap baca sebelum memesan. Dengan memasang iklan, kamu dianggap telah menyetujui seluruh ketentuan ini.</p>
        <div>
          {TNC_ITEMS.map((item) => (
            <TncItem key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8 text-center">
        <p className="text-sm text-muted mb-3">Masih ada pertanyaan? Hubungi kami langsung.</p>
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 rounded-2xl bg-surface2 border border-line px-6 py-3 text-sm font-bold text-ink hover:border-rose/40 transition-all">
          🎫 Buat Tiket Support dari Dashboard
        </Link>
      </div>
    </div>
  );
}
