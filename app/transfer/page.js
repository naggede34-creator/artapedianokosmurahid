"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/providers";
import { PageHeader, Icon } from "@/components/ui";

const rupiah = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;

export default function TransferPage() {
  const { token, balance, ready, refreshBalance } = useUser();
  const [cfg, setCfg] = useState(null);
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  // Konfigurasi (aktif/nonaktif + biaya admin) diambil dari server supaya angka
  // di layar persis sama dengan yang dipotong saat transfer diproses.
  useEffect(() => {
    let alive = true;
    fetch("/api/transfer")
      .then((r) => r.json())
      .then((d) => { if (alive && !d?.error) setCfg(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const min = cfg?.minAmount ?? 1000;
  const max = cfg?.maxAmount ?? 0;
  const enabled = cfg ? cfg.enabled !== false : true;

  const amt = Math.floor(Number(amount) || 0);
  const fee = useMemo(() => {
    if (!cfg || amt <= 0) return 0;
    return Math.ceil((amt * (cfg.feePercent || 0)) / 100) + (cfg.feeFlat || 0);
  }, [cfg, amt]);
  const total = amt > 0 ? amt + fee : 0;
  const hasFee = (cfg?.feePercent || 0) > 0 || (cfg?.feeFlat || 0) > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(null);
    if (!enabled) return setError("Fitur transfer saldo sedang dinonaktifkan oleh admin.");
    if (!target.trim()) return setError("Kode akun tujuan wajib diisi.");
    if (target.trim().toUpperCase() === token) return setError("Tidak bisa transfer ke akun sendiri.");
    if (!amt || amt < min) return setError(`Nominal transfer minimal ${rupiah(min)}.`);
    if (max > 0 && amt > max) return setError(`Nominal transfer maksimal ${rupiah(max)}.`);
    if (total > balance) return setError(`Saldo kamu tidak mencukupi. Dibutuhkan ${rupiah(total)}.`);

    const confirmMsg = hasFee
      ? `Kirim ${rupiah(amt)} ke ${target.trim().toUpperCase()}?\n\nBiaya admin ${rupiah(fee)}\nTotal dipotong ${rupiah(total)}\n\nTransfer tidak bisa dibatalkan.`
      : `Kirim ${rupiah(amt)} ke ${target.trim().toUpperCase()}? Transfer tidak bisa dibatalkan.`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, targetToken: target.trim().toUpperCase(), amount: amt })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transfer gagal.");
      setSuccess(data);
      setTarget("");
      setAmount("");
      refreshBalance();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <PageHeader
        icon={<Icon.transfer />}
        title="Transfer saldo"
        desc="Kirim saldo langsung ke kode akun teman. Instan dan tidak bisa dibatalkan setelah berhasil."
      />

      {cfg && !enabled && (
        <div className="fade-up mt-6 rounded-2xl border border-amber/40 bg-amber-soft p-5 text-center">
          <p className="text-3xl" aria-hidden="true">🔒</p>
          <p className="mt-2 text-sm font-bold text-ink">Transfer saldo sedang ditutup</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Admin sementara menonaktifkan transfer saldo antar pengguna. Saldo kamu tetap aman
            dan bisa dipakai untuk beli nokos seperti biasa.
          </p>
        </div>
      )}

      <div className="fade-up delay-3 mt-6 grid gap-4 md:grid-cols-[1fr_320px]">
        <form
          onSubmit={handleSubmit}
          className={`card-shadow flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 ${!enabled ? "pointer-events-none opacity-50" : ""}`}
        >
          <div>
            <label className="text-xs font-medium text-muted">Kode akun tujuan</label>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Contoh: AP-XXXX-XXXX-XXXX"
              className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-4 py-3 font-mono text-sm text-ink outline-none focus:border-amber"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Nominal transfer</label>
            <input
              type="number"
              min={min}
              step="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Minimal ${rupiah(min)}`}
              className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-4 py-3 text-sm text-ink outline-none focus:border-amber"
            />
            <p className="mt-1.5 text-[11px] text-muted">
              Minimal {rupiah(min)}
              {max > 0 ? ` · maksimal ${rupiah(max)}` : ""}
            </p>
          </div>

          {hasFee && (
            <div className="rounded-xl border border-line bg-surface2 p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Rincian biaya</p>
              <dl className="mt-2 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-muted">Diterima penerima</dt>
                  <dd className="font-semibold tabular-nums text-ink">{rupiah(amt)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted">
                    Biaya admin
                    {cfg?.feePercent ? ` (${cfg.feePercent}%` : " ("}
                    {cfg?.feeFlat ? `${cfg?.feePercent ? " + " : ""}${rupiah(cfg.feeFlat)}` : ""}
                    {")"}
                  </dt>
                  <dd className="font-semibold tabular-nums text-amber-bright">{rupiah(fee)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-1.5">
                  <dt className="font-bold text-ink">Total dipotong</dt>
                  <dd className="font-extrabold tabular-nums text-ink">{rupiah(total)}</dd>
                </div>
              </dl>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-rose-soft px-3 py-2 text-xs font-medium text-rose">{error}</p>
          )}
          {success && (
            <p className="rounded-lg bg-success-soft px-3 py-2 text-xs font-medium text-success">
              Berhasil mengirim {rupiah(success.amount)} ke {success.transferredTo}.
              {success.fee > 0 ? ` Biaya admin ${rupiah(success.fee)}, total dipotong ${rupiah(success.total)}.` : ""}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !ready || !enabled}
            className="btn-3d press mt-1 rounded-xl bg-amber hover:bg-amber-bright py-3 text-sm font-semibold text-white shadow-3d disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Kirim Saldo"}
          </button>
        </form>

        <div className="card-shadow flex flex-col justify-between sim-card p-5 text-white">
          <div>
            <p className="text-xs text-white/80">Saldo tersedia</p>
            <p className="mt-1 font-display text-2xl font-semibold">
              {ready ? rupiah(balance) : "Rp0"}
            </p>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-white/85">
            Pastikan kode akun tujuan benar sebelum mengirim. Saldo yang sudah terkirim tidak dapat ditarik kembali.
            {hasFee ? " Biaya admin dipotong dari saldo pengirim; penerima tetap menerima nominal penuh." : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
