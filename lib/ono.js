"use client";

// Onomatope komik: huruf besar yang muncul sesaat lalu hilang saat sesuatu
// terjadi — KLIK saat tombol ditekan, BOOM saat nomor keluar, DING saat kode
// OTP masuk, CHING saat saldo bertambah.
//
// Dipasang sebagai fungsi biasa, bukan komponen React, dengan alasan yang
// jelas: pemanggilnya tersebar di mana-mana (handler tombol, callback fetch,
// efek setelah data tiba), dan memaksa semuanya lewat context/provider akan
// menyeret perubahan ke puluhan berkas hanya untuk satu efek hiasan.
//
// Elemennya menempel langsung ke <body>, bukan ke tombol yang menekan, supaya
// tidak pernah terpotong oleh overflow: hidden induknya — dan itu sering,
// karena hampir semua kartu di situs ini memotong isinya.

const VARIAN = {
  klik:  { teks: "KLIK!",  warna: "var(--ono-blue)",   putar: -8 },
  boom:  { teks: "BOOM!",  warna: "var(--ono-orange)", putar: -6 },
  ding:  { teks: "DING!",  warna: "var(--ono-green)",  putar: 7 },
  ching: { teks: "CHING!", warna: "var(--ono-gold)",   putar: -5 },
  pow:   { teks: "POW!",   warna: "var(--ono-orange)", putar: 9 },
  oops:  { teks: "OOPS!",  warna: "var(--ono-red)",    putar: -7 }
};

// Terlalu banyak sekaligus berubah jadi berisik, bukan meriah.
const MAKS_BERSAMAAN = 3;
let aktif = 0;

function bolehTampil() {
  if (typeof document === "undefined") return false;
  if (aktif >= MAKS_BERSAMAAN) return false;
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  } catch {}
  return true;
}

/**
 * @param {keyof VARIAN|string} jenis  nama varian, atau teks bebas
 * @param {{x?:number, y?:number, el?:Element}} posisi
 *        el  : muncul di tengah elemen itu
 *        x,y : koordinat layar; dipakai kalau el tidak diberikan
 */
export function ono(jenis = "klik", posisi = {}) {
  if (!bolehTampil()) return;

  const v = VARIAN[jenis] || { teks: String(jenis).toUpperCase(), warna: "var(--ono-orange)", putar: -6 };

  let x = posisi.x;
  let y = posisi.y;
  if (posisi.el?.getBoundingClientRect) {
    const r = posisi.el.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  }
  // Tanpa titik acuan, muncul di tengah layar bagian atas — tempat mata
  // memang sedang berada setelah menekan sesuatu.
  if (typeof x !== "number") x = window.innerWidth / 2;
  if (typeof y !== "number") y = window.innerHeight * 0.32;

  const el = document.createElement("span");
  el.className = "ono-burst";
  el.textContent = v.teks;
  el.setAttribute("aria-hidden", "true");
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.setProperty("--ono-c", v.warna);
  el.style.setProperty("--ono-rot", `${v.putar + (Math.random() * 6 - 3)}deg`);

  document.body.appendChild(el);
  aktif++;

  // Dibersihkan lewat animationend DAN batas waktu. Kalau animasinya tidak
  // pernah selesai (tab disembunyikan di tengah jalan), elemennya harus tetap
  // hilang — kalau tidak, satu sesi panjang meninggalkan ratusan span mati.
  let selesai = false;
  const bersihkan = () => {
    if (selesai) return;
    selesai = true;
    aktif = Math.max(0, aktif - 1);
    el.remove();
  };
  el.addEventListener("animationend", bersihkan, { once: true });
  setTimeout(bersihkan, 1400);
}

// Pintasan yang sering dipakai, supaya pemanggilnya terbaca sebagai kejadian
// dan bukan sebagai pilihan gaya.
export const onoKlik = (el) => ono("klik", { el });
export const onoOrderSukses = (el) => ono("boom", { el });
export const onoOtpMasuk = (el) => ono("ding", { el });
export const onoSaldoMasuk = (el) => ono("ching", { el });
export const onoGagal = (el) => ono("oops", { el });
