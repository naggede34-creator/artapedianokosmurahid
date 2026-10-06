"use client";

import Link from "next/link";
import { useUser } from "@/app/providers";
import { rupiah } from "@/components/ui";

// Kartu saldo utama: satu angka besar + dua tombol aksi. Dipakai di dasbor dan halaman lain yang butuh ringkasan saldo.
export default function KartuSaldo({ className = "" }) {
  const { balance, depositBalance, ready } = useUser();
  const bisaDitarik = depositBalance != null ? Math.min(Number(depositBalance) || 0, Number(balance) || 0) : null;
  return (
    <section
      className={`kartu-saldo relative overflow-hidden rounded-3xl border-2 border-ink/80 p-5 text-white shadow-lift sm:p-6 ${className}`}
      style={{ background: "linear-gradient(135deg, rgb(var(--c-blue)) 0%, rgb(var(--c-navy)) 70%)" }}
      data-testid="kartu-saldo"
    >
      <span className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden="true" />
      <span className="pointer-events-none absolute -bottom-12 right-10 h-28 w-28 rounded-full bg-amber/30" aria-hidden="true" />
      <p className="relative text-[11px] font-black uppercase tracking-[0.18em] text-white/70">Saldo Nokos</p>
      <p className="relative mt-1 font-display text-4xl tracking-wide sm:text-5xl" data-testid="saldo-angka">
        {ready ? rupiah(balance || 0) : "…"}
      </p>
      {bisaDitarik != null && (
        <p className="relative mt-1 text-xs text-white/70">
          Bisa ditarik <b className="text-white">{rupiah(bisaDitarik)}</b> · sisanya saldo bonus
        </p>
      )}
      <div className="relative mt-5 grid grid-cols-2 gap-2.5">
        <Link href="/deposit" className="btn-3d flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-ink">
          <span aria-hidden="true">＋</span> Isi Saldo
        </Link>
        <Link href="/otp" className="btn-3d flex items-center justify-center gap-2 rounded-2xl bg-amber px-4 py-3 text-sm font-black text-white">
          <span aria-hidden="true">📱</span> Beli Nokos
        </Link>
      </div>
    </section>
  );
}
