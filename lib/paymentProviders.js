// Daftar metode deposit. File ini aman di-import dari server maupun browser
// (tidak berisi secret). Urutan array = urutan tampil di halaman deposit.
export const DEPOSIT_PROVIDERS = [
  {
    key: "warungnokos",
    name: "QRIS WarungNokos",
    short: "WarungNokos",
    speed: "± 30 detik",
    desc: "Semua e-wallet & m-banking."
  },
  {
    key: "pakasir",
    name: "QRIS Pakasir",
    short: "Pakasir",
    speed: "± 1 menit",
    desc: "Semua e-wallet & m-banking."
  },
  {
    key: "rumahotp",
    name: "QRIS RumahOTP",
    short: "RumahOTP",
    speed: "± 20 detik",
    desc: "Semua e-wallet & m-banking."
  },
  {
    key: "atlantic",
    name: "QRIS Atlantic",
    short: "Atlantic",
    speed: "± 30 detik",
    desc: "Semua e-wallet & m-banking."
  },
  {
    // Satu-satunya metode yang tidak otomatis: QRIS milik admin sendiri,
    // dibayar manual lalu dicek admin. Saldonya masuk setelah admin menyetujui.
    key: "manual",
    name: "QRIS Manual (Cek Admin)",
    short: "Manual",
    speed: "± 5–15 menit",
    desc: "Scan QRIS admin, lalu kirim bukti transfer."
  }
];

export const PROVIDER_KEYS = DEPOSIT_PROVIDERS.map((p) => p.key);

// Metode yang saldonya TIDAK masuk otomatis — admin yang menyetujui satu per
// satu. Dipisahkan sebagai konstanta supaya tidak ada yang menuliskan
// "manual" sebagai teks di banyak tempat lalu salah ketik di salah satunya.
export const MANUAL_DEPOSIT_KEY = "manual";

export function providerName(key) {
  return DEPOSIT_PROVIDERS.find((p) => p.key === key)?.name || key || "-";
}

export const DEPOSIT_STATUS_LABEL = {
  pending: "Menunggu bayar",
  // Khusus deposit manual: user sudah menekan "Saya sudah bayar", giliran admin.
  review: "Menunggu dicek admin",
  completed: "Berhasil",
  canceled: "Dibatalkan",
  expired: "Kedaluwarsa",
  failed: "Gagal"
};
