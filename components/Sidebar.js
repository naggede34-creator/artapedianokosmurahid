"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { useUser } from "@/app/providers";
import { Icon } from "@/components/ui";

const I = {
  cart: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="20" r="1.4" fill="currentColor" />
      <circle cx="18" cy="20" r="1.4" fill="currentColor" />
      <path d="M2.5 3h2.2l1.9 11.1a2 2 0 0 0 2 1.65h8.4a2 2 0 0 0 2-1.6L20.8 7H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  tag: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M11.5 3h-6a1 1 0 0 0-1 1v6c0 .27.1.52.29.71l9 9a1 1 0 0 0 1.42 0l6-6a1 1 0 0 0 0-1.42l-9-9A1 1 0 0 0 11.5 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
    </svg>
  ),
  info: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M12 3.5c-3 0-5 2.2-5 5.3v3.2c0 .7-.25 1.4-.7 1.95L5 15.6c-.7.85-.1 2.15 1 2.15h12c1.1 0 1.7-1.3 1-2.15l-1.3-1.65a3 3 0 0 1-.7-1.95V8.8c0-3.1-2-5.3-5-5.3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  trophy: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M7 4h10v5a5 5 0 0 1-10 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 5.5H4v1.5A3 3 0 0 0 7 10M17 5.5h3v1.5A3 3 0 0 1 17 10M12 14v3.5M8.5 20.5h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  book: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
};

const sections = [
  {
    items: [{ href: "/dashboard", label: "Beranda", icon: <Icon.home width={19} height={19} /> }]
  },
  {
    title: "Belanja",
    items: [
      { href: "/otp", label: "Beli Nokos (OTP)", icon: <Icon.phone width={19} height={19} /> },
      { href: "/harga", label: "Daftar Harga Nokos", icon: I.tag },
      { href: "/chat", label: "Grup Chat", icon: <span style={{ fontSize: 17 }}>💬</span>, badge: "Live" },
      { href: "/reseller", label: "Buat Web Nokos", icon: <Icon.shop width={19} height={19} />, badge: "Baru" }
    ]
  },
  {
    title: "Saldo",
    items: [
      { href: "/deposit", label: "Isi Saldo (QRIS)", icon: <Icon.qris width={19} height={19} /> },
      { href: "/transfer", label: "Transfer Saldo", icon: <Icon.transfer width={19} height={19} /> },
      { href: "/mutasi", label: "Mutasi Saldo", icon: <Icon.ledger width={19} height={19} /> },
      { href: "/riwayat", label: "Riwayat Transaksi", icon: <Icon.history width={19} height={19} /> }
    ]
  },
  {
    title: "Hadiah",
    items: [
      { href: "/loyalitas", label: "Poin & Level", icon: <Icon.star width={19} height={19} /> },
      { href: "/toko-poin", label: "Toko Poin", icon: I.cart, badge: "Baru" },
      { href: "/misi", label: "Misi & Tantangan", icon: I.trophy, badge: "Baru" },
      { href: "/vip", label: "Level VIP", icon: I.tag },
      { href: "/referral", label: "Undang Teman", icon: <Icon.gift width={19} height={19} /> },
      { href: "/leaderboard", label: "Leaderboard", icon: I.trophy }
    ]
  },
  {
    title: "Bantuan",
    items: [
      { href: "/informasi", label: "Pusat Informasi", icon: I.info },
      { href: "/cara-pakai", label: "Cara Pakai", icon: I.book },
      { href: "/faq", label: "FAQ", icon: <Icon.help width={19} height={19} /> }
    ]
  }
];

export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const { balance, ready, name } = useUser();

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menu">
      <button
        aria-label="Tutup menu"
        onClick={onClose}
        className="animate-fade-in absolute inset-0"
        style={{ background: "rgb(var(--c-navy-bright) / 0.45)" }}
      />
      <aside className="animate-slide-in-left absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col border-r border-line bg-surface">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <div>
            <p className="text-[17px] font-extrabold tracking-tight text-ink">Artapedia</p>
            <p className="text-xs text-muted">
              {name ? `${name} · ` : ""}
              <span className="font-semibold tabular-nums text-ink">{ready ? `Rp${Number(balance || 0).toLocaleString("id-ID")}` : "…"}</span>
            </p>
          </div>
          <button onClick={onClose} className="press flex h-9 w-9 items-center justify-center rounded-xl border border-line text-ink" aria-label="Tutup">
            <Icon.x width={16} height={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {sections.map((section, i) => (
            <div key={i} className={i > 0 ? "mt-5" : "mt-2"}>
              {section.title && <p className="px-3 pb-1.5 text-xs font-semibold text-muted">{section.title}</p>}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors ${
                        active ? "bg-amber-soft text-amber-bright" : "text-ink hover:bg-surface2"
                      }`}
                    >
                      <span className={active ? "text-amber-bright" : "text-muted"}>{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && <span className="chip bg-amber text-white">{item.badge}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex items-center justify-between border-t border-line px-5 py-4">
          <span className="text-sm font-medium text-muted">Mode gelap</span>
          <ThemeToggle />
        </div>
      </aside>
    </div>
  );
}
