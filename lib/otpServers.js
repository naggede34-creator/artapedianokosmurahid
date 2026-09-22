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
    key: "ruangotp_s1",
    name: "Server Plus",
    badge: "Utama",
    provider: "RuangOTP S1",
    desc: "Jalur utama RuangOTP. 190+ negara dengan stok paling melimpah untuk layanan populer."
  },
  {
    key: "ruangotp_s2",
    name: "Server Express",
    badge: "Global",
    provider: "RuangOTP S2",
    desc: "Jalur global RuangOTP. Dipakai saat stok di server utama kosong atau butuh negara langka."
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
