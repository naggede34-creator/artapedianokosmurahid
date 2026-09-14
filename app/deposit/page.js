"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@/app/providers";

const MIN = 2000;
const MAX = 1000000;

const QUICK = [
  { v: 2000, badge: "Hemat", emoji: "✨" },
  { v: 20000, badge: "Populer", emoji: "💫" },
  { v: 50000, badge: "Rekomen", emoji: "😎" },
  { v: 70000, badge: "Juragan", emoji: "🐯" },
  { v: 100000, badge: "Bosman", emoji: "🧑‍✈️" },
  { v: 200000, badge: "VVIP", emoji: "👑" }
];

// Semua metode QRIS yang website ini dukung. Provider yang lagi dimatikan admin
// tetap tampil di daftar (biar user tahu opsinya ada) tapi ditandai "maintenance"
// dan tidak bisa dipilih — sama seperti tampilan RumahOTP saat salah satu metode
// pembayaran mereka lagi tidak aktif.
const ALL_PROVIDERS = [
  { key: "pakasir", name: "QRIS - Pakasir", speed: "~1 menit" },
  { key: "rumahotp", name: "QRIS - RumahOTP", speed: "~20 detik" }
];

const STEPS = [
  { key: "amount", label: "Jumlah" },
  { key: "method", label: "Metode" },
  { key: "confirm", label: "Konfirmasi" }
];

function fmtCountdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return { m: String(m).padStart(2, "0"), s: String(r).padStart(2, "0") };
}

function fmtDateTime(d) {
  if (!d) return "-";
  return new Date(d).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }) + " WIB";
}

