// Daftar server pembelian nokos. Aman di-import dari server maupun browser
// (tidak berisi secret). Urutan array = urutan tampil di pilihan server.
export const OTP_SERVERS = [
  {
    key: "rumahotp",
    name: "Server Nokos Murah",
    badge: "Murah",
    provider: "RumahOTP",
    desc: "Harga paling hemat. Semua aplikasi & negara, pilih server dengan rate sukses tertinggi.",
    steps: 3
  },
  {
    key: "virtusim",
    name: "Server Nokos OTP Fast",
    badge: "Fast",
    provider: "VirtuSIM",
    desc: "Nomor Indonesia, OTP masuk cepat. WhatsApp ada di paling atas.",
    steps: 2
  }
];

export const DEFAULT_SERVER = "rumahotp";
