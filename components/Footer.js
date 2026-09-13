import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto hidden max-w-content gap-8 px-5 py-12 sm:grid-cols-3 md:grid">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber text-sm font-bold text-white">A</span>
            <span className="font-display text-base font-semibold tracking-tight text-ink">Artapedia</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            Deposit dan beli nomor OTP untuk berbagai layanan, diproses otomatis 24 jam.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Navigasi</p>
          <div className="mt-3 flex flex-col gap-2.5 text-sm text-ink/80">
            <Link href="/dashboard" className="underline-grow w-fit transition-colors hover:text-amber-bright">Dashboard</Link>
            <Link href="/deposit" className="underline-grow w-fit transition-colors hover:text-amber-bright">Deposit Saldo</Link>
            <Link href="/otp" className="underline-grow w-fit transition-colors hover:text-amber-bright">Beli Nomor OTP</Link>
            <Link href="/transfer" className="underline-grow w-fit transition-colors hover:text-amber-bright">Transfer Saldo</Link>
            <Link href="/mutasi" className="underline-grow w-fit transition-colors hover:text-amber-bright">Mutasi Saldo</Link>
            <Link href="/riwayat" className="underline-grow w-fit transition-colors hover:text-amber-bright">Riwayat Transaksi</Link>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Bantuan &amp; Komunitas</p>
          <div className="mt-3 flex flex-col gap-2.5 text-sm text-ink/80">
            <Link href="/harga" className="underline-grow w-fit transition-colors hover:text-amber-bright">Daftar Harga</Link>
            <Link href="/informasi" className="underline-grow w-fit transition-colors hover:text-amber-bright">Pusat Informasi</Link>
            <Link href="/faq" className="underline-grow w-fit transition-colors hover:text-amber-bright">Bantuan (FAQ)</Link>
            <Link href="/cara-pakai" className="underline-grow w-fit transition-colors hover:text-amber-bright">Cara Menggunakan Web</Link>
            <Link href="/syarat" className="underline-grow w-fit transition-colors hover:text-amber-bright">Syarat & Ketentuan</Link>
            <a
              href="https://t.me/kkaelnokosmurah"
              target="_blank"
              rel="noreferrer"
              className="underline-grow flex w-fit items-center gap-1.5 transition-colors hover:text-teal-bright"
            >
              📢 Channel Info & Promo
            </a>
            <a
              href="https://t.me/diskusiduniotp"
              target="_blank"
              rel="noreferrer"
              className="underline-grow flex w-fit items-center gap-1.5 transition-colors hover:text-teal-bright"
            >
              💬 Diskusi Dunia OTP
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-line px-5 py-4 text-center text-xs text-muted md:border-t-0">
        {/* Pintu masuk admin: sengaja dibuat terlihat seperti teks biasa, bukan tombol. */}
        © {new Date().getFullYear()}{" "}
        <Link href="/admin/login" className="text-inherit no-underline hover:text-inherit">
          ARTA PEDIA iD
        </Link>
        . Seluruh transaksi diproses otomatis oleh sistem.
      </div>
    </footer>
  );
}
