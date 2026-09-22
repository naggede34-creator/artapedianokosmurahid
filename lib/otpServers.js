// Daftar server pembelian nokos. Aman di-import dari server maupun browser
// (tidak berisi secret). Urutan array = urutan tampil di pilihan server.
// Semua server memakai alur yang sama: pilih aplikasi → pilih negara → order.
export const OTP_SERVERS = [
  {
    key: "rumahotp",
    name: "Server Nokos Murah",
    badge: "Murah",
    provider: "RumahOTP",
    desc: "Harga paling hemat. Semua aplikasi & negara, pilih server dengan rate sukses tertinggi."
  },
  {
    key: "warungnokos_s1",
    name: "Server Plus",
    badge: "Utama",
    provider: "WarungNokos",
    desc: "Jalur utama WarungNokos. Stok melimpah dengan rate sukses tertinggi untuk layanan populer."
  },
  {
    key: "warungnokos_s2",
    name: "Server Express",
    badge: "Cepat",
    provider: "WarungNokos S2",
    desc: "Jalur Server2 WarungNokos. Dipakai saat stok server utama kosong atau butuh pilihan lain."
  },
  {
    key: "dibanana",
    name: "OTP Fast Murah",
    badge: "Fast",
    provider: "dibanana",
    desc: "OTP masuk cepat dengan harga hemat. Tersedia Indonesia, Malaysia, Singapura, AS & Inggris."
  }
];

export const DEFAULT_SERVER = "rumahotp";

export function serverLabel(key) {
  return OTP_SERVERS.find((s) => s.key === key)?.name || key || "-";
}
