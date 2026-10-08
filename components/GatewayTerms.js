"use client";

import { createPortal } from "react-dom";
import { useBrand } from "@/app/providers";

import { useEffect, useState } from "react";
import { INVOICE_MIN, INVOICE_MAX, BIAYA_QRIS, WD_MIN, BIAYA_WD } from "@/lib/gatewayConfig";

const KUNCI = "artapedia_gw_setuju";
const rp = (n) => `Rp${Number(n).toLocaleString("id-ID")}`;

// Syarat & ketentuan QRIS Gateway.
//
// Muncul sekali per akun sebelum fiturnya bisa dipakai, dan persetujuannya
// disimpan di peranti. Ini bukan formalitas: di bawah ada tiga hal yang kalau
// tidak dibaca lebih dulu akan berakhir sebagai komplain yang tidak bisa
// diperbaiki siapa pun — uang ke nomor yang salah, akun dibekukan karena
// dipakai menipu, dan saldo yang ditahan saat ada sengketa.
const PASAL = [
  {
    ikon: "🧾",
    judul: "Uang yang masuk itu tanggung jawab kamu",
    isi: [
      "Tagihan yang kamu buat adalah perjanjian antara kamu dan pembelimu. {{nama}} hanya menyediakan salurannya.",
      "Kalau pembelimu komplain, minta refund, atau melapor, yang menyelesaikannya kamu — bukan kami."
    ]
  },
  {
    ikon: "🚫",
    judul: "Yang membuat akun dibekukan permanen",
    isi: [
      "Menerima pembayaran untuk penipuan, judi online, barang ilegal, atau apa pun yang merugikan orang lain.",
      "Meminjamkan atau menjual akun gateway dan API key ke orang lain.",
      "Kalau ada laporan polisi atau aduan korban, saldo ditahan sampai perkaranya jelas, dan data transaksinya kami serahkan kalau diminta secara resmi."
    ]
  },
  {
    ikon: "🏦",
    judul: "Penarikan otomatis",
    isi: [
      `Minimal ${rp(WD_MIN)} (yang diterima di e-wallet), biaya ${rp(BIAYA_WD)} per penarikan — biayanya ditambahkan di atas nominal dan ikut dipotong dari saldo gateway.`,
      "Dikirim otomatis lewat AustinPay, biasanya selesai dalam hitungan menit. Bila layanan sedang gangguan, permintaan masuk antrean dan diproses admin.",
      "Ada batas jumlah penarikan per hari, dan satu nomor e-wallet tidak bisa dipakai banyak akun. Penarikan yang mencurigakan bisa ditahan untuk diperiksa.",
      "NOMOR E-WALLET YANG SALAH TIDAK BISA DITARIK KEMBALI. Periksa dua kali sebelum mengirim; kami tidak bisa membatalkan uang yang sudah sampai ke orang lain.",
      "Penarikan yang gagal atau ditolak mengembalikan saldomu penuh, termasuk biayanya."
    ]
  },
  {
    ikon: "💰",
    judul: "Biaya & batas",
    isi: [
      `Tagihan ${rp(INVOICE_MIN)} sampai ${rp(INVOICE_MAX)}.`,
      `Biaya ${rp(BIAYA_QRIS)} per tagihan, dipotong HANYA kalau tagihannya dibayar. Yang tidak dibayar tidak dikenai apa pun.`,
      "Konversi ke saldo {{nama}} tanpa biaya.",
      "Biaya dan batas bisa berubah; perubahannya diumumkan di channel lebih dulu."
    ]
  },
  {
    ikon: "🔑",
    judul: "API key itu kunci uangmu",
    isi: [
      "Siapa pun yang memegang API key-mu bisa membuat tagihan atas namamu dan melihat saldomu.",
      "Jangan pernah menaruhnya di kode yang berjalan di peramban, di aplikasi Android, atau di repositori publik.",
      "Kalau bocor, ganti sendiri dari dasbor — kunci lama langsung mati."
    ]
  }
];

