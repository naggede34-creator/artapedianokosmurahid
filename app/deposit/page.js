"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@/app/providers";

const MIN = 2000;
const MAX = 1000000;
const QUICK = [2000, 5000, 10000, 20000, 50000, 100000, 250000, 500000, 1000000];

export default function DepositPage() {
  const { token, balance, refreshBalance } = useUser();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("pending");
  const pollRef = useRef(null);

  const [voucherCode, setVoucherCode] = useState("");
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherMsg, setVoucherMsg] = useState("");
  const [voucherError, setVoucherError] = useState("");

  useEffect(() => () => clearInterval(pollRef.current), []);

  function pickAmount(v) {
    setAmount(String(v));
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < MIN || amt > MAX) {
      setError(`Nominal harus antara Rp${MIN.toLocaleString("id-ID")} - Rp${MAX.toLocaleString("id-ID")}.`);
      return;
    }
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch("/api/deposit/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, amount: amt })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat transaksi.");
      setOrder(data);
      setStatus("pending");
      startPolling(data.orderId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startPolling(orderId) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/deposit/status?order_id=${orderId}&token=${token}`);
        const data = await res.json();
        if (res.ok) {
          setStatus(data.status);
          if (data.status === "completed") {
            clearInterval(pollRef.current);
            refreshBalance();
          }
        }
      } catch (e) {
        /* diamkan, coba lagi di interval berikutnya */
      }
    }, 3000);
  }

  function resetForm() {
    setOrder(null);
    setAmount("");
    setStatus("pending");
    clearInterval(pollRef.current);
  }

  async function redeemVoucher(e) {
    e.preventDefault();
    setVoucherMsg("");
    setVoucherError("");
    if (!voucherCode.trim() || !token) return;
    setVoucherLoading(true);
    try {
      const res = await fetch("/api/voucher/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code: voucherCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengklaim voucher.");
      setVoucherMsg(`Berhasil! Rp${Number(data.amount).toLocaleString("id-ID")} masuk ke saldo kamu.`);
      setVoucherCode("");
      refreshBalance();
    } catch (err) {
      setVoucherError(err.message);
    } finally {
      setVoucherLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-content px-5 py-14">
      <div className="fade-up max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-bright">Deposit</p>
        <h1 className="mt-2 font-display text-display-sm font-semibold text-ink sm:text-display-md">Isi saldo pakai QRIS</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Saldo minimal Rp{MIN.toLocaleString("id-ID")}, maksimal Rp{MAX.toLocaleString("id-ID")} per transaksi.
          Saldo masuk otomatis setelah pembayaran terkonfirmasi.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
        {!order ? (
          <form onSubmit={submit} className="fade-up delay-1 card-shadow rounded-2xl border border-line bg-surface p-6">
            <label className="text-sm font-medium text-ink">Pilih nominal cepat</label>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {QUICK.map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => pickAmount(v)}
                  className={`press rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-200 ${
                    Number(amount) === v
                      ? "border-amber bg-amber-soft text-amber-bright shadow-soft"
                      : "border-line text-muted hover:border-amber/50 hover:text-ink"
                  }`}
                >
                  Rp{v.toLocaleString("id-ID")}
                </button>
              ))}
            </div>

            <label className="mt-5 block text-sm font-medium text-ink">Atau masukkan nominal lain</label>
            <div className="mt-2 flex items-center rounded-lg border border-line bg-bg px-3 transition-colors focus-within:border-amber">
              <span className="text-sm text-muted">Rp</span>
              <input
                type="number"
                min={MIN}
                max={MAX}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent px-2 py-3 text-sm text-ink outline-none"
              />
            </div>

            {error && <p className="mt-3 animate-fade-up text-sm text-rose">{error}</p>}

            <button
              type="submit"
              disabled={loading || !token}
              className="press mt-6 w-full rounded-lg bg-amber px-5 py-3 text-sm font-medium text-white shadow-soft transition-colors hover:bg-amber-bright disabled:opacity-60"
            >
              {loading ? "Memproses..." : "Buat pembayaran QRIS"}
            </button>

            <p className="mt-4 text-xs text-muted">
              Saldo kamu saat ini: <span className="font-medium text-ink">Rp{balance.toLocaleString("id-ID")}</span>
            </p>
          </form>
        ) : (
          <div className="scale-in card-shadow rounded-2xl border border-line bg-surface p-6 text-center">
            {status === "completed" ? (
              <div>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-soft text-teal animate-scale-in">
                  ✓
                </div>
                <h2 className="mt-4 font-display text-xl font-semibold text-ink">Deposit berhasil</h2>
                <p className="mt-2 text-sm text-muted">
                  Rp{Number(order.amount).toLocaleString("id-ID")} sudah masuk ke saldo kamu.
                </p>
                <button
                  onClick={resetForm}
                  className="press mt-6 rounded-lg border border-line px-5 py-2.5 text-sm text-ink transition-colors hover:border-teal hover:text-teal-bright"
                >
                  Deposit lagi
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted">Scan QRIS berikut menggunakan e-wallet atau m-banking</p>
                {order.qrImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={order.qrImage} alt="Kode QRIS pembayaran" className="mx-auto mt-4 h-56 w-56 rounded-lg bg-white p-2 shadow-soft" />
                ) : (
                  <p className="mt-4 text-sm text-rose">QR tidak tersedia, coba buat ulang transaksi.</p>
                )}
                <p className="mt-4 font-display text-2xl font-semibold text-ink">
                  Rp{Number(order.amount).toLocaleString("id-ID")}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-teal-bright">
                  <span className="signal-pulse h-1.5 w-1.5 rounded-full bg-teal" />
                  Menunggu pembayaran...
                </div>
                <p className="mt-4 text-xs text-muted">Kode order: {order.orderId}</p>
                <button
                  onClick={resetForm}
                  className="underline-grow mt-6 text-xs text-muted hover:text-ink"
                >
                  Batalkan & buat transaksi baru
                </button>
              </div>
            )}
          </div>
        )}

        <div>
        <div className="fade-up delay-2 rounded-2xl border border-line bg-surface2 p-6">
          <h3 className="font-display text-base font-medium text-ink">Punya kode voucher?</h3>
          <p className="mt-1.5 text-xs text-muted">Tukarkan kode voucher untuk tambahan saldo gratis.</p>
          <form onSubmit={redeemVoucher} className="mt-3 flex gap-2">
            <input
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
              placeholder="Kode voucher"
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm uppercase text-ink outline-none focus:border-teal"
            />
            <button
              type="submit"
              disabled={voucherLoading || !token}
              className="press shrink-0 rounded-lg border border-teal/40 px-4 py-2.5 text-sm font-medium text-teal-bright transition-colors hover:bg-teal-soft disabled:opacity-60"
            >
              {voucherLoading ? "..." : "Klaim"}
            </button>
          </form>
          {voucherMsg && <p className="mt-2 text-xs font-medium text-teal-bright">{voucherMsg}</p>}
          {voucherError && <p className="mt-2 text-xs text-rose">{voucherError}</p>}
        </div>

        <div className="fade-up delay-2 mt-6 rounded-2xl border border-line bg-surface2 p-6">
          <h3 className="font-display text-base font-medium text-ink">Yang perlu kamu tahu</h3>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
            <li className="flex gap-2.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber" />Pembayaran diverifikasi otomatis oleh sistem, biasanya dalam hitungan detik setelah QRIS discan.</li>
            <li className="flex gap-2.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber" />Saldo tidak bisa ditarik tunai kembali dan hanya bisa dipakai untuk transaksi di dalam Artapedia.</li>
            <li className="flex gap-2.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber" />Simpan kode akun kamu (lihat menu saldo di pojok kanan atas) untuk mengecek riwayat deposit kapan saja.</li>
            <li className="flex gap-2.5"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber" />Kalau QRIS kedaluwarsa sebelum dibayar, cukup buat transaksi baru — belum ada saldo yang terpotong.</li>
          </ul>
        </div>
        </div>
      </div>
    </div>
  );
}
