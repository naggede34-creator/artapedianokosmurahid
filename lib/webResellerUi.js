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

/** Syarat & ketentuan membuat web reseller (ditampilkan di /web-reseller; wajib disetujui sebelum membuat). */
export const SYARAT_RW = [
  { judul: "Satu akun, satu web", isi: ["Setiap akun hanya boleh membuat satu web reseller. Nama web (alamat) tidak bisa diganti setelah dibuat; nama brand dan markup boleh diubah kapan saja."] },
  { judul: "Fitur & harga", isi: ["Web reseller menyediakan beli nokos, deposit saldo, riwayat transaksi, dan mutasi saldo. Harga dasar mengikuti harga web utama dan bisa berubah sewaktu-waktu; harga jual di webmu = harga dasar + markup yang kamu atur."] },
  { judul: "Komisi", isi: [
    "Komisimu adalah selisih markup. Komisi baru cair ke saldomu saat kode OTP pembeli masuk.",
    "Bila pesanan dibatalkan atau direfund (OTP tidak masuk, dibatalkan, garansi), komisinya ikut dibatalkan. Komisi yang sudah cair dan kemudian harus ditarik kembali karena refund dapat membuat saldomu minus."
  ] },
  { judul: "Penarikan komisi", isi: [
    "Penarikan ke e-wallet diproses otomatis lewat AustinPay. Minimal tarik Rp11.000; biaya admin Rp1.000 dipotong dari nominal yang ditarik (tarik Rp11.000, e-wallet menerima Rp10.000).",
    "Pastikan nomor dan nama e-wallet benar — dana yang terkirim ke nomor yang salah tidak bisa ditarik kembali. Proses bisa tertunda bila penyedia pembayaran sedang gangguan; saldo dikembalikan penuh bila penarikan gagal."
  ] },
  { judul: "Nama brand & larangan", isi: [
    "Dilarang memakai nama brand yang menyamar sebagai pihak lain (termasuk pihak resmi), menyesatkan, mengandung SARA, atau melanggar hak merek dan hukum.",
    "Dilarang menipu pembeli, spam, membuat akun ganda untuk membeli di webmu sendiri demi komisi, atau menyalahgunakan refund."
  ] },
  { judul: "Pembeli & tanggung jawab", isi: ["Pembeli di webmu adalah pengguna platform: saldo, pesanan, refund, dan garansi diproses sistem. Kamu tidak memiliki akses ke saldo atau data pribadi pembeli. Pertanyaan pembeli soal pesanan diarahkan ke Customer Service."] },
  { judul: "Sanksi & perubahan", isi: ["Admin berhak membekukan web, membatalkan komisi, dan menahan penarikan bila ada pelanggaran atau indikasi kecurangan. Layanan disediakan apa adanya tanpa jaminan pendapatan; syarat ini dapat diperbarui sewaktu-waktu."] }
];
