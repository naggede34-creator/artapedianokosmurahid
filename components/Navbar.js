"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser, useBrand } from "@/app/providers";
import ThemeToggle from "@/components/ThemeToggle";
import Sidebar from "@/components/Sidebar";
import InfoBell from "@/components/InfoBell";
import NotificationBell from "@/components/NotificationBell";

// QRIS Gateway sengaja tepat di samping Beranda: itu fitur andalan untuk merchant.
// `sorot` = tombol diberi bingkai; `dari` = layar terkecil yang menampilkannya di bilah atas (sisanya tetap ada di menu samping).
const links = [
  { href: "/dashboard", label: "Beranda" },
  { href: "/gateway", label: "QRIS Gateway", ikon: "🏦", sorot: true },
  { href: "/otp", label: "Nokos" },
  { href: "/deposit", label: "Deposit" },
  { href: "/kaget", label: "Kaget", ikon: "🧧" },
  { href: "/produk", label: "Produk" },
  { href: "/riwayat", label: "Riwayat", dari: "xl" },
  { href: "/chat", label: "WEARTA CHAT" },
  { href: "/harga", label: "Harga", dari: "2xl" }
];
const DARI = { xl: "hidden xl:inline-flex", "2xl": "hidden 2xl:inline-flex" };

export function Logo({ size = 34 }) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-teal-bright text-white"
      style={{ width: size, height: size, clipPath: "polygon(0 0, 72% 0, 100% 28%, 100% 100%, 0 100%)" }}
      aria-hidden="true"
    >
      <span className="text-[15px] font-extrabold tracking-tight">A</span>
      <span className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber" />
    </span>
  );
}

export default function Navbar() {
  const brand = useBrand();
  const { balance, ready, token } = useUser();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [avatar, setAvatar] = useState("😊");

  // Avatar pilihan pengguna (disimpan di perangkat, dipilih di halaman Profil Akun).
  useEffect(() => {
    if (!token) return;
    const baca = () => { try { setAvatar(localStorage.getItem(`avatar-${token}`) || "😊"); } catch {} };
    baca();
    window.addEventListener("avatar-berubah", baca);
    return () => window.removeEventListener("avatar-berubah", baca);
  }, [token]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setSidebarOpen(false), [pathname]);

  return (
    // Sidebar sengaja DI LUAR <header>: saat scroll, header memakai .glass yang
    // ber-backdrop-filter, dan itu membuat elemen position:fixed di dalamnya
    // terkurung di kotak header sehingga menu tidak kelihatan.
    <>
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-200 ${
        scrolled ? "glass border-line" : "border-transparent bg-bg/0"
      }`}
    >
      <div className="mx-auto flex max-w-content items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSidebarOpen(true)}
            className="press flex h-10 w-10 items-center justify-center rounded-xl text-ink transition-colors hover:bg-surface2"
            aria-label="Buka menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M4 12h10M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <Link href="/dashboard" className="flex items-center gap-2.5 pl-1">
            <Logo />
            <span className="text-[17px] font-extrabold tracking-tight text-ink">{brand.nama}</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/" && pathname?.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`${l.dari ? DARI[l.dari] : "inline-flex"} items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors xl:px-3 ${
                  active
                    ? "bg-amber-soft text-amber-bright"
                    : l.sorot
                      ? "border border-amber/40 bg-amber-soft/60 text-amber-bright hover:bg-amber-soft"
                      : "text-muted hover:text-ink"
                }`}
                data-testid={l.href === "/gateway" ? "nav-gateway" : undefined}
              >
                {l.ikon && <span aria-hidden="true" className="text-[13px] leading-none">{l.ikon}</span>}
                {l.href === "/chat" ? brand.chat : l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href="/deposit"
            className="hidden items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-bold tabular-nums text-ink transition-colors hover:border-amber/50 sm:flex"
            title="Isi saldo"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber text-[11px] font-extrabold text-white">+</span>
            {ready ? `Rp${Number(balance || 0).toLocaleString("id-ID")}` : "…"}
          </Link>
          <NotificationBell token={token} />
          <InfoBell />
          <ThemeToggle className="hidden sm:inline-flex" />
          {token && (
            <Link
              href="/profil"
              aria-label="Profil akun"
              title="Profil akun"
              className={`press flex h-10 w-10 items-center justify-center rounded-full border-2 text-lg transition-colors ${
                pathname === "/profil" ? "border-amber bg-amber-soft" : "border-line bg-surface hover:border-amber/60"
              }`}
            >
              <span aria-hidden="true">{avatar}</span>
            </Link>
          )}
        </div>
      </div>

    </header>
    <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
