"use client";

import Link from "next/link";
import { useState } from "react";
import { useUser } from "@/app/providers";

// Kartu SALDO GAME: dompet terpisah dari saldo nokos, dipakai untuk duel & game solo di WEARTA CHAT.
export default function GameWallet() {
  const { gameBalance, ready } = useUser();
  const [hidden, setHidden] = useState(false);
  return (
    <div className="sim-card sim-game sim-enter overflow-hidden p-5 sm:p-6" data-testid="kartu-saldo-game">
      <div className="relative z-[1] flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-white/70">
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-black tracking-wide text-white">🎮 SALDO GAME</span>
          </p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-[30px] font-extrabold leading-none tracking-tight tabular-nums sm:text-[36px]" data-testid="dasbor-saldo-game">
              {!ready ? "Rp…" : hidden ? "Rp•••••" : `Rp${Number(gameBalance || 0).toLocaleString("id-ID")}`}
            </p>
            <button type="button" onClick={() => setHidden((v) => !v)} className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label={hidden ? "Tampilkan saldo game" : "Sembunyikan saldo game"}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />{hidden && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}</svg>
            </button>
          </div>
          <p className="mt-2 max-w-[26ch] text-[11px] leading-snug text-white/60">Terpisah dari saldo nokos. Dipakai untuk duel & game solo.</p>
        </div>
        <span className="mt-1 text-4xl leading-none" aria-hidden="true">🎲</span>
      </div>
      <div className="relative z-[1] mt-4 grid grid-cols-2 gap-2">
        <Link href="/game-deposit" data-testid="dasbor-deposit-game" className="rounded-xl bg-white px-3 py-2.5 text-center text-sm font-bold text-[#2a0a5e] transition-transform active:scale-95">
          ➕ Isi saldo game
        </Link>
        <Link href="/chat?game=1" className="rounded-xl bg-white/10 px-3 py-2.5 text-center text-sm font-semibold text-white ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/15">
          🎮 Main game
        </Link>
      </div>
      <p className="relative z-[1] mt-2 text-[10px] text-white/50">Deposit via QRIS manual · bukti dibaca otomatis (OCR)</p>
    </div>
  );
}
