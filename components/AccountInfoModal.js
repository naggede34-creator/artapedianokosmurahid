"use client";

import { useEffect, useState } from "react";

function formatJoinDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function AccountInfoModal({ open, onClose, token, balance, joinedAt }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!open) return null;

  function copyToken() {
    if (!token) return;
    navigator.clipboard?.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-5">
      <button
        aria-label="Tutup"
        onClick={onClose}
        className="animate-fade-in absolute inset-0"
        style={{ background: "rgb(var(--c-ink) / 0.45)" }}
      />
      <div className="animate-scale-in relative w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
        <div className="flex items-center justify-between bg-gradient-to-r from-amber-bright via-amber to-teal px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-base">👤</span>
            <p className="text-sm font-semibold">Info Akun</p>
          </div>
          <button
            onClick={onClose}
            className="press flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/15"
            aria-label="Tutup"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div>
            <p className="text-xs font-medium text-muted">Kode Akun</p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl border border-line bg-surface2 px-3 py-2.5 font-mono text-sm text-ink">
                {token || "..."}
              </code>
              <button
                onClick={copyToken}
                className="press flex-shrink-0 rounded-xl border border-line px-3 py-2.5 text-xs font-medium text-ink transition-colors hover:border-amber hover:text-amber-bright"
              >
                {copied ? "Tersalin!" : "Salin"}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted">
              Simpan kode ini baik-baik — ini satu-satunya kunci ke saldo &amp; riwayat kamu.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-surface2 p-3.5">
              <p className="text-xs text-muted">Saldo</p>
              <p className="mt-1 font-display text-lg font-semibold text-ink">
                Rp{Number(balance || 0).toLocaleString("id-ID")}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface2 p-3.5">
              <p className="text-xs text-muted">Tanggal Bergabung</p>
              <p className="mt-1 text-sm font-semibold text-ink">{formatJoinDate(joinedAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
