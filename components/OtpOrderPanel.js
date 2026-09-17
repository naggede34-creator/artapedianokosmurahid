"use client";

import { useEffect, useRef, useState } from "react";

const CANCEL_COOLDOWN_MS = 3 * 60 * 1000;

function fmtCountdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

const STATUS_LABEL = {
  pending: "Menunggu kode",
  completed: "Kode diterima",
  received: "Kode diterima",
  done: "Kode diterima",
  canceled: "Dibatalkan",
  expired: "Kedaluwarsa"
};

export default function OtpOrderPanel({ order, token, onClose, onChanged, onBuyAgain, refreshSignal }) {
  // activeOrder disimpan sebagai state (bukan langsung pakai prop order) supaya setelah
  // "Ganti Nomor" berhasil, panel ini bisa langsung menampilkan nomor baru tanpa perlu
  // ditutup-buka lagi.
  const [activeOrder, setActiveOrder] = useState(order);
  const [status, setStatus] = useState({
    status: order.status || "pending",
    otpCode: order.otpCode || null,
    otpMsg: order.otpMsg || null
  });
  const [refunded, setRefunded] = useState(Boolean(order.refunded));
  const [now, setNow] = useState(Date.now());
  const [cancelling, setCancelling] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const pollRef = useRef(null);
  const tickRef = useRef(null);

  const isFinal = ["completed", "received", "done", "canceled", "expired"].includes(status.status);

  async function fetchStatus() {
    try {
      const res = await fetch(`/api/otp/status?order_id=${activeOrder.orderId}&token=${token}`);
      const data = await res.json();
      if (res.ok) {
        setStatus({ status: data.status, otpCode: data.otpCode, otpMsg: data.otpMsg });
        setRefunded(Boolean(data.refunded));
        if (["completed", "received", "done", "canceled", "expired"].includes(data.status)) {
          clearInterval(pollRef.current);
          onChanged?.();
        }
      }
    } catch (e) {
      /* coba lagi di interval berikutnya */
    }
  }

  useEffect(() => {
    if (isFinal) return undefined;
    pollRef.current = setInterval(fetchStatus, 4000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder.orderId, token, isFinal]);

  // Tombol refresh manual di luar (header "Pesanan Pending") memicu fetch status seketika.
  useEffect(() => {
    if (refreshSignal === undefined) return;
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  const createdAtMs = new Date(activeOrder.createdAt).getTime();
  const cooldownRemaining = CANCEL_COOLDOWN_MS - (now - createdAtMs);
  const canCancel = !isFinal && !status.otpCode && cooldownRemaining <= 0;
  const canReplace = status.status === "expired" && !status.otpCode && !refunded;
  const expiresMs = activeOrder.expiredAt ? new Date(activeOrder.expiredAt).getTime() - now : null;

  function copy(value, label) {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(""), 1200);
  }

  async function cancelOrder() {
    setError("");
    setCancelling(true);
    try {
      const res = await fetch("/api/otp/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, orderId: activeOrder.orderId })
      });
      const data = await res.json();
      if (res.ok) {
        clearInterval(pollRef.current);
        setStatus({ status: "canceled", otpCode: null });
        setRefunded(true);
        onChanged?.();
      } else if (res.status === 409 && data.otpCode) {
        clearInterval(pollRef.current);
        setStatus({ status: "done", otpCode: data.otpCode, otpMsg: null });
        onChanged?.();
      } else {
        setError(data.error || "Gagal membatalkan pesanan.");
      }
    } catch (e) {
      setError("Koneksi terputus. Coba lagi.");
    } finally {
      setCancelling(false);
    }
  }

  async function replaceNumber() {
    setError("");
    setReplacing(true);
    try {
      const res = await fetch("/api/otp/replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, orderId: activeOrder.orderId })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mengganti nomor.");
        return;
      }
      setRefunded(true);
      if (data.replaced) {
        // Ganti panel ini jadi menampilkan pesanan baru, seolah baru saja dibeli lagi.
        setActiveOrder({
          orderId: data.orderId,
          phoneNumber: data.phoneNumber,
          price: data.price,
          createdAt: data.createdAt,
          serviceName: activeOrder.serviceName,
          countryName: activeOrder.countryName
        });
        setStatus({ status: "pending", otpCode: null, otpMsg: null });
        setRefunded(false);
        setNow(Date.now());
      } else {
        // Provider tidak ada stok pengganti -> saldo sudah dikembalikan penuh.
        setError(data.message || "Saldo sudah dikembalikan.");
      }
      onChanged?.();
    } finally {
      setReplacing(false);
    }
  }

  return (
    <div className="scale-in card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-bold text-ink">{activeOrder.serviceName}</p>
          <p className="mt-0.5 text-xs text-muted">
            {activeOrder.countryName} · Order #{activeOrder.orderId}
            {activeOrder.price ? ` · Rp${Number(activeOrder.price).toLocaleString("id-ID")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={status.status} />
          {onClose && (
            <button onClick={onClose} className="press rounded-md p-1 text-muted transition-colors hover:text-ink" aria-label="Tutup">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface2 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">Nomor</p>
          <button onClick={() => copy(activeOrder.phoneNumber, "nomor")} className="underline-grow text-xs font-medium text-teal-bright">
            {copied === "nomor" ? "Tersalin" : "Salin"}
          </button>
        </div>
        <p className="mt-1 font-mono text-xl font-semibold tracking-wide text-ink sm:text-2xl">{activeOrder.phoneNumber}</p>
      </div>

      <div className="mt-3 rounded-xl border border-line bg-bg p-4">
        {status.otpCode ? (
          <div className="code-reveal">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-teal-bright">Kode OTP diterima</p>
              <button onClick={() => copy(status.otpCode, "kode")} className="underline-grow text-xs font-medium text-teal-bright">
                {copied === "kode" ? "Tersalin" : "Salin"}
              </button>
            </div>
            <p className="mt-1 font-mono text-4xl font-semibold tracking-[0.25em] text-ink">{status.otpCode}</p>
            {status.otpMsg && <p className="mt-2 text-xs text-muted">{status.otpMsg}</p>}
          </div>
        ) : status.status === "canceled" ? (
          <p className="text-sm text-rose">Pesanan dibatalkan, saldo sudah dikembalikan.</p>
        ) : status.status === "expired" ? (
          <p className="text-sm text-rose">
            {refunded ? "Pesanan kedaluwarsa. Saldo sudah dikembalikan." : "Pesanan kedaluwarsa sebelum kode masuk."}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-sm font-medium text-teal-bright">
            <span className="signal-pulse h-2 w-2 rounded-full bg-amber" />
            <span className="text-ink">Menunggu kode OTP masuk…</span>
            {expiresMs !== null && expiresMs > 0 && (
              <span className="ml-auto font-mono text-xs text-muted">sisa {fmtCountdown(expiresMs)}</span>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-rose">{error}</p>}

      <div className="mt-5 flex flex-wrap gap-2.5">
        {onBuyAgain && (
          <button
            onClick={onBuyAgain}
            className="btn-3d flex-1 rounded-lg border border-amber/40 px-5 py-2.5 text-sm font-medium text-amber-bright transition-colors hover:bg-amber-soft sm:flex-none"
          >
            Beli lagi
          </button>
        )}
        {canReplace && (
          <button
            onClick={replaceNumber}
            disabled={replacing}
            className="btn-3d flex-1 rounded-lg border border-teal/40 px-5 py-2.5 text-sm font-medium text-teal-bright transition-colors hover:bg-teal-soft disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
          >
            {replacing ? "Memproses..." : "Ganti Nomor"}
          </button>
        )}
        {!isFinal && !status.otpCode && (
          <button
            onClick={cancelOrder}
            disabled={!canCancel || cancelling}
            className="btn-3d flex-1 rounded-lg border border-rose/40 px-5 py-2.5 text-sm text-rose transition-colors hover:border-rose hover:bg-rose-soft disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
          >
            {cancelling ? "Membatalkan..." : "Batal"}
          </button>
        )}
      </div>
      {!isFinal && !status.otpCode && !canCancel && (
        <p className="mt-1.5 text-xs text-muted">Tunggu {fmtCountdown(cooldownRemaining)} sebelum klik batal.</p>
      )}
      {canReplace && (
        <p className="mt-1.5 text-xs text-muted">Nomor lama tidak dapat kode. Ganti nomor tidak potong saldo lagi.</p>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    pending: "border-amber/40 text-amber-bright bg-amber-soft",
    completed: "border-teal/40 text-teal-bright bg-teal-soft",
    received: "border-teal/40 text-teal-bright bg-teal-soft",
    done: "border-teal/40 text-teal-bright bg-teal-soft",
    canceled: "border-rose/30 text-rose bg-rose-soft",
    expired: "border-rose/30 text-rose bg-rose-soft"
  };
  const cls = map[status] || "border-line text-muted bg-surface2";
  return <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>{STATUS_LABEL[status] || status}</span>;
}
