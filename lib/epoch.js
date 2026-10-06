// Normalisasi waktu dari provider pembayaran/nokos menjadi epoch ms.
// Provider kadang mengembalikan waktu (created_at/expired_at) sebagai string jam WIB
// TANPA info zona waktu, mis. "2025-11-09 22:57:51". Kalau string itu di-parse
// langsung pakai `new Date(...)`, hasilnya tergantung zona waktu runtime yang
// mem-parsing (browser HP user vs server) — kalau beda-beda, deposit yang baru
// saja dibuat bisa langsung keitung "kedaluwarsa" padahal belum lewat waktunya.
// Fungsi ini menormalkan SEMUA bentuk waktu dari provider (angka epoch ms,
// angka epoch ms dalam bentuk string, ATAU string jam WIB) jadi epoch ms yang
// pasti benar, supaya kode lain (dan frontend) tinggal pakai `new Date(ms)`
// tanpa perlu menebak zona waktu lagi.
export function toEpochMs(value) {
  if (value === null || value === undefined || value === "") return null;

  const str = String(value).trim();

  // Sudah berupa epoch ms (angka atau angka dalam bentuk string, mis. "1775022582129")
  if (/^\d{12,}$/.test(str)) {
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
  }

  // Kalau string-nya SUDAH ada info zona waktu eksplisit (diakhiri "Z", atau ada
  // offset "+07:00"/"-0500" dst — umum dipakai provider lain kayak Pakasir yang
  // pakai format ISO 8601 lengkap), JANGAN dipaksa dianggap WIB — percaya parsing
  // standarnya karena zona waktunya sudah jelas tertulis di string itu sendiri.
  const hasExplicitTz = /Z$|[+-]\d{2}:?\d{2}$/.test(str);
  if (hasExplicitTz) {
    const n = new Date(str).getTime();
    return Number.isFinite(n) ? n : null;
  }

  // Format "YYYY-MM-DD HH:mm:ss" ala WIB (UTC+7) tanpa info zona waktu sama sekali
  // (pola sebagian provider). Dianggap eksplisit sebagai WIB (bukan diserahkan ke
  // `new Date()` yang parsingnya tergantung zona waktu runtime) supaya hasilnya
  // konsisten di server maupun di HP user manapun.
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    const [, y, mo, d, h, mi, s] = m.map(Number);
    return Date.UTC(y, mo - 1, d, h, mi, s) - 7 * 60 * 60 * 1000;
  }

  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : null;
}
