// Autentikasi admin: satu kode rahasia, ditukar jadi SESI BERTANDA TANGAN.
//
// Yang salah sebelumnya, dan kenapa ini penting:
// cookienya berisi teks tetap "granted". httpOnly hanya menghalangi JavaScript
// di halaman membacanya — ia sama sekali tidak menghalangi siapa pun MEMASANG
// cookie itu sendiri. Satu perintah
//     curl -H "Cookie: artapedia_admin=granted" .../api/admin/withdraw
// sudah cukup untuk masuk sebagai admin, tanpa pernah tahu kode adminnya. Dan
// di balik pintu itu ada penarikan saldo: uang sungguhan, keluar.
//
// Sekarang isinya "<kedaluwarsa>.<tanda tangan>". Tanda tangannya HMAC-SHA256
// memakai rahasia yang cuma ada di server, jadi cookie buatan sendiri tidak
// akan lolos — pemalsunya harus menebak rahasianya, bukan menebak satu kata.
import crypto from "crypto";

export const ADMIN_COOKIE = "artapedia_admin";

// Umur sesi. Tertulis DI DALAM cookienya, bukan cuma di maxAge peramban:
// maxAge ditentukan peramban dan bisa diabaikan, yang di dalam tanda tangan
// tidak bisa diubah tanpa merusak tanda tangannya.
const UMUR_MS = 7 * 24 * 60 * 60 * 1000;

export function getAdminCode() {
  return process.env.ADMIN_CODE || "arta12123";
}

// Kode bawaan ada di repositori, jadi ia bukan rahasia siapa pun. Dipakai untuk
// memperingatkan di log, bukan untuk menolak masuk — mengunci pemiliknya keluar
// dari panelnya sendiri karena satu variabel belum diisi lebih merugikan.
export function adminCodeIsDefault() {
  return !process.env.ADMIN_CODE;
}

function rahasia() {
  // ADMIN_SECRET kalau ada; kalau tidak, diturunkan dari kode admin + CRON_SECRET
  // supaya tanda tangannya tetap unik per pemasangan tanpa variabel baru yang
  // wajib diisi. Mengganti ADMIN_CODE otomatis membatalkan semua sesi lama —
  // itu memang yang diinginkan saat kodenya diganti.
  const dasar = process.env.ADMIN_SECRET || `${getAdminCode()}:${process.env.CRON_SECRET || "artapedia"}`;
  return crypto.createHash("sha256").update(dasar).digest();
}

function tandaTangan(payload) {
  return crypto.createHmac("sha256", rahasia()).update(payload).digest("base64url");
}

export function createAdminSession() {
  const kedaluwarsa = String(Date.now() + UMUR_MS);
  return `${kedaluwarsa}.${tandaTangan(kedaluwarsa)}`;
}

export function verifyAdminSession(value) {
  if (typeof value !== "string" || !value.includes(".")) return false;
  const [kedaluwarsa, sig] = value.split(".");
  if (!kedaluwarsa || !sig) return false;

  const benar = tandaTangan(kedaluwarsa);
  // Perbandingan waktu-tetap. Perbandingan biasa berhenti di huruf pertama yang
  // berbeda, dan selisih waktunya — sekecil apa pun — bisa dipakai menebak
  // tanda tangannya satu huruf demi satu huruf.
  const a = Buffer.from(sig);
  const b = Buffer.from(benar);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  const batas = Number(kedaluwarsa);
  return Number.isFinite(batas) && Date.now() < batas;
}

// Perbandingan kode admin, juga waktu-tetap.
export function adminCodeMatches(code) {
  const benar = getAdminCode();
  const a = Buffer.from(String(code ?? ""));
  const b = Buffer.from(benar);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Dipakai di route handler (app/api/admin/**): return true/false.
export function isAdminRequest(req) {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Dipakai di server component lewat cookies() dari next/headers.
export function isAdminCookieStore(store) {
  return verifyAdminSession(store.get(ADMIN_COOKIE)?.value);
}

// Pengaturan cookie yang sama untuk login & logout, supaya tidak ada yang
// terlewat di salah satunya.
export function adminCookieOptions(maxAge = UMUR_MS / 1000) {
  return {
    httpOnly: true,
    sameSite: "lax",
    // secure hanya di produksi: di localhost (http) cookie secure tidak pernah
    // terkirim, dan panelnya jadi tidak bisa dipakai saat pengembangan.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  };
}
