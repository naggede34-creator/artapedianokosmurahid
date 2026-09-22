"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui";

const tabs = [
  { href: "/dashboard", label: "Beranda", icon: Icon.home, match: ["/dashboard", "/"] },
  { href: "/otp", label: "Nokos", icon: Icon.phone },
  { href: "/deposit", label: "Deposit", icon: Icon.qris, primary: true },
  { href: "/bonus", label: "Bonus", icon: Icon.gift },
  { href: "/saldo-gratis", label: "Gratis", icon: Icon.coin }
];

export default function BottomNav() {
  const pathname = usePathname() || "/";

  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-50 border-x-0 border-b-0 md:hidden" aria-label="Navigasi bawah">
      <div className="mx-auto flex max-w-content items-end justify-between px-2 pt-1.5">
        {tabs.map((t) => {
          const active = t.match ? t.match.includes(pathname) : pathname.startsWith(t.href);
          const I = t.icon;
          if (t.primary) {
            return (
              <Link key={t.href} href={t.href} className="tap-scale flex flex-1 flex-col items-center gap-1 pb-2">
                <span
                  className={`-mt-5 flex h-12 w-12 items-center justify-center rounded-2xl text-white ring-4 ring-bg ${
                    active ? "bg-amber-bright" : "bg-amber"
                  }`}
                  style={{ boxShadow: "0 10px 20px -10px rgb(var(--c-blue) / 0.8)" }}
                >
                  <I width={22} height={22} />
                </span>
                <span className={`text-[11px] font-semibold ${active ? "text-amber-bright" : "text-muted"}`}>{t.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`tap-scale flex flex-1 flex-col items-center gap-1 pb-2 pt-1 text-[11px] font-semibold transition-colors ${
                active ? "text-amber-bright" : "text-muted"
              }`}
            >
              <span className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-amber-soft" : ""}`}>
                <I width={21} height={21} />
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
