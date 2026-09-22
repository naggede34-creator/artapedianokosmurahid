"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/app/providers";
import OtpOrderPanel from "@/components/OtpOrderPanel";
import { PageHeader, Icon, Badge, EmptyState, Segmented, statusTone, rupiah, fmtWIB, Row, CopyButton } from "@/components/ui";
import { DEPOSIT_STATUS_LABEL, providerName } from "@/lib/paymentProviders";

const OTP_LABEL = {
  pending: "Menunggu kode",
  done: "Kode diterima",
  canceled: "Dibatalkan",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
  refunded: "Direfund"
};

function toCsv(rows, headers) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.map((h) => esc(h.label)).join(","), ...rows.map((r) => headers.map((h) => esc(r[h.key])).join(","))].join("\n");
}

function downloadCsv(filename, csv) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function RiwayatPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-content px-5 py-10 text-sm text-muted">Memuat…</div>}>
      <RiwayatInner />
    </Suspense>
  );
}

function RiwayatInner() {
  const { token, refreshBalance } = useUser();
  const params = useSearchParams();
  const initialTab = ["otp", "deposit"].includes(params.get("tab")) ? params.get("tab") : "otp";
  const [tab, setTab] = useState(initialTab);
  const [otp, setOtp] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openOrder, setOpenOrder] = useState(null);
  const [openDeposit, setOpenDeposit] = useState(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const t = encodeURIComponent(token);
    Promise.all([
      fetch(`/api/otp/history?token=${t}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/deposit/history?token=${t}`).then((r) => r.json()).catch(() => ({}))
    ])
      .then(([o, d]) => {
        setOtp(o.items || []);
        setDeposits(d.items || []);
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => load(), [load]);
  useEffect(() => setSearch(""), [tab]);

  const q = search.trim().toLowerCase();
  const fOtp = useMemo(
    () => otp.filter((o) => !q || `${o.serviceName} ${o.countryName} ${o.phoneNumber} ${o.orderId}`.toLowerCase().includes(q)),
    [otp, q]
  );
  const fDep = useMemo(
    () => deposits.filter((d) => !q || `${d.orderId} ${d.providerRef || ""} ${providerName(d.provider)}`.toLowerCase().includes(q)),
    [deposits, q]
  );

  function exportCsv() {
    if (tab === "otp") {
      downloadCsv(
        `riwayat-nokos-${Date.now()}.csv`,
        toCsv(fOtp, [
          { key: "orderId", label: "Order" },
          { key: "serviceName", label: "Layanan" },
          { key: "countryName", label: "Negara" },
          { key: "phoneNumber", label: "Nomor" },
          { key: "otpCode", label: "Kode OTP" },
          { key: "price", label: "Harga" },
          { key: "status", label: "Status" },
          { key: "createdAt", label: "Tanggal" }
        ])
      );
    } else {
      downloadCsv(
        `riwayat-deposit-${Date.now()}.csv`,
        toCsv(
          fDep.map((d) => ({ ...d, provider: providerName(d.provider) })),
          [
            { key: "orderId", label: "ID Deposit" },
            { key: "provider", label: "Metode" },
            { key: "amount", label: "Nominal" },
            { key: "totalAmount", label: "Total Bayar" },
            { key: "status", label: "Status" },
            { key: "createdAt", label: "Tanggal" }
          ]
        )
      );
    }
  }

  return (
    <div className="mx-auto max-w-content px-4 py-6 sm:px-5 sm:py-10">
      <PageHeader
        icon={<Icon.history />}
        title="Riwayat"
        desc="Semua pembelian nokos dan deposit kamu."
        action={
          <Link href="/mutasi" className="btn-ghost px-4 py-2.5">
            Lihat mutasi saldo
          </Link>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "otp", label: "Nokos", count: otp.length },
            { value: "deposit", label: "Deposit", count: deposits.length }
          ]}
        />
        <div className="relative min-w-[180px] flex-1">
          <Icon.search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari…" className="field py-2.5 pl-10" aria-label="Cari riwayat" />
        </div>
        <button onClick={load} className="btn-ghost px-3 py-2.5" aria-label="Muat ulang">
          <Icon.refresh />
        </button>
        <button onClick={exportCsv} className="btn-ghost px-3.5 py-2.5">
          Ekspor CSV
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="card space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-xl" />
            ))}
          </div>
        ) : tab === "otp" ? (
          <div className="card divide-y divide-line overflow-hidden">
            {fOtp.length === 0 ? (
              <EmptyState
                icon="📱"
                title={otp.length ? "Tidak ada yang cocok" : "Belum pernah beli nokos"}
                action={!otp.length && <Link href="/otp" className="btn-primary">Beli nokos</Link>}
              />
            ) : (
              fOtp.map((o) => (
                <div key={o.orderId} className="flex w-full items-center gap-3 px-4 py-3.5 hover:bg-surface2/60 transition-colors">
                  <button onClick={() => setOpenOrder(o)} className="flex flex-1 items-center gap-3 text-left min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-soft text-amber-bright">
                      <Icon.phone />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">
                        {o.serviceName} <span className="font-medium text-muted">· {o.countryName}</span>
                      </span>
                      <span className="block truncate font-mono text-xs text-muted">
                        {o.phoneNumber}
                        {o.otpCode ? ` · kode ${o.otpCode}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold tabular-nums text-ink">{rupiah(o.price)}</span>
                      <Badge tone={o.refunded ? "gray" : statusTone(o.status)} className="mt-1">
                        {o.refunded && o.status !== "done" ? "Direfund" : OTP_LABEL[o.status] || o.status}
                      </Badge>
                    </span>
                  </button>
                  <Link
                    href={`/otp?q=${encodeURIComponent(o.serviceName || "")}`}
                    className="shrink-0 ml-1 rounded-lg border border-amber/30 bg-amber-soft px-2.5 py-1.5 text-[11px] font-semibold text-amber-bright hover:bg-amber/20 transition-colors"
                    title="Beli lagi layanan ini"
                  >
                    🔄 Beli lagi
                  </Link>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="card divide-y divide-line overflow-hidden">
            {fDep.length === 0 ? (
              <EmptyState
                icon="💳"
                title={deposits.length ? "Tidak ada yang cocok" : "Belum pernah deposit"}
                action={!deposits.length && <Link href="/deposit" className="btn-primary">Isi saldo</Link>}
              />
            ) : (
              fDep.map((d) => (
                <button key={d.orderId} onClick={() => setOpenDeposit(d)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface2/60">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
                    <Icon.qris />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">{providerName(d.provider)}</span>
                    <span className="block text-xs text-muted">{fmtWIB(d.createdAt)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold tabular-nums text-ink">{rupiah(d.amount)}</span>
                    <Badge tone={statusTone(d.status)} className="mt-1" pulse={d.status === "pending"}>
                      {DEPOSIT_STATUS_LABEL[d.status] || d.status}
                    </Badge>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {openOrder && (
        <Modal onClose={() => setOpenOrder(null)}>
          <OtpOrderPanel order={openOrder} token={token} onClose={() => setOpenOrder(null)} onChanged={() => (load(), refreshBalance())} />
        </Modal>
      )}

      {openDeposit && (
        <Modal onClose={() => setOpenDeposit(null)}>
          <div className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-extrabold text-ink">Detail deposit</p>
                <p className="text-xs text-muted">{providerName(openDeposit.provider)}</p>
              </div>
              <button onClick={() => setOpenDeposit(null)} className="rounded-lg p-1 text-muted hover:text-ink" aria-label="Tutup">
                <Icon.x />
              </button>
            </div>
            <div className="mt-3 divide-y divide-line">
              <Row label="Status">
                <Badge tone={statusTone(openDeposit.status)}>{DEPOSIT_STATUS_LABEL[openDeposit.status] || openDeposit.status}</Badge>
              </Row>
              <Row label="ID deposit">
                <span className="inline-flex items-center font-mono text-xs">
                  {openDeposit.orderId}
                  <CopyButton value={openDeposit.orderId} label="" />
                </span>
              </Row>
              {openDeposit.providerRef && (
                <Row label="Ref provider">
                  <span className="font-mono text-xs">{openDeposit.providerRef}</span>
                </Row>
              )}
              <Row label="Saldo masuk">{rupiah(openDeposit.amount)}</Row>
              {openDeposit.adminFee ? <Row label="Biaya admin">{rupiah(openDeposit.adminFee)}</Row> : null}
              <Row label="Total bayar" strong>
                {rupiah(openDeposit.totalAmount || openDeposit.amount)}
              </Row>
              <Row label="Dibuat">{fmtWIB(openDeposit.createdAt)}</Row>
              {openDeposit.paidAt && <Row label="Dibayar">{fmtWIB(openDeposit.paidAt)}</Row>}
            </div>
            {openDeposit.status === "pending" && (
              <Link href={`/deposit?order=${encodeURIComponent(openDeposit.orderId)}`} className="btn-primary mt-4 w-full">
                Buka QRIS
              </Link>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button aria-label="Tutup" onClick={onClose} className="animate-fade-in absolute inset-0" style={{ background: "rgb(var(--c-navy-bright) / 0.5)" }} />
      <div className="animate-sheet-up relative max-h-[90vh] w-full max-w-md overflow-y-auto sm:animate-scale-in">{children}</div>
    </div>
  );
}
