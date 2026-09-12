"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/",
    label: "Home",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"
          stroke="currentColor"
          strokeWidth={active ? 2 : 1.6}
          strokeLinejoin="round"
        />
      </svg>
    )
  },
  {
    href: "/deposit",
    label: "Deposit",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
        <path d="M3.5 10h17" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
        <circle cx="16.5" cy="14" r="1.2" fill="currentColor" />
      </svg>
    )
  },
  {
    href: "/riwayat",
    label: "Aktivitas",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 12a8 8 0 1 0 2.34-5.66"
          stroke="currentColor"
          strokeWidth={active ? 2 : 1.6}
          strokeLinecap="round"
        />
        <path d="M4 4v4h4" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    href: "/cara-pakai",
    label: "Panduan",
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
        <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" />
      </svg>
    )
  }
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 shadow-[0_-8px_24px_-16px_rgba(33,28,22,0.25)] backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-content items-stretch justify-between px-2">
        {tabs.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`tap-scale relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors duration-200 ${
                active ? "text-amber-bright" : "text-muted"
              }`}
            >
              {active && (
                <span className="absolute top-1 h-1 w-1 rounded-full bg-amber animate-scale-in" />
              )}
              <span className={`transition-transform duration-200 ${active ? "-translate-y-0.5" : ""}`}>
                {t.icon(active)}
              </span>
              <span className={active ? "font-medium" : ""}>{t.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
