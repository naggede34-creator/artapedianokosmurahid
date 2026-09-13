"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/providers";

const FILTERS = [
  { key: "semua", label: "Semua" },
  { key: "masuk", label: "Masuk" },
  { key: "keluar", label: "Keluar" }
];

export default function MutasiPage() {
  const { token, ready } = useUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("semua");

  useEffect(() => {
    if (!ready || !token) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/deposit/history?token=${encodeURIComponent(token)}`).then((r) => r.json()),
      fetch(`/api/otp/history?token=${encodeURIComponent(token)}`).then((r) => r.json())
    ])
      .then(([deposits, orders]) => {
        const masuk = (deposits.items || [])
          .filter((d) => d.status === "completed")
          .map((d) => ({
            id: `dep-${d.orderId}`,
            type: "masuk",
            title: "Deposit Saldo",
            amount: Number(d.amount || 0),
            createdAt: d.createdAt
          }));
        const keluar = (orders.items || [])
          .filter((o) => o.status === "done")
          .map((o) => ({
            id: `otp-${o.orderId}`,
            type: "keluar",
            title: `${o.serviceName || "OTP"} · ${o.countryName || "-"}`,
            amount: Number(o.price || 0),
            createdAt: o.createdAt
          }));
        const merged = [...masuk, ...keluar].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setRows(merged);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [ready, token]);

  const filtered = useMemo(() => {
    if (filter === "semua") return rows;
    return rows.filter((r) => r.type === filter);
  }, [rows, filter]);

  const totals = useMemo(() => {
    const masuk = rows.filter((r) => r.type === "masuk").reduce((s, r) => s + r.amount, 0);
    const keluar = rows.filter((r) => r.type === "keluar").reduce((s, r) => s + r.amount, 0);
    return { masuk, keluar };
  }, [rows]);

  return (
    <div className="mx-auto max-w-content px-5 py-8">
      <p className="fade-up text-sm font-semibold uppercase tracking-wide text-amber-bright">📄 Mutasi Saldo</p>
      <h1 className="fade-up delay-1 mt-2 font-display text-display-sm font-semibold text-ink sm:text-display-md">
        Riwayat pemasukan &amp; pengeluaran
      </h1>
      <p className="fade-up delay-2 mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Gabungan seluruh deposit yang masuk dan pemakaian saldo untuk pembelian nomor OTP.
      </p>

      <div className="fade-up delay-3 mt-6 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="card-shadow rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">Total Masuk</p>
          <p className="mt-1 font-display text-lg font-semibold text-success">
            +Rp{totals.masuk.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="card-shadow rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">Total Keluar</p>
          <p className="mt-1 font-display text-lg font-semibold text-rose">
            -Rp{totals.keluar.toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      <div className="fade-up delay-4 mt-5 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`press rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key ? "border-amber bg-amber-soft text-amber-bright" : "border-line text-muted hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="fade-up delay-5 mt-4 overflow-hidden rounded-2xl border border-line">
        {loading ? (
          <div className="space-y-2 bg-surface p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 bg-surface py-14 text-center">
            <span className="text-2xl">📭</span>
            <p className="text-sm text-muted">Belum ada data mutasi saldo.</p>
          </div>
        ) : (
          <div className="divide-y divide-line bg-surface">
            {filtered.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      r.type === "masuk" ? "bg-success-soft text-success" : "bg-rose-soft text-rose"
                    }`}
                  >
                    {r.type === "masuk" ? "↓" : "↑"}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">{r.title}</p>
                    <p className="text-[11px] text-muted">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString("id-ID") : "-"}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${r.type === "masuk" ? "text-success" : "text-rose"}`}>
                  {r.type === "masuk" ? "+" : "-"}Rp{r.amount.toLocaleString("id-ID")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
