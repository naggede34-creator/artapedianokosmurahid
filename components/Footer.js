import Link from "next/link";

export default function Footer() {
  return (
    <footer className="hidden border-t border-line bg-surface md:block">
      <div className="mx-auto grid max-w-content gap-8 px-5 py-12 sm:grid-cols-3">
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
            <Link href="/deposit" className="underline-grow w-fit transition-colors hover:text-amber-bright">Deposit Saldo</Link>
            <Link href="/otp" className="underline-grow w-fit transition-colors hover:text-amber-bright">Beli Nomor OTP</Link>
            <Link href="/riwayat" className="underline-grow w-fit transition-colors hover:text-amber-bright">Riwayat Transaksi</Link>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Bantuan</p>
          <div className="mt-3 flex flex-col gap-2.5 text-sm text-ink/80">
            <Link href="/cara-pakai" className="underline-grow w-fit transition-colors hover:text-amber-bright">Cara Menggunakan Web</Link>
            <Link href="/syarat" className="underline-grow w-fit transition-colors hover:text-amber-bright">Syarat & Ketentuan</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-line px-5 py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} Artapedia. Seluruh transaksi diproses otomatis oleh sistem.
      </div>
    </footer>
  );
}
