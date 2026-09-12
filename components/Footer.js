import Link from "next/link";

export default function Footer() {
  return (
    <footer className="hidden border-t border-line bg-surface md:block">
      <div className="mx-auto grid max-w-content gap-8 px-5 py-10 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber text-sm font-bold text-white">A</span>
            <span className="font-display text-base font-semibold text-ink">Artapedia</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted">
            Deposit dan beli nomor OTP untuk berbagai layanan, diproses otomatis 24 jam.
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Navigasi</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
            <Link href="/deposit" className="hover:text-ink">Deposit Saldo</Link>
            <Link href="/otp" className="hover:text-ink">Beli Nomor OTP</Link>
            <Link href="/riwayat" className="hover:text-ink">Riwayat Transaksi</Link>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Bantuan</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
            <Link href="/cara-pakai" className="hover:text-ink">Cara Menggunakan Web</Link>
            <Link href="/syarat" className="hover:text-ink">Syarat & Ketentuan</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-line px-5 py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} Artapedia. Seluruh transaksi diproses otomatis oleh sistem.
      </div>
    </footer>
  );
}
