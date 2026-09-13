"use client";

import { useMemo, useState } from "react";

const ORDER_STEPS = [
  {
    title: "Langkah 1 — Pilih Server & Layanan",
    body:
      "Buka menu Order OTP di dashboard, lalu pilih Server (Server 1 / Server 2 / dst). Jika Server 1 sedang gangguan atau stok kosong, silakan coba Server 2. Selanjutnya pilih Negara tujuan (contoh: Indonesia) dan Layanan aplikasi yang dibutuhkan (contoh: WhatsApp, Telegram, dll)."
  },
  {
    title: "Langkah 2 — Proses Pembelian",
    body:
      "Cek harga layanan yang tertera dan pastikan saldo Anda mencukupi. Klik tombol \"Beli\" atau \"Order\". Saldo Anda akan otomatis dipotong dan sistem akan mencarikan nomor untuk Anda seketika."
  },
  {
    title: "Langkah 3 — Penggunaan Nomor",
    body:
      "Nomor telepon akan muncul di layar. Salin nomor tersebut dan masukkan ke aplikasi yang ingin Anda daftarkan. Tekan minta kode/kirim SMS di aplikasi tersebut, lalu tunggu beberapa saat di halaman pesanan."
  },
  {
    title: "Langkah 4 — Kode OTP Masuk",
    body:
      "Kode OTP akan tampil otomatis di halaman pesanan begitu diterima, tidak perlu refresh manual. Jika nomor bermasalah dan kode tidak kunjung masuk, gunakan tombol Batalkan & Refund selama pesanan belum menerima kode."
  }
];

const FAQ_ITEMS = [
  {
    q: "Berapa lama saldo deposit masuk?",
    a: "Deposit via QRIS biasanya terverifikasi otomatis dalam hitungan detik. Jika lebih dari beberapa menit belum masuk, hubungi CS dengan menyertakan bukti pembayaran."
  },
  {
    q: "Nomor OTP tidak menerima kode, bagaimana?",
    a: "Selama pesanan belum menerima kode, Anda bisa membatalkan pesanan dan saldo akan direfund otomatis ke akun Anda."
  },
  {
    q: "Apakah kode akun saya bisa hilang?",
    a: "Kode akun adalah satu-satunya kunci ke saldo dan riwayat Anda. Simpan baik-baik — jika hilang, saldo tidak dapat dipulihkan tanpa kode tersebut."
  },
  {
    q: "Kenapa Server 1 sering gangguan?",
    a: "Server mengikuti ketersediaan stok nomor dari provider pihak ketiga. Jika satu server penuh atau gangguan, silakan coba server lain yang tersedia."
  },
  {
    q: "Apakah saldo bisa ditransfer ke akun lain?",
    a: "Bisa, melalui menu Transfer Saldo dengan memasukkan kode akun tujuan dan nominal yang ingin dikirim."
  }
];

const REFUND_POLICY = [
  "Refund otomatis diberikan jika nomor OTP belum menerima kode dan pesanan dibatalkan sebelum batas waktu habis.",
  "Deposit yang sudah berhasil dikonfirmasi sistem tidak dapat dibatalkan atau ditarik kembali.",
  "Untuk kendala teknis di luar kendali sistem (gangguan provider), tim support akan meninjau kasus secara manual."
];

const TOPICS = [
  { key: "semua", label: "Semua Topik" },
  { key: "order", label: "Cara Order OTP" },
  { key: "refund", label: "Kebijakan Refund" },
  { key: "faq", label: "Pertanyaan Umum" }
];

export default function FaqPage() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("semua");
  const [openFaq, setOpenFaq] = useState(null);

  const filteredFaq = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ_ITEMS;
    return FAQ_ITEMS.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [query]);

  const showOrder = topic === "semua" || topic === "order";
  const showRefund = topic === "semua" || topic === "refund";
  const showFaq = topic === "semua" || topic === "faq";

  return (
    <div className="mx-auto max-w-content px-5 py-8">
      <p className="fade-up text-sm font-semibold uppercase tracking-wide text-amber-bright">📖 Pusat Kebijakan</p>
      <h1 className="fade-up delay-1 mt-2 font-display text-display-sm font-semibold text-ink sm:text-display-md">
        Bantuan (FAQ)
      </h1>
      <p className="fade-up delay-2 mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Informasi lengkap mengenai cara penggunaan layanan, pengembalian dana, serta syarat dan ketentuan yang berlaku.
      </p>

      <div className="fade-up delay-3 mt-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari topik atau informasi..."
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-soft outline-none focus:border-amber sm:max-w-md"
        />
      </div>

      <div className="fade-up delay-4 mt-4 flex flex-wrap gap-2">
        {TOPICS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTopic(t.key)}
            className={`press rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              topic === t.key ? "border-amber bg-amber-soft text-amber-bright" : "border-line text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {showOrder && (
        <section id="server-1" className="mt-8">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber to-amber-bright text-white">
              🛒
            </span>
            <h2 className="font-display text-base font-semibold text-ink">Cara Order OTP (Server 1 &amp; 2)</h2>
          </div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-line">
            {ORDER_STEPS.map((s, i) => (
              <div key={s.title} className={`p-5 ${i > 0 ? "border-t border-line" : ""} bg-surface`}>
                <p className="text-sm font-semibold text-ink">{s.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {showRefund && (
        <section id="server-2" className="mt-8">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-soft text-teal-bright">↩️</span>
            <h2 className="font-display text-base font-semibold text-ink">Kebijakan Refund</h2>
          </div>
          <div className="mt-3 rounded-2xl border border-line bg-surface p-5">
            <ul className="space-y-3 text-sm leading-relaxed text-ink/90">
              {REFUND_POLICY.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 text-amber-bright">●</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {showFaq && (
        <section className="mt-8">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-soft text-success">❓</span>
            <h2 className="font-display text-base font-semibold text-ink">Pertanyaan Umum</h2>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {filteredFaq.length === 0 ? (
              <p className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted">
                Tidak ada topik yang cocok dengan pencarian.
              </p>
            ) : (
              filteredFaq.map((f, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="press flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-sm font-medium text-ink"
                  >
                    {f.q}
                    <span className={`shrink-0 text-muted transition-transform ${openFaq === i ? "rotate-45" : ""}`}>+</span>
                  </button>
                  {openFaq === i && (
                    <p className="expand-down border-t border-line px-5 py-4 text-sm leading-relaxed text-muted">{f.a}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
