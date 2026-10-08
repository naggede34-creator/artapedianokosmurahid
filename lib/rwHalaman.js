// Web reseller hanya menyediakan: beli nokos, deposit, riwayat transaksi, dan mutasi saldo
// (+ beranda ringkas /dashboard, profil/kode akun, dan syarat). Tampilannya tetap sama dengan web utama.
// Berkas ini tanpa impor apa pun: dipakai komponen klien untuk menyaring menu dan menjaga halaman.
export const HALAMAN_RW = ["/dashboard", "/otp", "/deposit", "/riwayat", "/mutasi", "/profil", "/syarat"];

/** Apakah path ini boleh dibuka di web reseller? (path sendiri atau anaknya, mis. /deposit/xyz) */
export function bolehRw(path) {
  const p = String(path || "").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  // "/" (halaman promosi web utama) di web reseller langsung ke berandanya sendiri.
  if (p === "/") return false;
  return HALAMAN_RW.some((h) => h !== "/" && (p === h || p.startsWith(`${h}/`)));
}

/**
 * Saring daftar menu bila `rw` menyala. Tautan eksternal (https://…, mis. saluran/bot Telegram web utama) dibuang,
 * kecuali `bolehEksternal` (dipakai tombol Kontak ke customer service).
 */
export function saringRw(items, rw, kunci = "href", bolehEksternal = false) {
  if (!rw) return items;
  return items.filter((x) => (/^https?:\/\//.test(String(x[kunci] || "")) ? bolehEksternal : bolehRw(x[kunci])));
}
