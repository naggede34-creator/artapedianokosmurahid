"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/app/providers";
import { DEPOSIT_PROVIDERS, providerName } from "@/lib/paymentProviders";
import { PageHeader, Icon, Alert, Row, CopyButton, Spinner, Badge, rupiah, fmtWIB } from "@/components/ui";
import ScratchCard from "@/components/ScratchCard";

const QUICK = [10000, 20000, 50000, 100000, 200000, 500000];
const FINAL = ["completed", "canceled", "expired", "failed"];

function countdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function DepositPage() {
  const { token, balance, refreshBalance } = useUser();

  // Nama, label, keterangan, dan estimasi waktu metode deposit datang dari
  // pengaturan admin. DEPOSIT_PROVIDERS hanya cadangan sebelum API menjawab.
  const [methods, setMethods] = useState(() =>
    DEPOSIT_PROVIDERS.map((p) => ({ key: p.key, name: p.name, badge: "", desc: p.desc, speed: p.speed }))
  );
  const [cfg, setCfg] = useState({
    providers: { warungnokos: false, pakasir: true, rumahotp: false },
    fees: { warungnokos: 0, pakasir: 0, rumahotp: 0.7 },
    min: 2000,
    max: 1000000
  });
  const [step, setStep] = useState("amount"); // amount | method | payment
  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState(null);
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("pending");
  const [cashback, setCashback] = useState(0);
  const [scratchOpen, setScratchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const pollRef = useRef(null);

  // Biaya pasti dari Pakasir untuk nominal yang sedang dipilih; null = belum/gagal.
  const [exactFee, setExactFee] = useState(null);

  const [voucher, setVoucher] = useState("");
  const [voucherBusy, setVoucherBusy] = useState(false);
  const [voucherMsg, setVoucherMsg] = useState(null);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => {
        const providers = d.depositProviders || {};
        setCfg({
          providers,
          fees: d.depositFeePercent || {},
          min: d.depositMin || 2000,
          max: d.depositMax || 1000000
        });
        if (Array.isArray(d.depositMethods) && d.depositMethods.length) setMethods(d.depositMethods);
        const first = DEPOSIT_PROVIDERS.find((p) => providers[p.key]);
        setProvider(first ? first.key : null);
      })
      .catch(() => {});
  }, []);

  const pollStatus = useCallback(
    async (orderId) => {
      if (!token || !orderId) return null;
      try {
        const res = await fetch(`/api/deposit/status?order_id=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) return null;
        setStatus(data.status);
        if (data.cashback) setCashback(data.cashback);
        if (FINAL.includes(data.status)) {
          clearInterval(pollRef.current);
          if (data.status === "completed") {
            refreshBalance();
            // Issue a scratch card for this deposit
            fetch("/api/scratch-card", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, action: "issue", depositId: orderId }),
            }).then(() => setScratchOpen(true)).catch(() => {});
          }
        }
        return data.status;
      } catch {
        return null;
      }
    },
    [token, refreshBalance]
  );

  const startPolling = useCallback(
    (orderId) => {
      clearInterval(pollRef.current);
      pollRef.current = setInterval(() => pollStatus(orderId), 4000);
    },
    [pollStatus]
  );

  // Pulihkan QRIS yang masih aktif kalau halaman di-refresh.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!token || restoredRef.current) return;
    restoredRef.current = true;
    const wanted = new URLSearchParams(window.location.search).get("order");
    fetch(`/api/deposit/detail?token=${encodeURIComponent(token)}${wanted ? `&order_id=${encodeURIComponent(wanted)}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.item && d.item.status === "pending") {
          setOrder(d.item);
          setStatus("pending");
          setStep("payment");
          startPolling(d.item.orderId);
        }
      })
      .catch(() => {});
  }, [token, startPolling]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  useEffect(() => {
    if (step !== "payment" || FINAL.includes(status)) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step, status]);

  const amt = Math.floor(Number(amount) || 0);
  // Nama metode yang dipakai di ringkasan & layar sukses — ikut nama dari admin.
  const methodName = (key) => methods.find((m) => m.key === key)?.name || providerName(key);
  const enabled = DEPOSIT_PROVIDERS.filter((p) => cfg.providers?.[p.key]);

  // Tanya biaya pasti ke Pakasir begitu user berhenti mengetik nominal.
  useEffect(() => {
    if (provider !== "pakasir" || !amt || amt < cfg.min) {
      setExactFee(null);
      return undefined;
    }
    let alive = true;
    const t = setTimeout(() => {
      fetch(`/api/deposit/fee?amount=${amt}`)
        .then((r) => r.json())
        .then((d) => {
          if (alive) setExactFee(Number.isFinite(Number(d?.pakasir)) ? Number(d.pakasir) : null);
        })
        .catch(() => {
          if (alive) setExactFee(null);
        });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [provider, amt, cfg.min]);

  function toMethod(e) {
    e.preventDefault();
    setError("");
    if (!amt || amt < cfg.min || amt > cfg.max) {
      setError(`Nominal harus antara ${rupiah(cfg.min)} dan ${rupiah(cfg.max)}.`);
      return;
    }
    if (!enabled.length) {
      setError("Semua metode pembayaran sedang nonaktif. Coba lagi nanti atau hubungi admin.");
      return;
    }
    if (!provider || !cfg.providers[provider]) setProvider(enabled[0].key);
    setStep("method");
  }

  async function createDeposit() {
    if (!token || !provider) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/deposit/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, amount: amt, provider })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat QRIS.");
      setOrder(data);
      setStatus("pending");
      setCashback(0);
      setStep("payment");
      startPolling(data.orderId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function checkNow() {
    if (!order) return;
    setChecking(true);
    const s = await pollStatus(order.orderId);
    setChecking(false);
    if (s === "pending") setError("Pembayaran belum terdeteksi. Tunggu beberapa detik lalu cek lagi.");
    else setError("");
  }

  async function cancelOrder() {
    if (!order) return;
    if (!window.confirm("Batalkan QRIS ini? Jangan batalkan kalau kamu sudah membayar.")) return;
    setCancelling(true);
    setError("");
    try {
      const res = await fetch("/api/deposit/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, orderId: order.orderId })
      });
      const data = await res.json();
      if (res.ok) {
        clearInterval(pollRef.current);
        setStatus(data.status || "canceled");
      } else if (data.status === "completed") {
        clearInterval(pollRef.current);
        setStatus("completed");
        refreshBalance();
      } else {
        setError(data.error || "Gagal membatalkan.");
      }
    } catch {
      setError("Koneksi terputus. Coba lagi.");
    } finally {
      setCancelling(false);
    }
  }

  function reset() {
    clearInterval(pollRef.current);
    setOrder(null);
    setStatus("pending");
    setAmount("");
    setError("");
    setStep("amount");
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
    if (!voucher.trim() || !token) return;
    setVoucherBusy(true);
    setVoucherMsg(null);
    try {
      const res = await fetch("/api/voucher/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code: voucher.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Voucher gagal diklaim.");
      setVoucherMsg({ ok: true, text: `${rupiah(data.amount)} masuk ke saldo kamu.` });
      setVoucher("");
      refreshBalance();
    } catch (err) {
      setVoucherMsg({ ok: false, text: err.message });
    } finally {
      setVoucherBusy(false);
    }
  }

  const feePct = provider ? Number(cfg.fees?.[provider] || 0) : 0;
  // Untuk Pakasir, biaya pastinya bisa ditanya langsung ke API penghitung biaya
  // mereka. Kalau gagal, jatuh ke estimasi persen dari pengaturan admin.
  const estFee = provider === "pakasir" && exactFee != null ? exactFee : Math.ceil((amt * feePct) / 100);
  const feeIsExact = provider === "pakasir" && exactFee != null;
  const expiresIn = order?.expiredAt ? new Date(order.expiredAt).getTime() - now : null;
  const timeUp = status === "pending" && expiresIn !== null && expiresIn <= 0;
  const payTotal = order ? Number(order.totalAmount || order.amount) : 0;
  const stepIndex = { amount: 0, method: 1, payment: 2 }[step];

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <PageHeader
        icon={<Icon.qris />}
        title="Isi saldo"
        desc={`Bayar pakai QRIS dari e-wallet atau m-banking apa pun. Minimal ${rupiah(cfg.min)}, maksimal ${rupiah(cfg.max)} per transaksi.`}
      />

      {/* items-start: tanpa ini panel langkah ikut diregangkan setinggi kolom
          kanan, dan di langkah pertama yang isinya pendek jadi ada ruang
          kosong sepanjang layar di bawah tombolnya. */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="manga-card manga-rush halftone hd-paper anim-drop p-5 sm:p-6">
          <ol className="mb-6 flex items-center gap-2 text-xs font-semibold" aria-label="Langkah deposit">
            {["Nominal", "Metode", "Bayar"].map((label, i) => (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  data-state={i < stepIndex ? "done" : i === stepIndex ? "now" : "next"}
                  className={`step-dot-3d flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                    i <= stepIndex ? "text-white" : "bg-surface2 text-muted"
                  }`}
                >
                  {i < stepIndex ? "✓" : i + 1}
                </span>
                <span className={i === stepIndex ? "text-ink" : "text-muted"}>{label}</span>
                {i < 2 && (
                  <span
                    className={`h-1 flex-1 rounded-full ${i < stepIndex ? "bg-success" : "bg-line"}`}
                  />
                )}
              </li>
            ))}
          </ol>

          {step === "amount" && (
            <form onSubmit={toMethod}>
              <label className="label" htmlFor="amount">
                Mau isi berapa?
              </label>
              <div className="field-3d flex items-center px-4">
                <span className="text-lg font-extrabold text-amber-bright">Rp</span>
                <input
                  id="amount"
                  inputMode="numeric"
                  autoComplete="off"
                  value={amount ? Number(amount).toLocaleString("id-ID") : ""}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="0"
                  className="w-full bg-transparent px-2 py-4 text-2xl font-extrabold tabular-nums text-ink outline-none placeholder:text-muted/40"
                />
              </div>
              <div className="anim-stagger mt-3 grid grid-cols-3 gap-2">
                {QUICK.filter((v) => v >= cfg.min && v <= cfg.max).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(String(v))}
                    data-on={amt === v}
                    className={`chip-3d px-2 py-2.5 text-sm font-extrabold tabular-nums ${
                      amt === v ? "text-amber-bright" : "text-ink"
                    }`}
                  >
                    {rupiah(v)}
                  </button>
                ))}
              </div>

              {error && <Alert className="mt-4">{error}</Alert>}

              <button type="submit" disabled={!token} className="btn-primary anim-sheen mt-6 w-full">
                Pilih metode pembayaran
              </button>
              <p className="mt-3 text-center text-xs text-muted">
                Saldo sekarang <span className="font-bold tabular-nums text-ink">{rupiah(balance)}</span>
              </p>
            </form>
          )}

          {step === "method" && (
            <div>
              <div className="panel-3d flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted">Nominal deposit</span>
                <button type="button" onClick={() => setStep("amount")} className="text-right">
                  <span className="block text-lg font-extrabold tabular-nums text-ink">{rupiah(amt)}</span>
                  <span className="block text-[11px] font-semibold text-amber-bright">Ubah</span>
                </button>
              </div>

              <p className="label mt-5">Bayar pakai QRIS mana?</p>
              <div className="anim-stagger space-y-2" role="radiogroup">
                {methods.map((p) => {
                  const on = !!cfg.providers?.[p.key];
                  const selected = provider === p.key && on;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!on}
                      onClick={() => setProvider(p.key)}
                      data-on={selected}
                      className="pick-3d flex w-full items-center gap-3 p-3.5 text-left"
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform ${
                          selected ? "scale-105 bg-amber text-white shadow-[0_3px_0_rgb(var(--c-orange-bright))]" : "bg-surface2 text-ink"
                        }`}
                      >
                        <Icon.qris />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold text-ink">{p.name}</span>
                          {/* Label bebas dari admin, mis. "TERCEPAT" atau "PALING LARIS". */}
                          {on && p.badge ? <span className="comic-burst">{p.badge}</span> : null}
                          {on ? (
                            p.speed ? <Badge tone="gray">{p.speed}</Badge> : null
                          ) : (
                            <Badge tone="red">nonaktif</Badge>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {p.desc}
                          {Number(cfg.fees?.[p.key] || 0) > 0 ? ` Biaya admin ${Number(cfg.fees[p.key])}%.` : ""}
                        </span>
                      </span>
                      <span
                        className={`h-5 w-5 shrink-0 rounded-full border-2 ${
                          selected ? "border-amber bg-amber shadow-[inset_0_0_0_3px_rgb(var(--c-surface))]" : "border-line"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="panel-3d mt-5 divide-y divide-line px-4">
                <Row label="Metode">{methodName(provider)}</Row>
                <Row label="Saldo masuk">{rupiah(amt)}</Row>
                <Row label={feeIsExact ? "Biaya admin" : "Perkiraan biaya admin"}>{rupiah(estFee)}</Row>
                <Row label={feeIsExact ? "Total bayar" : "Perkiraan total bayar"} strong>
                  {rupiah(amt + estFee)}
                </Row>
              </div>
              <p className="mt-2 text-[11px] text-muted">
                {feeIsExact
                  ? "Biaya ini diambil langsung dari Pakasir, jadi sudah angka pasti."
                  : "Total pasti tampil di layar pembayaran setelah QRIS dibuat."}
              </p>

              {error && <Alert className="mt-4">{error}</Alert>}

              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setStep("amount")} className="btn-ghost flex-1">
                  Kembali
                </button>
                <button type="button" onClick={createDeposit} disabled={loading || !provider} className="btn-primary flex-[2]">
                  {loading ? <Spinner /> : null}
                  {loading ? "Membuat QRIS…" : "Buat QRIS"}
                </button>
              </div>
            </div>
          )}

          {step === "payment" && order && (
            <div className="scale-in">
              {status === "completed" ? (
                <div className="py-6 text-center">
                  {scratchOpen && token && (
                    <ScratchCard token={token} onClose={() => setScratchOpen(false)} onClaimed={() => refreshBalance()} />
                  )}
                  <span className="bounce-in mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success shadow-[0_4px_0_rgb(var(--c-success)/0.35)]">
                    <Icon.check width={30} height={30} />
                  </span>
                  <h2 className="mt-4 text-xl font-extrabold text-ink">Saldo masuk {rupiah(order.amount)}</h2>
                  {cashback > 0 && <p className="mt-1 text-sm font-semibold text-success">+ cashback {rupiah(cashback)}</p>}
                  <p className="mt-2 text-sm text-muted">Pembayaran via {methodName(order.provider)} sudah terkonfirmasi.</p>
                  <button onClick={() => setScratchOpen(true)} className="mt-4 flex items-center gap-2 mx-auto rounded-2xl border-2 border-amber/60 bg-amber/10 px-5 py-2.5 text-sm font-extrabold text-amber-bright press animate-pulse hover:animate-none hover:bg-amber/20">
                    🎫 Buka Kartu Gores Kamu!
                  </button>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <Link href="/otp" className="btn-primary">
                      Beli nokos
                    </Link>
                    <button onClick={reset} className="btn-ghost">
                      Isi lagi
                    </button>
                  </div>
                </div>
              ) : FINAL.includes(status) || timeUp ? (
                <div className="py-6 text-center">
                  <span className="bounce-in mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-soft text-rose shadow-[0_4px_0_rgb(var(--c-danger)/0.3)]">
                    <Icon.x width={28} height={28} />
                  </span>
                  <h2 className="mt-4 text-xl font-extrabold text-ink">
                    {status === "canceled" ? "QRIS dibatalkan" : status === "failed" ? "Pembayaran gagal" : "QRIS kedaluwarsa"}
                  </h2>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
                    Tidak ada saldo yang terpotong. Kalau kamu sempat membayar, saldo tetap masuk otomatis dalam beberapa menit.
                  </p>
                  <button onClick={reset} className="btn-primary mt-6">
                    Buat QRIS baru
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between">
                    <Badge tone="blue" pulse>
                      Menunggu pembayaran
                    </Badge>
                    {expiresIn !== null && (
                      <span className="font-mono text-sm font-semibold tabular-nums text-ink" aria-label="Sisa waktu">
                        {countdown(expiresIn)}
                      </span>
                    )}
                  </div>

                  <div className="panel-3d glow-3d mt-4 p-5 text-center">
                    <p className="text-xs font-semibold text-muted">Total yang harus dibayar</p>
                    <div className="mt-1 flex items-center justify-center gap-1">
                      <p className="text-3xl font-extrabold tabular-nums tracking-tight text-ink">{rupiah(payTotal)}</p>
                      <CopyButton value={payTotal} label="" />
                    </div>
                    {payTotal !== Number(order.amount) && (
                      <p className="mt-1 text-xs text-warn">Bayar persis sesuai nominal ini supaya terdeteksi otomatis.</p>
                    )}
                    {order.qrImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={order.qrImage}
                        alt="Kode QRIS pembayaran"
                        className="mx-auto mt-4 aspect-square w-full max-w-[260px] rounded-2xl bg-white p-3 shadow-soft"
                      />
                    ) : order.paymentUrl ? (
                      <a href={order.paymentUrl} target="_blank" rel="noreferrer" className="btn-primary mt-4">
                        Buka halaman pembayaran
                      </a>
                    ) : (
                      <Alert className="mt-4">QR tidak tersedia. Batalkan lalu buat ulang.</Alert>
                    )}
                    <p className="mt-3 text-xs text-muted">
                      Scan dengan GoPay, OVO, DANA, ShopeePay, LinkAja, atau m-banking. Berlaku sampai {fmtWIB(order.expiredAt)}.
                    </p>
                  </div>

                  {error && (
                    <Alert tone="amber" className="mt-4">
                      {error}
                    </Alert>
                  )}

                  <button type="button" onClick={checkNow} disabled={checking} className="btn-primary mt-4 w-full">
                    {checking ? <Spinner /> : null}
                    {checking ? "Mengecek…" : "Saya sudah bayar"}
                  </button>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" onClick={downloadQr} disabled={!order.qrImage} className="btn-ghost">
                      Simpan QR
                    </button>
                    <button type="button" onClick={cancelOrder} disabled={cancelling} className="btn-danger">
                      {cancelling ? "Membatalkan…" : "Batalkan"}
                    </button>
                  </div>
                  <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
                    Status dicek otomatis tiap beberapa detik. Jangan membatalkan kalau sudah membayar.
                  </p>

                  <div className="mt-5 divide-y divide-line rounded-2xl border border-line px-4">
                    <Row label="Metode">{methodName(order.provider)}</Row>
                    <Row label="ID deposit">
                      <span className="inline-flex items-center gap-1 font-mono text-xs">
                        {order.orderId}
                        <CopyButton value={order.orderId} label="" />
                      </span>
                    </Row>
                    {order.providerRef && (
                      <Row label="Ref provider">
                        <span className="font-mono text-xs">{order.providerRef}</span>
                      </Row>
                    )}
                    <Row label="Saldo masuk">{rupiah(order.amount)}</Row>
                    {order.adminFee ? <Row label="Biaya admin">{rupiah(order.adminFee)}</Row> : null}
                    <Row label="Total bayar" strong>
                      {rupiah(payTotal)}
                    </Row>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="panel-3d p-5">
            <h2 className="title-3d text-base font-extrabold text-ink">Punya kode voucher?</h2>
            <p className="mt-1 text-xs text-muted">Tukar kode voucher jadi saldo gratis.</p>
            <form onSubmit={redeemVoucher} className="mt-3 flex gap-2">
              <input
                value={voucher}
                onChange={(e) => setVoucher(e.target.value.toUpperCase())}
                placeholder="ARTA-XXXXXX"
                className="field min-w-0 flex-1 font-mono uppercase"
                aria-label="Kode voucher"
              />
              <button type="submit" disabled={voucherBusy || !token || !voucher.trim()} className="btn-dark shrink-0 px-4">
                {voucherBusy ? <Spinner /> : "Klaim"}
              </button>
            </form>
            {voucherMsg && (
              <Alert tone={voucherMsg.ok ? "green" : "red"} className="mt-3">
                {voucherMsg.text}
              </Alert>
            )}
          </div>

          <div className="panel-3d p-5">
            <h2 className="title-3d text-base font-extrabold text-ink">🎁 Bonus Deposit</h2>
            <p className="mt-1 text-xs text-muted">Semakin besar deposit, semakin besar bonusnya!</p>
            <div className="mt-3 space-y-2">
              {[
                { min: 10000, max: 49999, bonus: "2%", color: "bg-surface2 text-muted" },
                { min: 50000, max: 99999, bonus: "3%", color: "bg-teal-soft text-teal-bright" },
                { min: 100000, max: 199999, bonus: "5%", color: "bg-amber-soft text-amber-bright" },
                { min: 200000, max: null, bonus: "7%", color: "bg-rose-soft text-rose" }
              ].map((tier) => {
                const active = amt >= tier.min && (tier.max === null || amt <= tier.max);
                return (
                  <div
                    key={tier.min}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                      active
                        ? `${tier.color} scale-[1.03] shadow-[0_3px_0_rgb(var(--c-orange)/0.35)] ring-2 ring-amber/50 ring-offset-1`
                        : "bg-surface2 text-muted opacity-70"
                    }`}
                  >
                    <span>
                      {rupiah(tier.min)}{tier.max ? ` – ${rupiah(tier.max)}` : "+"}
                    </span>
                    <span className={`font-extrabold ${active ? "" : "text-muted"}`}>+{tier.bonus} bonus</span>
                    {active && <span className="text-[10px] bg-amber text-white px-1.5 py-0.5 rounded-full">✓ Aktif</span>}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted">*Bonus berupa cashback poin yang langsung masuk ke akunmu.</p>
          </div>

          <div className="card-flat p-5">
            <h2 className="text-base font-bold text-ink">Perlu diketahui</h2>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-relaxed text-muted">
              <li>Saldo masuk otomatis setelah QRIS dibayar, biasanya dalam hitungan detik.</li>
              <li>Saldo hanya bisa dipakai di Artapedia dan tidak bisa ditarik tunai.</li>
              <li>QRIS kedaluwarsa? Buat yang baru — belum ada saldo yang terpotong.</li>
              <li>
                Status semua deposit ada di{" "}
                <Link href="/riwayat?tab=deposit" className="font-semibold text-amber-bright">
                  Riwayat
                </Link>
                .
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
