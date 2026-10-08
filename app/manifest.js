// Manifest PWA — supaya situs ini bisa dipasang sebagai aplikasi di layar
// utama, lengkap dengan ikon dan tanpa bilah alamat peramban.
//
// Dibuat lewat app/manifest.js, bukan berkas statis: namanya ikut SITE_NAME
// kalau suatu saat diganti, dan Next.js yang mengurus header tipe isinya.
import { ambilBrandReq } from "@/lib/brandServer";
import { urlLogo } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function manifest() {
  const brand = await ambilBrandReq();
  const nama = brand.namaLengkap;
  return {
    name: `${nama} — Nokos & OTP Murah`,
    short_name: brand.nama,
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
    icons: brand.reseller
      ? [{ src: "/api/rw-ikon", sizes: "any", type: "image/svg+xml", purpose: "any" }]
      : brand.logo.ikon
      ? brand.logo.ikon.tipe === "image/svg+xml"
        ? [{ src: urlLogo(brand, "ikon", "", "ikon"), sizes: "any", type: "image/svg+xml", purpose: "any" }]
        : [
            { src: urlLogo(brand, "ikon", "", "ikon-192"), sizes: "192x192", type: brand.logo.ikon.tipe, purpose: "any" },
            { src: urlLogo(brand, "ikon", "", "ikon-512"), sizes: "512x512", type: brand.logo.ikon.tipe, purpose: "any" },
            { src: urlLogo(brand, "ikon", "", "ikon-maskable"), sizes: "512x512", type: brand.logo.ikon.tipe, purpose: "maskable" }
          ]
      : [
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
