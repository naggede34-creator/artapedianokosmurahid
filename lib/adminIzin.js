// Izin admin per PERAN (murni, tanpa database — mudah diuji). Aturan: bawaan MENOLAK; hanya yang tertulis di sini yang boleh.
// Owner (kode admin utama) boleh semuanya. Daftar di bawah berlaku untuk API /api/admin/<jalur>.
// Entri: [awalanJalur, metode?] — metode kosong = semua metode. Awalan cocok bila jalurnya sama atau diawali "awalan/".
export const PERAN = {
  owner: "Owner (semua akses)",
  keuangan: "Keuangan — deposit, penarikan, saldo, laporan",
  cs: "CS / Dukungan — membaca pengguna, tiket, notifikasi",
  moderator: "Moderator — pengguna, blokir, keamanan, popup & siaran"
};

const IZIN = {
  keuangan: [
    ["deposits"], ["withdraw"], ["austinpay"], ["rute-deposit"], ["ekspor-csv"], ["pembukuan"], ["koreksi-saldo"],
    ["stats"], ["stock-report"], ["users", "GET"], ["users/balance"], ["pengguna/detail", "GET"],
    ["pusat", "GET"], ["audit", "GET"], ["leaderboard", "GET"], ["sesi"], ["logout"]
  ],
  cs: [
    ["support"], ["users", "GET"], ["pengguna", "GET"], ["pengguna/detail", "GET"], ["notify"], ["pusat", "GET"], ["stats", "GET"],
    ["sesi"], ["logout"]
  ],
  moderator: [
    ["pengguna"], ["users", "GET"], ["users/suspend"], ["ip-blokir"], ["keamanan"], ["security-scan"], 
    ["support"], ["siaran"], ["popup"], ["tampilan-ban"], ["announcements"], ["broadcasts"], ["pusat", "GET"], ["stats", "GET"], ["sesi"], ["logout"]
  ]
};

export const PERAN_DAFTAR = Object.keys(PERAN);

/** pathname penuh (mis. "/api/admin/users/balance") + metode → boleh? */
export function boleh(peran, pathname, metode = "GET") {
  if (peran === "owner") return true;
  const daftar = IZIN[peran];
  if (!daftar) return false;
  const m = String(pathname || "").match(/^\/api\/admin\/(.+?)\/?$/);
  if (!m) return false;
  const rel = m[1];
  const met = String(metode || "GET").toUpperCase();
  return daftar.some(([awalan, metode2]) => (rel === awalan || rel.startsWith(awalan + "/")) && (!metode2 || metode2 === met));
}
