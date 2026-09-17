"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";
import ThemeToggle from "@/components/ThemeToggle";
import Sidebar from "@/components/Sidebar";
import InfoBell from "@/components/InfoBell";

const links = [
  { href: "/dashboard", label: "Beranda" },
  { href: "/otp", label: "Nokos" },
  { href: "/suntik", label: "Suntik Sosmed" },
  { href: "/deposit", label: "Deposit" },
  { href: "/riwayat", label: "Riwayat" },
  { href: "/harga", label: "Harga" }
];

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
  const { balance, ready } = useUser();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setSidebarOpen(false), [pathname]);

  return (
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
            <span className="text-[17px] font-extrabold tracking-tight text-ink">Artapedia</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/" && pathname?.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-amber-soft text-amber-bright" : "text-muted hover:text-ink"
                }`}
              >
                {l.label}
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
          <InfoBell />
          <ThemeToggle className="hidden sm:inline-flex" />
        </div>
      </div>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </header>
  );
}
