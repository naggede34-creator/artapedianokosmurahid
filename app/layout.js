import { Plus_Jakarta_Sans, JetBrains_Mono, Bangers } from "next/font/google";
import "./globals.css";
import "./gaya.css";
import { SKRIP_GAYA_AWAL, SKRIP_RW_AWAL } from "@/lib/gaya";
import { UserProvider, ThemeProvider } from "./providers";
import SiteChrome from "@/components/SiteChrome";
import InkFilters from "@/components/InkFilters";
import { ambilBrandReq } from "@/lib/brandServer";
import { rwDariNext } from "@/lib/rwKonteks";
import { urlLogo } from "@/lib/brand";

// Dijalankan sebelum React hydrate supaya tidak ada kedipan warna saat mode gelap.
const themeInitScript = `
(function () {
  try {
    var saved = localStorage.getItem("artapedia_theme");
    if (saved === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap"
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["500", "600"], display: "swap" });
const bangers = Bangers({ subsets: ["latin"], variable: "--font-display", weight: ["400"], display: "swap" });

// Nama merek bisa diubah admin: halaman statis disegarkan tiap 60 detik agar judul tab ikut berubah.
export const revalidate = 60;

export async function generateMetadata() {
  const brand = await ambilBrandReq();
  return {
    title: `${brand.namaLengkap} — ${brand.slogan}`,
    description:
      "Beli nomor OTP (nokos) untuk WhatsApp, Telegram, Google dan ratusan layanan lain, dan isi saldo otomatis via QRIS. Diproses 24 jam.",
    // manifest wajib ditunjuk di sini, kalau tidak peramban tidak pernah
    // menawarkan "Pasang aplikasi" walau berkasnya ada.
    manifest: "/manifest.webmanifest",
    applicationName: brand.namaLengkap,
    // iOS tidak membaca manifest untuk hal-hal ini; ia punya metanya sendiri.
    // Tanpa appleWebApp, situs yang ditambahkan ke layar utama di iPhone tetap
    // membuka bilah alamat Safari dan tidak terasa seperti aplikasi.
    appleWebApp: {
      capable: true,
      title: brand.nama,
      statusBarStyle: "black-translucent"
    },
    icons: brand.reseller ? { icon: [{ url: "/api/rw-ikon", type: "image/svg+xml" }], apple: [{ url: "/api/rw-ikon" }] } : {
      icon: brand.logo.ikon ? [{ url: urlLogo(brand, "ikon", "", "ikon") }] : [{ url: "/logo-mark.svg", type: "image/svg+xml" }, { url: "/logo-mark.png", sizes: "512x512" }],
      apple: [{ url: urlLogo(brand, "ikon", "/icon-192.png", "ikon-192"), sizes: "192x192" }, { url: urlLogo(brand, "ikon", "/icon-512.png", "ikon-512"), sizes: "512x512" }]
    },
    openGraph: {
      title: `${brand.namaLengkap} — ${brand.slogan}`,
      description: "Nomor OTP murah & cepat, deposit QRIS otomatis 24 jam.",
      images: brand.reseller ? [] : [brand.logo.utama ? { url: urlLogo(brand, "utama", "", "utama-png"), alt: brand.namaLengkap } : { url: "/logo.png", width: 1240, height: 780, alt: brand.namaLengkap }]
    }
  };
}

export const viewport = {
  // TANPA ini, env(safe-area-inset-*) bernilai NOL di iOS — selalu, di semua
  // peranti. Ada 12 tempat di kode ini yang memakai env() untuk menjaga tombol
  // agar tidak tertutup bilah gestur, dan sebelum baris ini ada, tidak satu
  // pun dari dua belas itu berpengaruh di iPhone. Halaman baru "keluar" ke
  // area aman setelah viewport-fit: cover dinyalakan, dan barulah insetnya
  // dilaporkan.
  //
  // Konsekuensinya: apa pun yang menempel di tepi layar sekarang WAJIB memberi
  // jatah env() sendiri — bilah navigasi bawah sudah disesuaikan bersamaan
  // dengan perubahan ini.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F0F6FF" },
    { media: "(prefers-color-scheme: dark)", color: "#04091C" }
  ]
};

export default async function RootLayout({ children }) {
  // Web reseller: tema biru & gaya bersih dipasang dari server supaya tidak berkedip dari tampilan web utama.
  const rw = !!(await rwDariNext());
  return (
    <html lang="id" className={`${sans.variable} ${mono.variable} ${bangers.variable}`} suppressHydrationWarning {...(rw ? { "data-rw": "1", "data-tema": "rw", "data-gaya": "bersih" } : {})}>
      <head>
        <meta httpEquiv="Cache-Control" content="no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: SKRIP_RW_AWAL }} />
        <script dangerouslySetInnerHTML={{ __html: SKRIP_GAYA_AWAL }} />
      </head>
      <body className="min-h-screen bg-bg font-body text-ink antialiased selection:bg-amber/20">
        {/* Selalu ada, termasuk di halaman maintenance: referensi filter ke
            id yang tidak ada bisa membuat elemen pemakainya tidak dirender. */}
        <InkFilters />
        <ThemeProvider>
          <UserProvider>
            <SiteChrome>{children}</SiteChrome>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
