// Daftar server pembelian nokos — hanya WarungNokos (Server 1 & Server 2).
// Aman di-import dari server maupun browser (tidak berisi secret). Urutan array = urutan tampil.
// Alur sama untuk semua server: pilih aplikasi → pilih negara → order.
export const OTP_SERVERS = [
  {
    key: "warungnokos_s1",
    name: "Server 1",
    badge: "Utama",
    provider: "WarungNokos",
    desc: "WarungNokos Server 1. Jalur utama dengan stok melimpah untuk layanan populer."
  },
  {
    key: "warungnokos_s2",
    name: "Server 2",
    badge: "Cadangan",
    provider: "WarungNokos",
    desc: "WarungNokos Server 2. Pilihan harga lain, atau saat stok Server 1 kosong."
  }
];

export const DEFAULT_SERVER = "warungnokos_s1";

export function serverLabel(key) {
  return OTP_SERVERS.find((s) => s.key === key)?.name || key || "-";
}
