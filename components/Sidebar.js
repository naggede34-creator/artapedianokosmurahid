"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import ThemeToggle from "@/components/ThemeToggle";

const ICONS = {
  dashboard: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  ),
  cartPrimary: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="20" r="1.4" fill="currentColor" />
      <circle cx="18" cy="20" r="1.4" fill="currentColor" />
      <path d="M2.5 3h2.2l1.9 11.1a2 2 0 0 0 2 1.65h8.4a2 2 0 0 0 2-1.6L20.8 7H6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  bolt: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  ),
  card: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5.5" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 9.5h18" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6.5 14.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  transfer: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M4 8h13M17 8l-3-3M17 8l-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 16H7M7 16l3-3M7 16l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  mutasi: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3.5" width="16" height="17" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  history: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M4 12a8 8 0 1 0 2.34-5.66" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M4 4v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  tag: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M11.5 3h-6a1 1 0 0 0-1 1v6c0 .27.1.52.29.71l9 9a1 1 0 0 0 1.42 0l6-6a1 1 0 0 0 0-1.42l-9-9A1 1 0 0 0 11.5 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
    </svg>
  ),
  info: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="4" width="17" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7.5 8h9M7.5 12h9M7.5 16h5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  faq: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.6 9.3a2.4 2.4 0 1 1 3.6 2.1c-.8.5-1.2.9-1.2 1.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </svg>
  ),
  docs: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="m8 9-4 3 4 3M16 9l4 3-4 3M13.5 6.5l-3 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  terminal: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4.5" width="18" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="m7 9.5 3 2.5-3 2.5M12.5 15h4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  star: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="m12 3.5 2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.7l-5.2 2.8 1-5.75-4.2-4.1 5.8-.85Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  ),
  gift: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="9" width="17" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 12.5h17M12 9v11" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 9C9 9 8 7.5 8 6.3A2.3 2.3 0 0 1 12 4.8 2.3 2.3 0 0 1 16 6.3C16 7.5 15 9 12 9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  ),
  trophy: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M7 4h10v5a5 5 0 0 1-10 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M7 5.5H4v1.5A3 3 0 0 0 7 10M17 5.5h3v1.5A3 3 0 0 1 17 10M10 17.5h4M12 14v3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8.5 20.5h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
};

const sections = [
  {
    items: [{ href: "/dashboard", label: "Dashboard", icon: "dashboard" }]
  },
  {
    title: "Transaksi",
    items: [
      { href: "/otp?server=1", label: "Order OTP Utama", icon: "cartPrimary" },
      { href: "/otp?server=2", label: "Order OTP Kedua", icon: "bolt" },
      { href: "/deposit", label: "Deposit Saldo", icon: "card" },
      { href: "/transfer", label: "Transfer Saldo", icon: "transfer" },
      { href: "/mutasi", label: "Mutasi Saldo", icon: "mutasi" },
      { href: "/riwayat", label: "Riwayat Transaksi", icon: "history" }
    ]
  },
  {
    title: "Loyalitas",
    items: [
      { href: "/loyalitas", label: "Poin & Level", icon: "star" },
      { href: "/referral", label: "Undang Teman", icon: "gift" },
      { href: "/leaderboard", label: "Leaderboard", icon: "trophy" }
    ]
  },
  {
    title: "Informasi",
    items: [
      { href: "/harga", label: "Daftar Harga", icon: "tag" },
      { href: "/informasi", label: "Pusat Informasi", icon: "info" },
      { href: "/faq", label: "Bantuan (FAQ)", icon: "faq" }
    ]
  },
  {
    title: "Developer",
    items: [
      { href: "/faq#server-1", label: "Docs Server 1", icon: "docs" },
      { href: "/faq#server-2", label: "Docs Server 2", icon: "terminal" }
    ]
  }
];

export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        aria-label="Tutup menu"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-navy-bright/50 backdrop-blur-[2px]"
        style={{ background: "rgb(var(--c-ink) / 0.45)" }}
      />
      <aside className="animate-slide-in-left absolute inset-y-0 left-0 flex w-[85%] max-w-[320px] flex-col bg-surface shadow-lift">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="btn-3d flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber to-amber-bright text-sm font-bold text-white shadow-3d">
              A
            </span>
            <span className="font-display text-lg font-semibold text-ink">Menu</span>
          </div>
          <button
            onClick={onClose}
            className="press flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink"
            aria-label="Tutup"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section, i) => (
            <div key={i} className={i > 0 ? "mt-4" : ""}>
              {section.title && (
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {section.title}
                </p>
              )}
              <div className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const path = item.href.split(/[?#]/)[0];
                  const active = path !== "/" && pathname?.startsWith(path);
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={onClose}
                      className={`press flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-150 ${
                        active
                          ? "bg-amber-soft font-medium text-amber-bright"
                          : "text-ink hover:bg-surface2"
                      }`}
                    >
                      <span className={active ? "text-amber-bright" : "text-muted"}>{ICONS[item.icon]}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex items-center justify-between border-t border-line px-5 py-4">
          <span className="text-sm text-muted">Mode tampilan</span>
          <ThemeToggle />
        </div>
      </aside>
    </div>
  );
}