export default function GatewayTerms({ token, onSetuju }) {
  const brand = useBrand();
  const [tampil, setTampil] = useState(false);
  const [centang, setCentang] = useState(false);

  useEffect(() => {
    if (!token) return;
    try {
      // Disimpan per kode akun, bukan satu tanda global: satu peranti bisa
      // dipakai bergantian oleh beberapa akun, dan persetujuan orang lain
      // bukan persetujuan orang ini.
      if (localStorage.getItem(`${KUNCI}:${token}`) === "1") { onSetuju?.(); return; }
    } catch {
      // Storage diblokir — tampilkan saja, lebih baik ditanya dua kali
      // daripada fitur uang dipakai tanpa pernah membaca syaratnya.
    }
    setTampil(true);
  }, [token, onSetuju]);

  function setuju() {
    try { localStorage.setItem(`${KUNCI}:${token}`, "1"); } catch {}
    setTampil(false);
    onSetuju?.();
  }

  if (!tampil || typeof document === "undefined") return null;

  // Lewat portal ke <body>: nenek-moyang halaman ini memakai transform/perspective (animasi masuk, panel 3D), dan itu
  // menjadikan position:fixed relatif terhadapnya — lembar terkunci di dasar halaman panjang, di luar layar, dan
  // tombol Setuju/Tutup tak terjangkau.
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0" style={{ background: "rgb(var(--c-navy-bright) / 0.72)" }} />

      {/* Tinggi dibatasi di sini (bukan lewat .lembar-bawah, yang membuat lembarnya sendiri menggulir dan mendorong tombol
          Setuju / Nanti saja keluar dari layar). Header & tombol tetap terlihat; hanya daftar pasalnya yang bergulir. */}
      <div role="dialog" aria-modal="true" aria-label="Syarat dan Ketentuan QRIS Gateway" className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border-2 border-ink bg-surface pb-[env(safe-area-inset-bottom)] sm:max-h-[88dvh] sm:rounded-3xl">
        <div className="relative shrink-0 border-b-2 border-line px-5 pt-5 pb-3">
          <a
            href="/dashboard"
            aria-label="Tutup"
            data-testid="gw-syarat-tutup"
            className="press absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border-2 border-line bg-surface text-base font-black text-ink"
          >
            ✕
          </a>
          <div className="flex items-center gap-2 pr-10">
            <span className="rounded-full border-2 border-ink bg-success px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
              Wajib dibaca
            </span>
          </div>
          <h2 className="font-display mt-2 text-xl font-black tracking-tight text-ink">
            Syarat &amp; Ketentuan QRIS Gateway
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Fitur ini memindahkan uang sungguhan, milikmu dan milik pembelimu. Baca dulu — yang di bawah ini
            yang paling sering jadi masalah, dan sebagian besar tidak bisa diperbaiki setelah terjadi.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ol className="space-y-4">
            {PASAL.map((p, i) => (
              <li key={p.judul} className="rounded-2xl border-2 border-line bg-surface2 p-3.5">
                <p className="flex items-center gap-2 text-sm font-black text-ink">
                  <span className="text-base">{p.ikon}</span>
                  <span>{i + 1}. {p.judul}</span>
                </p>
                <ul className="mt-2 space-y-1.5">
                  {p.isi.map((baris) => (
                    <li key={baris} className="flex gap-2 text-[12px] leading-relaxed text-muted">
                      <span className="shrink-0 text-amber-bright">•</span>
                      <span>{baris.replaceAll("{{nama}}", brand.nama)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>

        <div className="shrink-0 border-t-2 border-line bg-surface px-5 pb-5 pt-4">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={centang}
              onChange={(e) => setCentang(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-amber"
            />
            <span className="text-[13px] font-semibold leading-snug text-ink">
              Saya sudah membaca dan setuju. Saya paham uang yang terkirim ke nomor yang salah tidak bisa
              ditarik kembali.
            </span>
          </label>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <a href="/dashboard" className="btn-3d rounded-xl border-2 border-line bg-surface px-4 py-2.5 text-center text-sm font-bold text-ink">
              Nanti saja
            </a>
            <button
              onClick={setuju}
              disabled={!centang}
              className="btn-3d rounded-xl bg-amber px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-amber-bright disabled:cursor-not-allowed disabled:opacity-40"
            >
              Setuju &amp; Lanjut
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
