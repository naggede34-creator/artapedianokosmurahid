// Bagian web reseller yang aman dipakai komponen klien (tanpa database).
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,22})[a-z0-9]$/;
export const RESERVED = new Set([
  "www", "api", "admin", "app", "web", "mail", "ftp", "static", "cdn", "assets", "dashboard", "login", "daftar", "bot",
  "gateway", "pay", "payment", "status", "support", "help", "cs", "blog", "docs", "dev", "test", "staging", "demo", "r",
  "artapedia", "arta", "pedia", "official", "resmi", "owner", "root", "system", "reseller", "kaget", "chat"
]);
/** Penarikan komisi web: minimal yang ditarik (e-wallet menerima nominal dikurangi biaya Rp1.000). */
export const WD_MIN_WEB = 11_000;
export const BIAYA_WD_WEB = 1_000;

export const bersihNama = (v) => String(v ?? "").replace(/[<>&"'`]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);

/** Awal hari WIB (00.00) dari sebuah waktu, sebagai Date UTC. */
export function awalWib(d) {
  const w = new Date(d.getTime() + 7 * 3600_000);
  return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()) - 7 * 3600_000);
}

/** Tanggal WIB (YYYY-MM-DD) dari sebuah waktu. */
export const tglWib = (d) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
