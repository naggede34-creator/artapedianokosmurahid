"use client";

import Link from "next/link";
import { useState } from "react";
import { useUser } from "@/app/providers";

const links = [
  { href: "/", label: "Beranda" },
  { href: "/deposit", label: "Deposit" },
  { href: "/otp", label: "Beli OTP" },
  { href: "/riwayat", label: "Riwayat" },
  { href: "/cara-pakai", label: "Cara Pakai" },
  { href: "/syarat", label: "Syarat & Ketentuan" }
];

export default function Navbar() {
  const { token, balance, ready } = useUser();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function copyToken() {
    if (!token) return;
    navigator.clipboard?.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber text-sm font-bold text-white">
            A
          </span>
          <span className="font-display text-lg font-semibold text-ink">Artapedia</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-muted transition hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="hidden items-center gap-2 rounded-full border border-line bg-surface2 px-3 py-1.5 text-sm text-ink sm:flex"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-teal" />
            {ready ? `Rp${balance.toLocaleString("id-ID")}` : "Memuat..."}
          </button>
          <button
            className="rounded-md p-2 text-ink md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Buka menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-surface2 px-5 py-4">
          <div className="mx-auto max-w-content">
            <p className="text-xs text-muted">Kode akun kamu (simpan baik-baik, ini kunci ke saldo & riwayat):</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded border border-line bg-surface px-3 py-1.5 font-mono text-sm text-teal-bright">
                {token || "..."}
              </code>
              <button onClick={copyToken} className="rounded border border-line px-3 py-1.5 text-xs text-ink hover:border-teal">
                {copied ? "Tersalin!" : "Salin kode"}
              </button>
            </div>
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="border-t border-line bg-surface2 px-5 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="text-sm text-ink">
                {l.label}
              </Link>
            ))}
            <button
              onClick={() => setOpen((v) => !v)}
              className="mt-1 flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink"
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
