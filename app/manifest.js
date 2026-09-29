// Manifest PWA — supaya situs ini bisa dipasang sebagai aplikasi di layar
// utama, lengkap dengan ikon dan tanpa bilah alamat peramban.
//
// Dibuat lewat app/manifest.js, bukan berkas statis: namanya ikut SITE_NAME
// kalau suatu saat diganti, dan Next.js yang mengurus header tipe isinya.
export const dynamic = "force-static";

export default function manifest() {
  const nama = process.env.NEXT_PUBLIC_SITE_NAME || "Arta Pedia ID";
  return {
    name: `${nama} — Nokos & OTP Murah`,
    short_name: nama,
    description:
      "Beli nomor virtual untuk OTP: WhatsApp, Telegram, dan ratusan aplikasi lain. Deposit QRIS otomatis, refund otomatis kalau kode tidak masuk.",
    start_url: "/dashboard",
    // standalone: dibuka tanpa bilah alamat, seperti aplikasi biasa.
    display: "standalone",
    orientation: "portrait",
    // Warna latar dipakai saat layar pembuka muncul, SEBELUM CSS-nya termuat.
    // Diambil dari --c-bg mode terang supaya tidak berkedip dari putih.
    background_color: "#f4f7fd",
    theme_color: "#0b162c",
    lang: "id",
    categories: ["shopping", "utilities"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // maskable terpisah dengan bantalan lebih besar: Android memotong ikon
      // jadi bulat, dan ikon "any" yang dipakai untuk itu akan terpotong.
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ],
    shortcuts: [
      { name: "Beli Nokos", short_name: "Beli", url: "/otp" },
      { name: "Isi Saldo", short_name: "Deposit", url: "/deposit" },
      { name: "Riwayat", short_name: "Riwayat", url: "/riwayat" }
    ]
  };
}
