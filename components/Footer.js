import Link from "next/link";
import { Logo } from "@/components/Navbar";

const cols = [
  {
    title: "Layanan",
    links: [
      { href: "/otp", label: "Beli nokos / OTP" },
      { href: "/deposit", label: "Isi saldo QRIS" },
      { href: "/harga", label: "Daftar harga" }
    ]
  },
  {
    title: "Akun",
    links: [
      { href: "/riwayat", label: "Riwayat transaksi" },
      { href: "/mutasi", label: "Mutasi saldo" },
      { href: "/transfer", label: "Transfer saldo" },
      { href: "/referral", label: "Undang teman" }
    ]
  },
  {
    title: "Bantuan",
    links: [
      { href: "/cara-pakai", label: "Cara pakai" },
      { href: "/faq", label: "FAQ" },
      { href: "/informasi", label: "Pusat informasi" },
      { href: "/syarat", label: "Syarat & ketentuan" }
    ]
  }
];

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-line bg-surface">
      <div className="mx-auto hidden max-w-content gap-10 px-5 py-12 md:grid md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo size={30} />
            <span className="text-base font-extrabold tracking-tight text-ink">Artapedia</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Nomor OTP dan isi saldo QRIS — semuanya diproses otomatis 24 jam.
          </p>
          <div className="mt-4 flex gap-2">
            <a href="https://t.me/kkaelnokosmurah" target="_blank" rel="noreferrer" className="btn-ghost px-3 py-2 text-xs">
              Channel Telegram
            </a>
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-bold text-ink">{c.title}</p>
            <ul className="mt-3 space-y-2.5 text-sm">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted transition-colors hover:text-amber-bright">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line px-5 py-4 text-center text-xs text-muted md:border-t">
        {/* Pintu masuk admin: sengaja terlihat seperti teks biasa. */}©{" "}
        {new Date().getFullYear()}{" "}
        <Link href="/admin/login" className="text-inherit no-underline hover:text-inherit">
          ARTA PEDIA iD
        </Link>
        . Semua transaksi diproses otomatis oleh sistem.
      </div>
    </footer>
  );
}
