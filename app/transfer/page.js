"use client";

import { useState } from "react";
import { useUser } from "@/app/providers";
import { PageHeader, Icon } from "@/components/ui";

export default function TransferPage() {
  const { token, balance, ready, refreshBalance } = useUser();
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(null);
    const amt = Math.floor(Number(amount));
    if (!target.trim()) return setError("Kode akun tujuan wajib diisi.");
    if (target.trim().toUpperCase() === token) return setError("Tidak bisa transfer ke akun sendiri.");
    if (!amt || amt < 1000) return setError("Nominal transfer minimal Rp1.000.");
    if (amt > balance) return setError("Saldo kamu tidak mencukupi.");
    if (!window.confirm(`Kirim Rp${amt.toLocaleString("id-ID")} ke ${target.trim().toUpperCase()}? Transfer tidak bisa dibatalkan.`)) return;

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

      <div className="fade-up delay-3 mt-6 grid gap-4 md:grid-cols-[1fr_320px]">
        <form onSubmit={handleSubmit} className="card-shadow flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
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
              min="1000"
              step="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Minimal Rp1.000"
              className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-4 py-3 text-sm text-ink outline-none focus:border-amber"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-rose-soft px-3 py-2 text-xs font-medium text-rose">{error}</p>
          )}
          {success && (
            <p className="rounded-lg bg-success-soft px-3 py-2 text-xs font-medium text-success">
              Berhasil mengirim Rp{success.amount.toLocaleString("id-ID")} ke {success.transferredTo}.
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !ready}
            className="btn-3d press mt-1 rounded-xl bg-amber hover:bg-amber-bright py-3 text-sm font-semibold text-white shadow-3d disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Kirim Saldo"}
          </button>
        </form>

        <div className="card-shadow flex flex-col justify-between sim-card p-5 text-white">
          <div>
            <p className="text-xs text-white/80">Saldo tersedia</p>
            <p className="mt-1 font-display text-2xl font-semibold">
              {ready ? `Rp${balance.toLocaleString("id-ID")}` : "Rp0"}
            </p>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-white/85">
            Pastikan kode akun tujuan benar sebelum mengirim. Saldo yang sudah terkirim tidak dapat ditarik kembali.
          </p>
        </div>
      </div>
    </div>
  );
}
