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

  return (
    <div className="mx-auto max-w-content px-5 py-14">
      <div className="max-w-xl">
        <p className="text-sm font-medium text-amber">Deposit</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink">Isi saldo pakai QRIS</h1>
        <p className="mt-3 text-sm text-muted">
          Saldo minimal Rp{MIN.toLocaleString("id-ID")}, maksimal Rp{MAX.toLocaleString("id-ID")} per transaksi.
          Saldo masuk otomatis setelah pembayaran terkonfirmasi.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
        {!order ? (
          <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-6">
            <label className="text-sm font-medium text-ink">Pilih nominal cepat</label>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {QUICK.map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => pickAmount(v)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    Number(amount) === v
                      ? "border-amber bg-amber-soft text-amber-bright"
                      : "border-line text-muted hover:border-amber/50 hover:text-ink"
                  }`}
                >
                  Rp{v.toLocaleString("id-ID")}
                </button>
              ))}
            </div>

            <label className="mt-5 block text-sm font-medium text-ink">Atau masukkan nominal lain</label>
            <div className="mt-2 flex items-center rounded-lg border border-line bg-bg px-3">
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

            {error && <p className="mt-3 text-sm text-rose">{error}</p>}

            <button
              type="submit"
              disabled={loading || !token}
              className="mt-6 w-full rounded-lg bg-amber px-5 py-3 text-sm font-medium text-white transition hover:bg-amber-bright disabled:opacity-60"
            >
              {loading ? "Memproses..." : "Buat pembayaran QRIS"}
            </button>

            <p className="mt-4 text-xs text-muted">
              Saldo kamu saat ini: <span className="text-ink">Rp{balance.toLocaleString("id-ID")}</span>
            </p>
          </form>
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center">
            {status === "completed" ? (
              <div>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-soft text-teal">
                  ✓
                </div>
                <h2 className="mt-4 font-display text-xl font-semibold text-ink">Deposit berhasil</h2>
                <p className="mt-2 text-sm text-muted">
                  Rp{Number(order.amount).toLocaleString("id-ID")} sudah masuk ke saldo kamu.
                </p>
                <button
                  onClick={resetForm}
                  className="mt-6 rounded-lg border border-line px-5 py-2.5 text-sm text-ink hover:border-teal"
                >
                  Deposit lagi
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted">Scan QRIS berikut menggunakan e-wallet atau m-banking</p>
                {order.qrImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={order.qrImage} alt="Kode QRIS pembayaran" className="mx-auto mt-4 h-56 w-56 rounded-lg bg-white p-2" />
                ) : (
                  <p className="mt-4 text-sm text-rose">QR tidak tersedia, coba buat ulang transaksi.</p>
                )}
                <p className="mt-4 font-display text-2xl font-semibold text-ink">
                  Rp{Number(order.amount).toLocaleString("id-ID")}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-teal">
                  <span className="signal-pulse h-1.5 w-1.5 rounded-full bg-teal" />
                  Menunggu pembayaran...
                </div>
                <p className="mt-4 text-xs text-muted">Kode order: {order.orderId}</p>
                <button
                  onClick={resetForm}
                  className="mt-6 text-xs text-muted underline underline-offset-4 hover:text-ink"
                >
                  Batalkan & buat transaksi baru
                </button>
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-line bg-bg p-6">
          <h3 className="font-display text-base font-medium text-ink">Yang perlu kamu tahu</h3>
          <ul className="mt-4 space-y-3 text-sm text-muted">
            <li>Pembayaran diverifikasi otomatis oleh sistem, biasanya dalam hitungan detik setelah QRIS discan.</li>
            <li>Saldo tidak bisa ditarik tunai kembali dan hanya bisa dipakai untuk transaksi di dalam Artapedia.</li>
            <li>Simpan kode akun kamu (lihat menu saldo di pojok kanan atas) untuk mengecek riwayat deposit kapan saja.</li>
            <li>Kalau QRIS kedaluwarsa sebelum dibayar, cukup buat transaksi baru — belum ada saldo yang terpotong.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
