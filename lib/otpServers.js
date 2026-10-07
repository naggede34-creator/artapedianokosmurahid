// Daftar server pembelian nokos. Aman di-import dari server maupun browser
// (tidak berisi secret). Urutan array = urutan tampil di pilihan server.
// Semua server memakai alur yang sama: pilih aplikasi → pilih negara → order.
// Daftar LENGKAP (termasuk yang disembunyikan dari tampilan). Yang bertanda `tampil: false` tidak pernah ditampilkan
// maupun bisa dipakai untuk pesanan baru; kodenya tetap ada hanya agar pesanan lama di server itu masih bisa dicek/refund.
const SEMUA_SERVER = [
  {
    key: "rumahotp",
    name: "Server Nokos Murah",
    badge: "Murah",
    provider: "RumahOTP",
    tampil: false,
    desc: "Harga paling hemat. Semua aplikasi & negara, pilih server dengan rate sukses tertinggi."
  },
  {
    key: "warungnokos_s1",
    name: "Server Plus",
    badge: "Utama",
    provider: "WarungNokos",
    desc: "WarungNokos Server 1. Jalur utama dengan stok melimpah untuk layanan populer."
  },
  {
    key: "warungnokos_s2",
    name: "Server Express",
    badge: "Cepat",
    provider: "WarungNokos S2",
    desc: "WarungNokos Server 2. Dipakai saat stok server utama kosong atau butuh pilihan harga lain."
  },
  {
    key: "dibanana",
    name: "OTP Fast Murah",
    badge: "Fast",
    provider: "dibanana",
    tampil: false,
    desc: "OTP masuk cepat dengan harga hemat. Tersedia Indonesia, Malaysia, Singapura, AS & Inggris."
  }
];

/** Server yang ditampilkan & bisa dipesan: hanya WarungNokos (Server Plus & Server Express). */
export const OTP_SERVERS = SEMUA_SERVER.filter((s) => s.tampil !== false);
export const serverTampil = (key) => OTP_SERVERS.some((s) => s.key === key);

export const DEFAULT_SERVER = "warungnokos_s1";

export function serverLabel(key) {
  return SEMUA_SERVER.find((s) => s.key === key)?.name || key || "-";
}
