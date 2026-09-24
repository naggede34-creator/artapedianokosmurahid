"use client";

import Link from "next/link";

// Ajakan mencoba QRIS Gateway, di beranda.
//
// Warnanya hijau-uang, beda dari kartu lain yang oranye/biru: fitur ini bukan
// "beli sesuatu", melainkan "terima uang" — dan dua hal itu jangan sampai
// tertukar di mata orang yang baru pertama melihatnya.
export default function GatewayTeaser({ className = "" }) {
  return (
    <section className={`panggung-3d ${className}`}>
      <Link
        href="/gateway"
        className="card balok-3d tepi-tebal group relative block overflow-hidden p-5 sm:p-6"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-12 text-[120px] leading-none opacity-[0.07] select-none"
        >
          💸
        </span>

        <div className="relative timbul">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border-2 border-ink bg-success px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
              Fitur Baru
            </span>
            <span className="text-[11px] font-black uppercase tracking-widest text-success">
              Terima pembayaran
            </span>
          </div>

          <h2 className="font-display judul-timbul mt-2 text-xl font-black leading-tight text-ink sm:text-2xl">
            QRIS GATEWAY
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
            Punya jualan sendiri? Buat QRIS pembayaran otomatis dari sini — tinggal masukkan nominal,
            QR-nya langsung jadi. Saldonya bisa ditarik ke e-wallet, atau dijadikan saldo Arta Pedia
            untuk beli nokos.
          </p>

          <ul className="mt-4 grid gap-1.5 text-[13px] text-ink sm:grid-cols-2">
            <li>⚡ QRIS otomatis, Rp2.000–Rp10jt</li>
            <li>🔑 API + dokumentasi lengkap</li>
            <li>🏦 Tarik ke DANA, OVO, GoPay, dll</li>
            <li>🔄 Bisa jadi saldo beli nokos</li>
          </ul>

          <span className="btn-primary press mt-5 flex w-full items-center justify-center gap-2 text-[15px]">
            🚀 KUY COBA FITUR QRIS GATEWAY
          </span>
        </div>
      </Link>
    </section>
  );
}
