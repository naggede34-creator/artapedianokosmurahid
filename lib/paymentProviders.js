// Daftar metode deposit QRIS. File ini aman di-import dari server maupun browser
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
  }
];

export const PROVIDER_KEYS = DEPOSIT_PROVIDERS.map((p) => p.key);

export function providerName(key) {
  return DEPOSIT_PROVIDERS.find((p) => p.key === key)?.name || key || "-";
}

export const DEPOSIT_STATUS_LABEL = {
  pending: "Menunggu bayar",
  completed: "Berhasil",
  canceled: "Dibatalkan",
  expired: "Kedaluwarsa",
  failed: "Gagal"
};
