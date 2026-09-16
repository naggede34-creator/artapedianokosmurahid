"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";
import ThemeToggle from "@/components/ThemeToggle";
import Sidebar from "@/components/Sidebar";
import InfoBell from "@/components/InfoBell";
import InviteButton from "@/components/InviteButton";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/otp", label: "Beli OTP" },
  { href: "/deposit", label: "Deposit" },
  { href: "/riwayat", label: "Riwayat" },
  { href: "/loyalitas", label: "Poin & Level" },
  { href: "/harga", label: "Daftar Harga" },
  { href: "/informasi", label: "Informasi" },
  { href: "/faq", label: "Bantuan" }
];

export default function Navbar() {
  const { token, name, balance, ready } = useUser();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function copyToken() {
    if (!token) return;
    navigator.clipboard?.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <header
      className={`sticky top-0 z-50 transition-shadow duration-300 ${
        scrolled ? "glass shadow-lift" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-content items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="press flex h-9 w-9 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface2"
            aria-label="Buka menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <Link href="/dashboard" className="group flex items-center gap-2.5">
            <span className="btn-3d flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber to-amber-bright text-sm font-bold text-white shadow-3d transition-transform duration-300 group-hover:-rotate-6">
              A
            </span>
            <span className="hidden font-display text-lg font-semibold tracking-tight text-ink sm:inline">
              Artapedia
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="underline-grow text-sm text-muted transition-colors duration-200 hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="press hidden items-center gap-2 rounded-full border border-line bg-surface2 px-3 py-1.5 text-sm text-ink transition-colors duration-200 hover:border-amber/40 sm:flex"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="signal-pulse absolute inline-flex h-full w-full rounded-full bg-amber" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber" />
            </span>
            {ready ? `Rp${balance.toLocaleString("id-ID")}` : "Memuat..."}
          </button>
          <InviteButton />
          <InfoBell />
          <ThemeToggle className="hidden sm:inline-flex" />
        </div>
      </div>

      {open && (
        <div className="expand-down border-t border-line bg-surface2 px-5 py-4">
          <div className="mx-auto max-w-content">
            {name && <p className="mb-1 text-sm font-semibold text-ink">Halo, {name} 👋</p>}
            <p className="text-xs text-muted">Kode akun kamu (simpan baik-baik, ini kunci ke saldo & riwayat):</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded border border-line bg-surface px-3 py-1.5 font-mono text-sm text-amber-bright">
                {token || "..."}
              </code>
              <button
                onClick={copyToken}
                className="press rounded border border-line px-3 py-1.5 text-xs text-ink transition-colors duration-200 hover:border-amber hover:text-amber-bright"
              >
                {copied ? "Tersalin!" : "Salin kode"}
              </button>
              <div className="ml-auto flex items-center gap-2 sm:hidden">
                <span className="text-xs text-muted">Mode</span>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </header>
  );
}
