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
    key: "otpmania_s2",
    name: "Server Plus",
    badge: "Utama",
    provider: "OTPMANIA",
    desc: "Jalur utama OTPMANIA. Harga kompetitif dengan stok paling melimpah untuk layanan populer."
  },
  {
    key: "otpmania_s1",
    name: "Server Express",
    badge: "Cadangan",
    provider: "OTPMANIA",
    desc: "Jalur cadangan OTPMANIA. Dipakai saat stok di server utama sedang kosong."
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
