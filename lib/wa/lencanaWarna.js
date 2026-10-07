// Palet lencana verifikasi. Berkas murni (tanpa database) supaya dipakai
// bersama oleh server (lib/wa/inti.js) dan tampilan (components/wa).
export const LENCANA = {
  biru: { label: "Biru", warna: "#1d9bf0" },
  hitam: { label: "Hitam", warna: "#171717" },
  oranye: { label: "Oranye", warna: "#f77c22" },
  pink: { label: "Pink", warna: "#ec4899" },
  hijau: { label: "Hijau", warna: "#16a34a" },
  ungu: { label: "Ungu", warna: "#8b5cf6" },
  merah: { label: "Merah", warna: "#ef4444" },
  emas: { label: "Emas", warna: "#eab308" },
  tosca: { label: "Tosca", warna: "#14b8a6" },
  perak: { label: "Perak", warna: "#94a3b8" }
};
export const lencanaSah = (k) => Object.prototype.hasOwnProperty.call(LENCANA, k);
