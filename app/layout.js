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

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen bg-bg font-body text-ink antialiased">
        <UserProvider>
          <Navbar />
          <main className="pb-20 md:pb-0">{children}</main>
          <Footer />
          <BottomNav />
        </UserProvider>
      </body>
    </html>
  );
}
