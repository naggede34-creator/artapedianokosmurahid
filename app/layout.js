import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { UserProvider } from "./providers";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600"] });

export const metadata = {
  title: "Artapedia — Deposit & Beli Nomor OTP Otomatis",
  description:
    "Deposit saldo otomatis via QRIS dan beli nomor OTP untuk berbagai layanan (WhatsApp, Telegram, Google, dan lainnya), diproses otomatis 24 jam."
};

export const viewport = {
  themeColor: "#EEF2F9"
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${display.variable} ${body.variable} scroll-smooth`}>
      <body className="min-h-screen bg-bg font-body text-ink antialiased selection:bg-amber/20 selection:text-amber-bright">
        <div className="aurora-bg" aria-hidden="true">
          <span className="aurora-blob left-[-10%] top-[-10%] h-[420px] w-[420px] bg-amber" />
          <span className="aurora-blob right-[-12%] top-[15%] h-[380px] w-[380px] bg-teal [animation-delay:-5s]" />
          <span className="aurora-blob bottom-[-15%] left-[20%] h-[360px] w-[360px] bg-ochre [animation-delay:-9s]" />
        </div>
        <UserProvider>
          <Navbar />
          <main className="pb-24 md:pb-0">{children}</main>
          <Footer />
          <BottomNav />
        </UserProvider>
      </body>
    </html>
  );
}
