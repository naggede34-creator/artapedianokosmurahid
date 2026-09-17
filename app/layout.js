import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider, ThemeProvider } from "./providers";
import SiteChrome from "@/components/SiteChrome";

// Dijalankan sebelum React hydrate supaya tidak ada kedipan warna saat mode gelap.
const themeInitScript = `
(function () {
  try {
    var saved = localStorage.getItem("artapedia_theme");
    if (saved === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

// Plus Jakarta Sans: huruf yang dirancang untuk identitas kota Jakarta — pas untuk
// produk lokal. JetBrains Mono khusus untuk data yang harus dibaca persis
// (kode OTP, kode akun, ID transaksi).
const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap"
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["500", "600"], display: "swap" });

export const metadata = {
  title: "Artapedia — Nokos, Suntik Sosmed & Deposit QRIS Otomatis",
  description:
    "Beli nomor OTP (nokos) untuk WhatsApp, Telegram, Google dan ratusan layanan lain, suntik followers/likes/views, dan isi saldo otomatis via QRIS. Diproses 24 jam."
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F7FC" },
    { media: "(prefers-color-scheme: dark)", color: "#070C1A" }
  ]
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${sans.variable} ${mono.variable}`} style={{ "--font-display": "var(--font-body)" }} suppressHydrationWarning>
      <head>
        <meta httpEquiv="Cache-Control" content="no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-bg font-body text-ink antialiased selection:bg-amber/20">
        <ThemeProvider>
          <UserProvider>
            <SiteChrome>{children}</SiteChrome>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
