// Daftar server pembelian nokos. Aman di-import dari server maupun browser
// (tidak berisi secret). Urutan array = urutan tampil di pilihan server.
// Kedua server memakai alur yang sama: pilih aplikasi → pilih negara → order.
export const OTP_SERVERS = [
  {
    key: "rumahotp",
    name: "Server Nokos Murah",
    badge: "Murah",
    provider: "RumahOTP",
    desc: "Harga paling hemat. Semua aplikasi & negara, pilih server dengan rate sukses tertinggi."
  },
  {
    key: "simuru",
    name: "Server Nokos OTP Fast",
    badge: "Fast",
    provider: "Simuru",
    desc: "OTP masuk cepat. Semua aplikasi & negara, harga mengikuti stok terbaru."
  }
];

export const DEFAULT_SERVER = "rumahotp";

export function serverLabel(key) {
  return OTP_SERVERS.find((s) => s.key === key)?.name || key || "-";
}
