"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onOpenersFree } from "@/lib/introGate";

// Sudah menekan "Selesai" (permanen) vs cuma "Tutup" (muncul lagi kunjungan berikutnya).
const READ_KEY = "artapedia_info_read";
const DISMISS_KEY = "artapedia_info_dismissed";

const TABS = [
  { id: "refund", label: "Refund" },
  { id: "ketentuan", label: "Ketentuan" },
  { id: "tutorial", label: "Tutorial" }
];

const TUTORIAL = [
  {
    title: "Isi Saldo (Deposit)",
    body: "Masuk ke menu Deposit, pilih nominal, lalu bayar QRIS-nya. Saldo masuk otomatis dalam hitungan detik."
  },
  {
    title: "Beli Nomor",
    body: "Buka menu Nokos, pilih server, cari aplikasinya (contoh: WhatsApp), pilih negara, lalu klik Order."
  },
  {
    title: "Tunggu SMS OTP",
    body: "Masukkan nomor yang didapat ke aplikasi yang dituju. Kode OTP akan muncul sendiri di halaman pesanan."
  },
  {
    title: "Pantau Room Chat Grup",
    body: "Info stok, gangguan server, dan promo selalu diumumkan lebih dulu di Room Chat Grup. Biasakan mengeceknya sebelum membeli."
  }
];

const KETENTUAN = [
  "Penggunaan untuk aktivitas ilegal, penipuan, spam, atau tindakan yang merugikan pihak lain sangat dilarang.",
  "Setiap akun bersifat personal dan tidak boleh dipindahtangankan atau dipakai bersama.",
  "Simpan kode akun kamu baik-baik — kode itu satu-satunya kunci untuk membuka saldo dan riwayatmu.",
  "Nomor virtual bisa gagal menerima OTP karena kebijakan aplikasi tujuan; risiko ini ditanggung pembeli.",
  "Pelanggaran terhadap larangan di atas mengakibatkan pemblokiran akun permanen tanpa pengembalian saldo."
];

const REFUND_AUTO = [
  "Pesanan belum pernah menerima SMS ataupun kode verifikasi sebelumnya.",
  "Nomor kedaluwarsa tanpa kode OTP yang masuk.",
  "Saldo dikembalikan 100% sesuai nominal pembelian tanpa potongan sedikit pun."
];

const REFUND_MANUAL = [
  "Mengalami bug sistem atau error karena maintenance di luar kendali user.",
  "Deposit yang tidak masuk otomatis bisa di-refund dengan menghubungi Admin/CS."
];

export default function InfoModal() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("tutorial");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(READ_KEY) === "1") return;
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // Storage diblokir (mode privat) — tetap tampilkan, tidak apa-apa.
    }
    // Menunggu animasi loading DAN sapaan maskot ditutup, supaya popup tidak
    // menumpuk di layar yang sama.
    let t;
    const off = onOpenersFree(() => {
      t = setTimeout(() => setOpen(true), 500);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, []);

  function close() {
    // "Tutup" hanya menunda sampai kunjungan berikutnya.
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setOpen(false);
  }

  function finish() {
    try {
      localStorage.setItem(READ_KEY, "1");
    } catch {}
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <div className="animate-fade-in absolute inset-0" style={{ background: "rgb(var(--c-navy-bright) / 0.6)" }} />

      <div className="animate-sheet-up relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-lift sm:rounded-3xl">
        <div className="shrink-0 border-b border-line px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-soft text-base text-amber-bright">ℹ️</span>
              <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">Tutorial dan Informasi</h2>
            </div>
            <span className="shrink-0 rounded-full bg-rose-soft px-2.5 py-1 text-[10px] font-bold text-rose">Penting!</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Pahami segala informasi yang kami berikan serta perhatikan syarat dan ketentuan yang berlaku di website ini,
            termasuk risiko yang kamu tanggung saat membeli nomor virtual.
          </p>
        </div>

        <div className="shrink-0 grid grid-cols-3 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-3 py-3 text-sm font-semibold transition-colors ${
                tab === t.id ? "text-amber-bright" : "text-muted hover:text-ink"
              }`}
            >
              {t.label}
              {tab === t.id && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-amber" />}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === "tutorial" && (
            <ol className="space-y-0 divide-y divide-line rounded-2xl border border-line bg-surface2/40">
              {TUTORIAL.map((step, i) => (
                <li key={step.title} className="flex gap-3 p-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-soft text-[11px] font-bold text-amber-bright">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-ink">{step.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{step.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}

          {tab === "ketentuan" && (
            <ul className="space-y-0 divide-y divide-line rounded-2xl border border-line bg-surface2/40">
              {KETENTUAN.map((item) => (
                <li key={item} className="flex gap-2.5 p-3.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose" />
                  <span className="text-xs leading-relaxed text-muted">{item}</span>
                </li>
              ))}
            </ul>
          )}

          {tab === "refund" && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-line">
                <div className="flex items-center gap-2 border-b border-line bg-surface2/60 px-3.5 py-2.5">
                  <span className="text-sm">🛡️</span>
                  <span className="text-sm font-bold text-ink">Refund Otomatis</span>
                </div>
                <ul className="divide-y divide-line">
                  {REFUND_AUTO.map((item) => (
                    <li key={item} className="flex gap-2.5 p-3.5">
                      <span className="shrink-0 text-xs text-success">✓</span>
                      <span className="text-xs leading-relaxed text-muted">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="overflow-hidden rounded-2xl border border-line">
                <div className="flex items-center gap-2 border-b border-line bg-surface2/60 px-3.5 py-2.5">
                  <span className="text-sm">💬</span>
                  <span className="text-sm font-bold text-ink">Refund Manual / Admin</span>
                </div>
                <ul className="divide-y divide-line">
                  {REFUND_MANUAL.map((item) => (
                    <li key={item} className="flex gap-2.5 p-3.5">
                      <span className="shrink-0 text-xs text-teal-bright">✓</span>
                      <span className="text-xs leading-relaxed text-muted">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <Link
            href="/chat"
            onClick={close}
            className="btn-3d mt-4 flex items-center gap-3 rounded-2xl border border-teal/40 bg-teal-soft px-4 py-3 transition-colors hover:border-teal"
          >
            <span className="text-lg">💬</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">Baca Room Chat Grup</span>
              <span className="block text-[11px] leading-relaxed text-muted">
                Info stok, gangguan, dan promo diumumkan di sini lebih dulu. Cek sebelum beli.
              </span>
            </span>
            <span className="shrink-0 text-muted">›</span>
          </Link>
        </div>

        <div className="shrink-0 border-t border-line px-5 pb-5 pt-4">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-line accent-amber"
            />
            <span className="text-sm font-medium text-ink">Saya telah membaca semuanya</span>
          </label>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <button onClick={close} className="btn-3d rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink">
              Tutup
            </button>
            <button
              onClick={finish}
              disabled={!agreed}
              className="btn-3d rounded-xl bg-amber px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-bright disabled:cursor-not-allowed disabled:opacity-40"
            >
              Selesai
            </button>
          </div>
        </div>

        <div className="h-[env(safe-area-inset-bottom)] shrink-0" />
      </div>
    </div>
  );
}
