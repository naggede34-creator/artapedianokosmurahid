"use client";

import Link from "next/link";
import { useState } from "react";
import { useUser } from "@/app/providers";

function formatToken(token) {
  if (!token) return "AP-••••-••••-••••";
  return token;
}

// Kartu saldo berbentuk kartu SIM — elemen visual khas Artapedia.
export default function SimCard({ compact = false }) {
  const { token, balance, depositBalance, name, ready } = useUser();
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!token) return;
    navigator.clipboard?.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  // depositBalance: hanya dari deposit (bisa ditransfer). null = akun lama, tampilkan total.
  const showDeposit = depositBalance !== null && depositBalance !== undefined;
  const bonusBalance = showDeposit ? Math.max(0, (balance || 0) - (depositBalance || 0)) : 0;

  return (
    <div className="sim-card sim-enter overflow-hidden p-5 sm:p-6">
      <div className="relative z-[1] flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-white/65">{name ? `Saldo ${name}` : "Saldo kamu"}</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-[30px] font-extrabold leading-none tracking-tight tabular-nums sm:text-[36px]">
              {!ready ? "Rp…" : hidden ? "Rp•••••" : `Rp${Number(balance || 0).toLocaleString("id-ID")}`}
            </p>
            <button
              type="button"
              onClick={() => setHidden((v) => !v)}
              className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={hidden ? "Tampilkan saldo" : "Sembunyikan saldo"}
            >
              {hidden ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.6 9.6 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.3 2.4-2.6 3.7M6.2 6.3C4.2 7.6 2.7 9.6 2 12c1 2.5 5 7 10 7 1.6 0 3.1-.4 4.4-1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              )}
            </button>
          </div>

          {/* 2 balance breakdown: deposit vs bonus */}
          {ready && showDeposit && (
            <div className="mt-3 flex gap-3">
              <div className="flex-1 rounded-xl bg-white/10 px-3 py-2">
                <p className="text-[10px] font-medium text-white/55 mb-0.5">💳 Dari Deposit</p>
                <p className="text-[13px] font-extrabold tabular-nums text-white">
                  {hidden ? "Rp•••" : `Rp${Number(depositBalance || 0).toLocaleString("id-ID")}`}
                </p>
                <p className="text-[9px] text-white/40 mt-0.5">Bisa ditransfer</p>
              </div>
              <div className="flex-1 rounded-xl bg-white/10 px-3 py-2">
                <p className="text-[10px] font-medium text-white/55 mb-0.5">🎁 Bonus</p>
                <p className="text-[13px] font-extrabold tabular-nums text-white">
                  {hidden ? "Rp•••" : `Rp${bonusBalance.toLocaleString("id-ID")}`}
                </p>
                <p className="text-[9px] text-white/40 mt-0.5">Voucher / poin / hadiah</p>
              </div>
            </div>
          )}
        </div>
        <span className="sim-chip mt-1 grid h-9 w-12 shrink-0 grid-cols-3 gap-px overflow-hidden rounded-md p-[3px]" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="rounded-[2px] border border-black/10" />
          ))}
        </span>
      </div>

      <div className="relative z-[1] mt-4 flex flex-wrap items-end justify-between gap-3">
        <button type="button" onClick={copy} className="group text-left" title="Salin kode akun">
          <p className="text-[11px] font-medium text-white/55">Kode akun · ketuk untuk salin</p>
          <p className="mt-0.5 font-mono text-[15px] font-semibold tracking-wider text-white/95 group-hover:text-white">
            {copied ? "Tersalin ✓" : formatToken(token)}
          </p>
        </button>
        {!compact && (
          <div className="flex gap-2">
            <Link href="/deposit" className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#0b1d48] transition-transform active:scale-95">
              Isi saldo
            </Link>
            <Link href="/transfer" className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/15">
              Transfer
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
