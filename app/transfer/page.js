"use client";

import { useState } from "react";
import { useUser } from "@/app/providers";

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
    const amt = Number(amount);
    if (!target.trim()) return setError("Kode akun tujuan wajib diisi.");
    if (!amt || amt < 1000) return setError("Nominal transfer minimal Rp1.000.");
    if (amt > balance) return setError("Saldo kamu tidak mencukupi.");

    setLoading(true);
    try {
      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, targetToken: target.trim(), amount: amt })
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
    <div className="mx-auto max-w-content px-5 py-8">
      <p className="fade-up text-sm font-semibold uppercase tracking-wide text-amber-bright">🔁 Transfer Saldo</p>
      <h1 className="fade-up delay-1 mt-2 font-display text-display-sm font-semibold text-ink sm:text-display-md">
        Kirim saldo ke akun lain
      </h1>
      <p className="fade-up delay-2 mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Transfer saldo langsung ke kode akun teman kamu. Proses instan dan tidak bisa dibatalkan setelah berhasil.
      </p>

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
            <p className="rounded-lg bg-rose-soft px-3 py-2 text-xs font-medium text-rose-bright">{error}</p>
          )}
          {success && (
            <p className="rounded-lg bg-success-soft px-3 py-2 text-xs font-medium text-success">
              Berhasil mengirim Rp{success.amount.toLocaleString("id-ID")} ke {success.transferredTo}.
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !ready}
            className="btn-3d press mt-1 rounded-xl bg-gradient-to-r from-amber to-amber-bright py-3 text-sm font-semibold text-white shadow-3d disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Kirim Saldo"}
          </button>
        </form>

        <div className="card-shadow flex flex-col justify-between rounded-2xl border border-line bg-gradient-to-br from-amber-bright via-amber to-teal p-5 text-white">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/80">Saldo tersedia</p>
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
