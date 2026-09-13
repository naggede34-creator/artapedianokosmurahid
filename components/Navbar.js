"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";

const links = [
  { href: "/", label: "Beranda" },
  { href: "/deposit", label: "Deposit" },
  { href: "/otp", label: "Beli OTP" },
  { href: "/riwayat", label: "Riwayat" },
  { href: "/referral", label: "Undang Teman" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/cara-pakai", label: "Cara Pakai" },
  { href: "/syarat", label: "Syarat & Ketentuan" }
];

export default function Navbar() {
  const { token, balance, ready } = useUser();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
      <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="btn-3d flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber to-amber-bright text-sm font-bold text-white shadow-3d transition-transform duration-300 group-hover:-rotate-6">
            A
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-ink">Artapedia</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
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
              <span className="signal-pulse absolute inline-flex h-full w-full rounded-full bg-teal" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal" />
            </span>
            {ready ? `Rp${balance.toLocaleString("id-ID")}` : "Memuat..."}
          </button>
          <button
            className="press rounded-md p-2 text-ink md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Buka menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="transition-transform duration-300">
              <path
                d={menuOpen ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="expand-down border-t border-line bg-surface2 px-5 py-4">
          <div className="mx-auto max-w-content">
            <p className="text-xs text-muted">Kode akun kamu (simpan baik-baik, ini kunci ke saldo & riwayat):</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded border border-line bg-surface px-3 py-1.5 font-mono text-sm text-teal-bright">
                {token || "..."}
              </code>
              <button
                onClick={copyToken}
                className="press rounded border border-line px-3 py-1.5 text-xs text-ink transition-colors duration-200 hover:border-teal hover:text-teal-bright"
              >
                {copied ? "Tersalin!" : "Salin kode"}
              </button>
            </div>
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="expand-down border-t border-line bg-surface2 px-5 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="text-sm text-ink transition-colors duration-200 hover:text-amber-bright"
              >
                {l.label}
              </Link>
            ))}
            <button
              onClick={() => setOpen((v) => !v)}
              className="press mt-1 flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-teal" />
              {ready ? `Rp${balance.toLocaleString("id-ID")}` : "Memuat..."}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
