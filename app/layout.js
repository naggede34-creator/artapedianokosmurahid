import { Plus_Jakarta_Sans, JetBrains_Mono, Bangers } from "next/font/google";
import "./globals.css";
import { UserProvider, ThemeProvider } from "./providers";
import SiteChrome from "@/components/SiteChrome";
import InkFilters from "@/components/InkFilters";

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

export const metadata = {
  title: "Arta Pedia ID — Nokos Termurah dan Fast",
  description:
    "Beli nomor OTP (nokos) untuk WhatsApp, Telegram, Google dan ratusan layanan lain, dan isi saldo otomatis via QRIS. Diproses 24 jam.",
  icons: {
    icon: [{ url: "/logo-mark.svg", type: "image/svg+xml" }, { url: "/logo-mark.png", sizes: "512x512" }],
    apple: [{ url: "/logo-mark.png", sizes: "512x512" }]
  },
  openGraph: {
    title: "Arta Pedia ID — Nokos Termurah dan Fast",
    description: "Nomor OTP murah & cepat, deposit QRIS otomatis 24 jam.",
    images: [{ url: "/logo.png", width: 1240, height: 780, alt: "Arta Pedia ID" }]
  }
};

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

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${sans.variable} ${mono.variable} ${bangers.variable}`} suppressHydrationWarning>
      <head>
        <meta httpEquiv="Cache-Control" content="no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
