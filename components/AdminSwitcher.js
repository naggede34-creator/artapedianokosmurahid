"use client";

// Bilah pindah dasbor admin: tiap kelompok fitur punya dasbornya sendiri supaya tidak campur aduk.
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export const DASBOR_ADMIN = [
  { id: "pusat", href: "/admin", label: "Pusat", ikon: "🏠", ket: "Semua dasbor di satu tempat" },
  { id: "pengguna", href: "/admin/pengguna", label: "Pengguna & Blokir", ikon: "👥", ket: "Cari pengguna, lihat detail, blokir / buka blokir" },
  { id: "setor", href: "/admin/setor-gmail", label: "Stor Gmail", ikon: "📧", ket: "Untung per email, room, setoran, upah, penarikan saldo Stor" },
  { id: "tampilan", href: "/admin/tampilan", label: "Popup & Tampilan", ikon: "🎨", ket: "Popup pengumuman untuk pengguna & layar akun di-ban" },
  { id: "ringkas", href: "/admin/dashboard?k=ringkas", label: "Ringkasan", ikon: "📊", ket: "Statistik & semua transaksi" },
  { id: "uang", href: "/admin/dashboard?k=uang", label: "Keuangan", ikon: "💰", ket: "Deposit manual, tarik saldo, AustinPay, referral, giveaway, juara, job" },
  { id: "game", href: "/admin/dashboard?k=game", label: "Game & Chat", ikon: "🎮", ket: "Game, Arena, pembaruan, lencana, event musiman" },
  { id: "konten", href: "/admin/dashboard?k=konten", label: "Konten & Toko", ikon: "🛍️", ket: "Konten, banner, produk, tiket" },
  { id: "integrasi", href: "/admin/dashboard?k=integrasi", label: "Integrasi", ikon: "🔌", ket: "Gateway, bot Telegram, reseller, konfigurasi" },
  { id: "sistem", href: "/admin/dashboard?k=sistem", label: "Sistem", ikon: "⚙️", ket: "Pengaturan umum & tools" }
];

export default function AdminSwitcher() {
  const path = usePathname() || "";
  const k = useSearchParams()?.get("k") || "";
  const aktif = path === "/admin" ? "pusat" : path.startsWith("/admin/pengguna") ? "pengguna" : path.startsWith("/admin/setor-gmail") ? "setor" : path.startsWith("/admin/tampilan") ? "tampilan" : path.startsWith("/admin/dashboard") ? (k || "semua") : "";
  return (
    <nav className="no-scrollbar sticky top-0 z-40 flex gap-1 overflow-x-auto border-b border-line bg-surface/95 px-3 py-2 backdrop-blur-sm" aria-label="Dasbor admin" data-testid="admin-switcher">
      {DASBOR_ADMIN.map((d) => (
        <Link key={d.id} href={d.href} prefetch={false} title={d.ket} data-testid={`sw-${d.id}`} aria-current={aktif === d.id ? "page" : undefined}
          className={`flex min-w-max items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-colors ${aktif === d.id ? "bg-ink text-bg shadow-soft" : "text-muted hover:bg-surface2 hover:text-ink"}`}>
          <span aria-hidden="true">{d.ikon}</span>{d.label}
        </Link>
      ))}
    </nav>
  );
}