function StepDots({ current }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="mb-6 flex items-center justify-center gap-3">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                i < idx
                  ? "bg-teal text-white"
                  : i === idx
                  ? "bg-amber text-white shadow-soft"
                  : "border border-line text-muted"
              }`}
            >
              {i < idx ? "✓" : i + 1}
            </div>
            <span className={`text-[11px] font-medium ${i <= idx ? "text-ink" : "text-muted"}`}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`h-px w-8 ${i < idx ? "bg-teal" : "bg-line"}`} />}
        </div>
      ))}
    </div>
  );
}

function CountdownBoxes({ ms }) {
  const { m, s } = fmtCountdown(ms);
  return (
    <div className="flex items-center gap-1 text-sm font-semibold text-ink">
      <span className="rounded-md bg-surface2 px-2 py-1">{m}</span>
      <span>:</span>
      <span className="rounded-md bg-surface2 px-2 py-1">{s}</span>
    </div>
  );
}

export default function DepositPage() {
  const { token, balance, refreshBalance } = useUser();

  // "amount" -> "method" -> "confirm" -> "payment"
  const [step, setStep] = useState("amount");
  const [amount, setAmount] = useState("");
  const [providers, setProviders] = useState({ pakasir: true, rumahotp: false });
  const [feePercent, setFeePercent] = useState({ pakasir: 0, rumahotp: 0.7 });
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("pending");
  const [cancelling, setCancelling] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);
  const tickRef = useRef(null);

  const [voucherCode, setVoucherCode] = useState("");
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherMsg, setVoucherMsg] = useState("");
  const [voucherError, setVoucherError] = useState("");

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        const p = d.depositProviders || { pakasir: true, rumahotp: false };
        setProviders(p);
        setFeePercent(d.depositFeePercent || { pakasir: 0, rumahotp: 0.7 });
        setProvider(p.pakasir ? "pakasir" : p.rumahotp ? "rumahotp" : null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => () => clearInterval(pollRef.current), []);

  useEffect(() => {
    if (step !== "payment" || status === "completed" || status === "canceled") {
      clearInterval(tickRef.current);
      return undefined;
    }
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickRef.current);
  }, [step, status]);

  const enabledProviders = Object.entries(providers)
    .filter(([, v]) => v)
    .map(([k]) => k);

  function pickAmount(v) {
    setAmount(String(v));
    setError("");
  }

  function goToMethod(e) {
    e.preventDefault();
    setError("");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < MIN || amt > MAX) {
      setError(`Nominal harus antara Rp${MIN.toLocaleString("id-ID")} - Rp${MAX.toLocaleString("id-ID")}.`);
      return;
    }
    if (enabledProviders.length === 0) {
      setError("Belum ada metode pembayaran yang aktif. Hubungi admin.");
      return;
    }
    if (!provider || !enabledProviders.includes(provider)) {
      setProvider(enabledProviders[0]);
    }
    setStep("method");
  }

  function goToConfirm() {
    if (!provider || !enabledProviders.includes(provider)) {
      setError("Pilih salah satu metode pembayaran yang aktif dulu.");
      return;
    }
    setError("");
    setStep("confirm");
  }

  async function createDeposit() {
    if (!token) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/deposit/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, amount: Number(amount), provider })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat transaksi.");
      setOrder(data);
      setStatus("pending");
      setStep("payment");
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
          if (data.status === "canceled") {
            clearInterval(pollRef.current);
          }
        }
      } catch (e) {
        /* diamkan, coba lagi di interval berikutnya */
      }
    }, 3000);
  }

  async function checkNow() {
    if (!order) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/deposit/status?order_id=${order.orderId}&token=${token}`);
      const data = await res.json();
      if (res.ok) {
        setStatus(data.status);
        if (data.status === "completed") {
          clearInterval(pollRef.current);
          refreshBalance();
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function cancelOrder() {
    if (!order) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/deposit/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, orderId: order.orderId })
      });
      const data = await res.json();
      if (res.ok) {
        clearInterval(pollRef.current);
        setStatus("canceled");
      } else {
        setError(data.error || "Gagal membatalkan transaksi.");
      }
    } finally {
      setCancelling(false);
    }
  }

  function resetForm() {
    setOrder(null);
    setAmount("");
    setStatus("pending");
    setStep("amount");
    setError("");
    clearInterval(pollRef.current);
  }

  function copyOrderId() {
    if (!order) return;
    navigator.clipboard?.writeText(order.orderId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function downloadQr() {
    if (!order?.qrImage) return;
    const a = document.createElement("a");
    a.href = order.qrImage;
    a.download = `qris-${order.orderId}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
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

  const amt = Number(amount) || 0;
  const activeProviderMeta = ALL_PROVIDERS.find((p) => p.key === provider);
  const activeFeePercent = provider ? feePercent?.[provider] || 0 : 0;
  const estimatedFee = Math.ceil((amt * activeFeePercent) / 100);
  const estimatedTotal = amt + estimatedFee;

  const displayFee = order?.adminFee ?? (provider ? Math.ceil((Number(order?.amount || 0) * activeFeePercent) / 100) : 0);
  const displayTotal = order?.totalAmount ?? (order ? Number(order.amount) + (displayFee || 0) : 0);

  const expiredAtMs = order?.expiredAt ? new Date(order.expiredAt).getTime() : null;
  const remainingMs = expiredAtMs ? expiredAtMs - now : null;
  const isExpired = remainingMs !== null && remainingMs <= 0 && status === "pending";

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
        <div className="fade-up delay-1 card-shadow rounded-2xl border border-line bg-surface p-6">
          {step !== "payment" && <StepDots current={step} />}

          {step === "amount" && (
            <form onSubmit={goToMethod}>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-ink">Masukan Nominal</label>
                <span className="rounded-full border border-line px-2.5 py-1 text-[10px] text-muted">
                  MIN Rp{MIN.toLocaleString("id-ID")} | MAX Rp{MAX.toLocaleString("id-ID")}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {QUICK.map((q) => (
                  <button
                    type="button"
                    key={q.v}
                    onClick={() => pickAmount(q.v)}
                    className={`press flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-all duration-200 ${
                      Number(amount) === q.v
                        ? "border-amber bg-amber-soft shadow-soft"
                        : "border-line hover:border-amber/50 hover:text-ink"
                    }`}
                  >
                    <span className="text-xs font-semibold text-ink">Rp{q.v.toLocaleString("id-ID")}</span>
                    <span className="text-[10px] text-muted">
                      {q.emoji} {q.badge}
                    </span>
                  </button>
                ))}
              </div>

              <label className="mt-5 block text-sm font-medium text-ink">Atau masukan nominal lain</label>
              <div className="mt-2 flex items-center rounded-lg border border-line bg-bg px-3 transition-colors focus-within:border-amber">
                <span className="text-sm text-muted">Rp</span>
                <input
                  type="number"
                  min={MIN}
                  max={MAX}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Masukkan nominal"
                  className="w-full bg-transparent px-2 py-3 text-sm text-ink outline-none"
                />
              </div>

              <p className="mt-3 rounded-lg border border-amber/30 bg-amber-soft px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-bright">
                Biaya admin setiap metode pembayaran berbeda-beda, jadi pastikan memilih metode pembayaran yang sesuai kebutuhan kamu.
              </p>

              {error && <p className="mt-3 animate-fade-up text-sm text-rose">{error}</p>}

              <button
                type="submit"
                disabled={!token}
                className="press mt-6 w-full rounded-lg bg-amber px-5 py-3 text-sm font-medium text-white shadow-soft transition-colors hover:bg-amber-bright disabled:opacity-60"
              >
                Lanjutkan
              </button>

              <p className="mt-4 text-xs text-muted">
                Saldo kamu saat ini: <span className="font-medium text-ink">Rp{balance.toLocaleString("id-ID")}</span>
              </p>
            </form>
          )}

          {step === "method" && (
            <div>
              <div className="mb-4 flex items-center justify-between rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm">
                <span className="text-muted">Nominal</span>
                <span className="font-medium text-ink">Rp{Number(amount).toLocaleString("id-ID")}</span>
              </div>
              <p className="text-sm font-medium text-ink">Pilih Metode Pembayaran</p>
              <p className="mt-1 text-[11px] text-muted">Silahkan pilih metode untuk membayar transaksi</p>
              <div className="mt-3 space-y-2">
                {ALL_PROVIDERS.map((p) => {
                  const active = !!providers[p.key];
                  const selected = provider === p.key && active;
                  return (
                    <button
                      type="button"
                      key={p.key}
                      onClick={() => active && setProvider(p.key)}
                      disabled={!active}
                      className={`press flex w-full items-center justify-between rounded-lg border px-3.5 py-3 text-left transition-colors ${
                        !active
                          ? "cursor-not-allowed border-line opacity-50"
                          : selected
                          ? "border-amber bg-amber-soft"
                          : "border-line hover:border-amber/50"
                      }`}
                    >
                      <span>
                        <span className="flex items-center gap-2">
                          <span className="text-sm font-medium text-ink">{p.name}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              active ? "bg-surface2 text-muted" : "bg-rose-soft text-rose"
                            }`}
                          >
                            {active ? p.speed : "maintenance"}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted">
                          Biaya admin {feePercent?.[p.key] || 0}%
                        </span>
                      </span>
                      {active && (
                        <span
                          className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                            selected ? "border-amber bg-amber" : "border-line"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {error && <p className="mt-3 animate-fade-up text-sm text-rose">{error}</p>}

              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep("amount")}
                  className="press flex-1 rounded-lg border border-line px-5 py-3 text-sm text-ink transition-colors hover:border-amber/50"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={goToConfirm}
                  className="press flex-1 rounded-lg bg-amber px-5 py-3 text-sm font-medium text-white shadow-soft transition-colors hover:bg-amber-bright"
                >
                  Lanjutkan
                </button>
              </div>
            </div>
          )}

          {step === "confirm" && (
            <div>
              <p className="text-center text-sm font-medium text-ink">Konfirmasi Pembayaran</p>
              <p className="text-center text-[11px] text-muted">Periksa kembali informasi pembayaran deposit</p>

              <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm">
                <span className="text-muted">Nominal</span>
                <span className="font-medium text-ink">Rp{amt.toLocaleString("id-ID")}</span>
              </div>

              <div className="mt-3 rounded-xl border border-line bg-bg p-4">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface2 text-lg">
                  🏦
                </div>
                <p className="mt-2 text-center text-sm font-medium text-ink">Detail Pembayaran</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Metode</span>
                    <span className="font-medium text-ink">{activeProviderMeta?.name || provider}</span>
                  </div>
                  <div className="flex justify-between border-t border-line pt-3">
                    <span className="text-muted">Tanggal Transaksi</span>
                    <span className="font-medium text-ink">{fmtDateTime(new Date())}</span>
                  </div>
                  <div className="flex justify-between border-t border-line pt-3">
                    <span className="text-muted">Nominal</span>
                    <span className="font-medium text-ink">Rp{amt.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between border-t border-line pt-3">
                    <span className="text-muted">Biaya Admin</span>
                    <span className="font-medium text-ink">Rp{estimatedFee.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between border-t border-line pt-3">
                    <span className="text-muted">Total Pembayaran</span>
                    <span className="font-semibold text-amber-bright">Rp{estimatedTotal.toLocaleString("id-ID")}</span>
                  </div>
                </div>
                <p className="mt-4 text-center text-[11px] text-muted">
                  Angka biaya admin di atas estimasi — total pasti mengikuti respons resmi provider di halaman pembayaran.
                </p>
              </div>

              {error && <p className="mt-3 animate-fade-up text-sm text-rose">{error}</p>}

              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep("method")}
                  className="press flex-1 rounded-lg border border-line px-5 py-3 text-sm text-ink transition-colors hover:border-amber/50"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={createDeposit}
                  disabled={loading}
                  className="press flex-1 rounded-lg bg-amber px-5 py-3 text-sm font-medium text-white shadow-soft transition-colors hover:bg-amber-bright disabled:opacity-60"
                >
                  {loading ? "Memproses..." : "Konfirmasi"}
                </button>
              </div>
            </div>
          )}

          {step === "payment" && order && (
            <div className="scale-in">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink">Payment</p>
                {status === "pending" && (
                  <span className="flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-[11px] font-medium text-amber-bright">
                    <span className="signal-pulse h-1.5 w-1.5 rounded-full bg-amber" />
                    pending
                  </span>
                )}
                {status === "completed" && (
                  <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-medium text-success">selesai</span>
                )}
                {status === "canceled" && (
                  <span className="rounded-full bg-rose-soft px-2.5 py-1 text-[11px] font-medium text-rose">dibatalkan</span>
                )}
              </div>

              {status === "completed" ? (
                <div className="mt-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success animate-scale-in">
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
              ) : status === "canceled" ? (
                <div className="mt-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-soft text-rose">✕</div>
                  <h2 className="mt-4 font-display text-xl font-semibold text-ink">Pembayaran dibatalkan</h2>
                  <p className="mt-2 text-sm text-muted">Belum ada saldo yang terpotong untuk transaksi ini.</p>
                  <button
                    onClick={resetForm}
                    className="press mt-6 rounded-lg bg-amber px-5 py-2.5 text-sm font-medium text-white shadow-soft transition-colors hover:bg-amber-bright"
                  >
                    Buat transaksi baru
                  </button>
                </div>
              ) : (
                <div>
                  <div className="mt-4 rounded-xl border border-line bg-bg p-5 text-center">
                    <p className="text-xs uppercase tracking-wide text-muted">Total pembayaran</p>
                    <p className="mt-1 font-display text-2xl font-semibold text-ink">
                      Rp{Number(displayTotal || order.amount).toLocaleString("id-ID")}
                    </p>

                    {order.qrImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={order.qrImage}
                        alt="Kode QRIS pembayaran"
                        className="mx-auto mt-4 h-56 w-56 rounded-lg bg-white p-2 shadow-soft"
                      />
                    ) : order.paymentUrl ? (
                      <a
                        href={order.paymentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="press mt-4 inline-block rounded-lg bg-amber px-5 py-3 text-sm font-medium text-white shadow-soft"
                      >
                        Buka halaman pembayaran
                      </a>
                    ) : (
                      <p className="mt-4 text-sm text-rose">QR tidak tersedia, coba buat ulang transaksi.</p>
                    )}
                    <p className="mt-2 text-[11px] text-muted">Scan dengan aplikasi m-banking / e-wallet</p>

                    <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-left">
                      {isExpired ? (
                        <p className="text-xs font-medium text-rose">QRIS sudah kedaluwarsa, buat transaksi baru.</p>
                      ) : (
                        <div>
                          <p className="text-[11px] text-muted">Payment berakhir pada</p>
                          <p className="text-xs font-medium text-ink">{fmtDateTime(order.expiredAt)}</p>
                        </div>
                      )}
                      {remainingMs !== null && !isExpired && <CountdownBoxes ms={remainingMs} />}
                    </div>
                  </div>

                  {error && <p className="mt-3 text-sm text-rose">{error}</p>}

                  <button
                    type="button"
                    onClick={checkNow}
                    disabled={loading || isExpired}
                    className="press mt-4 w-full rounded-lg bg-amber px-5 py-3 text-sm font-medium text-white shadow-soft transition-colors hover:bg-amber-bright disabled:opacity-60"
                  >
                    {loading ? "Mengecek..." : "Saya sudah membayar"}
                  </button>

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={downloadQr}
                      disabled={!order.qrImage}
                      className="press flex-1 rounded-lg border border-line px-5 py-2.5 text-sm text-ink transition-colors hover:border-amber/50 disabled:opacity-50"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={cancelOrder}
                      disabled={cancelling || isExpired}
                      className="press flex-1 rounded-lg border border-rose/40 px-5 py-2.5 text-sm font-medium text-rose transition-colors hover:bg-rose-soft disabled:opacity-60"
                    >
                      {cancelling ? "Membatalkan..." : "Batalkan"}
                    </button>
                  </div>
                  <p className="mt-3 text-center text-[10px] leading-relaxed text-muted">
                    Jangan membatalkan apabila sudah membayar karena mengganggu proses pengecekan, dan jangan membayar apabila sudah
                    dibatalkan atau expired.
                  </p>

                  {isExpired && (
                    <button onClick={resetForm} className="underline-grow mt-3 block text-center text-xs text-muted hover:text-ink">
                      Buat transaksi baru
                    </button>
                  )}

                  <div className="mt-5 rounded-xl border border-line bg-surface2 p-4">
                    <p className="text-sm font-medium text-ink">Detail Pembayaran</p>
                    <div className="mt-3 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Payment ID</span>
                        <span className="flex items-center gap-1.5 font-medium text-ink">
                          {order.orderId}
                          <button type="button" onClick={copyOrderId} className="text-muted hover:text-ink" aria-label="Salin Payment ID">
                            {copied ? "✓" : "⧉"}
                          </button>
                        </span>
                      </div>
                      {order.providerRef && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted">Kode Referensi</span>
                          <span className="font-medium text-ink">{order.providerRef}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t border-line pt-2.5">
                        <span className="text-muted">Metode</span>
                        <span className="font-medium text-ink">{ALL_PROVIDERS.find((p) => p.key === order.provider)?.name || order.provider}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-line pt-2.5">
                        <span className="text-muted">Nominal</span>
                        <span className="font-medium text-ink">Rp{Number(order.amount).toLocaleString("id-ID")}</span>
                      </div>
                      {displayFee ? (
                        <div className="flex items-center justify-between border-t border-line pt-2.5">
                          <span className="text-muted">Biaya Admin</span>
                          <span className="font-medium text-ink">Rp{Number(displayFee).toLocaleString("id-ID")}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between border-t border-line pt-2.5">
                        <span className="text-muted">Diterbitkan Oleh</span>
                        <span className="font-medium text-ink">Artapedia</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

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
