"use client";

import Link from "next/link";
import { useState } from "react";
import { useUser } from "@/app/providers";
import { teksPoin, teksRp } from "@/lib/poinGame";

// Kartu POIN GAME versi ringkas: dompet terpisah dari saldo nokos, dipakai untuk duel & game solo.
// Sengaja tipis supaya tidak menuhi layar utama — semua aksi tetap satu ketukan.
export default function GameWallet() {
  const { gameBalance, ready } = useUser();
  const [hidden, setHidden] = useState(false);
  const aksi = "rounded-lg px-1 py-1.5 text-center text-[12px] font-bold ring-1 ring-inset transition-transform active:scale-95";
  return (
    <div className="sim-card sim-game sim-enter overflow-hidden px-3.5 py-3" data-testid="kartu-saldo-game" title="2 poin = Rp1.000. Terpisah dari saldo nokos; bisa ditukar atau ditarik.">
      <div className="relative z-[1] flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-2xl leading-none" aria-hidden="true">🎲</span>
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-wide text-white/70">POIN GAME</p>
            <p className="flex items-baseline gap-1.5 leading-none">
              <span className="text-[20px] font-extrabold tabular-nums" data-testid="dasbor-saldo-game">
                {!ready ? "…" : hidden ? "••• poin" : teksPoin(gameBalance || 0)}
              </span>
              <span className="truncate text-[11px] font-semibold text-white/75" data-testid="dasbor-saldo-game-rp">{ready && !hidden ? `≈ ${teksRp(gameBalance || 0)}` : ""}</span>
            </p>
          </div>
        </div>
        <button type="button" onClick={() => setHidden((v) => !v)} className="shrink-0 rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label={hidden ? "Tampilkan saldo game" : "Sembunyikan saldo game"}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />{hidden && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}</svg>
        </button>
      </div>
      <div className="relative z-[1] mt-2 grid grid-cols-4 gap-1.5">
        <Link href="/game-deposit" data-testid="dasbor-deposit-game" className={`${aksi} bg-white text-[#2a0a5e] ring-white`}>➕ Isi</Link>
        <Link href="/game-deposit?tab=tukar" data-testid="dasbor-tukar-poin" className={`${aksi} bg-white/10 text-white ring-white/20 hover:bg-white/15`}>🔁 Tukar</Link>
        <Link href="/game-deposit?tab=tarik" data-testid="dasbor-tarik-poin" className={`${aksi} bg-white/10 text-white ring-white/20 hover:bg-white/15`}>💸 Tarik</Link>
        <Link href="/chat?game=1" data-testid="dasbor-main-game" className={`${aksi} bg-white/10 text-white ring-white/20 hover:bg-white/15`}>🎮 Main</Link>
      </div>
    </div>
  );
}
