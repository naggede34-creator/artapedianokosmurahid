import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { UserProvider, ThemeProvider } from "./providers";
import SiteChrome from "@/components/SiteChrome";

// Dijalankan sebelum React hydrate supaya tidak ada kedipan (flash) warna:
// baca preferensi tersimpan, tapi kalau belum pernah memilih, defaultnya
// tetap mode terang.
const themeInitScript = `
(function () {
  try {
    var saved = localStorage.getItem("artapedia_theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
`;

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600"] });

export const metadata = {
  title: "Artapedia — Deposit & Beli Nomor OTP Otomatis",
  description:
    "Deposit saldo otomatis via QRIS dan beli nomor OTP untuk berbagai layanan (WhatsApp, Telegram, Google, dan lainnya), diproses otomatis 24 jam."
};

export const viewport = {
  themeColor: "#F0F4FA"
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${display.variable} ${body.variable} scroll-smooth`}>
      <head>
        {/* Cadangan buat browser dalam-app Telegram yang kadang tetap nyimpen cache
            halaman lama walau header Cache-Control dari server sudah bilang jangan. */}
        <meta httpEquiv="Cache-Control" content="no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-bg font-body text-ink antialiased selection:bg-amber/20 selection:text-amber-bright">
        <div className="aurora-bg" aria-hidden="true">
          <span className="aurora-blob left-[-10%] top-[-10%] h-[420px] w-[420px] bg-amber" />
          <span className="aurora-blob right-[-12%] top-[15%] h-[380px] w-[380px] bg-teal [animation-delay:-5s]" />
          <span className="aurora-blob bottom-[-15%] left-[20%] h-[360px] w-[360px] bg-ochre [animation-delay:-9s]" />
        </div>
        <ThemeProvider>
          <UserProvider>
            <SiteChrome>{children}</SiteChrome>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
