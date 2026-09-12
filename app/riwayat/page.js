"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";
import OtpOrderPanel from "@/components/OtpOrderPanel";

export default function RiwayatPage() {
  const { token } = useUser();
  const [tab, setTab] = useState("deposit");
  const [deposits, setDeposits] = useState([]);
  const [otpOrders, setOtpOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openOrder, setOpenOrder] = useState(null);

  function loadHistory() {
    if (!token) return;
    setLoading(true);
    return Promise.all([
      fetch(`/api/deposit/history?token=${token}`).then((r) => r.json()),
      fetch(`/api/otp/history?token=${token}`).then((r) => r.json())
    ])
      .then(([d, o]) => {
        setDeposits(d.items || []);
        setOtpOrders(o.items || []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="mx-auto max-w-content px-5 py-14">
      <p className="fade-up text-sm font-semibold uppercase tracking-wide text-amber-bright">Riwayat</p>
      <h1 className="fade-up delay-1 mt-2 font-display text-display-sm font-semibold text-ink sm:text-display-md">Riwayat transaksi kamu</h1>
      <p className="fade-up delay-2 mt-3 text-sm leading-relaxed text-muted">Terhubung lewat kode akun kamu, jadi pastikan kode itu tersimpan aman.</p>

      <div className="fade-up delay-3 mt-8 flex gap-2">
        <button
          onClick={() => setTab("deposit")}
          className={`press rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
            tab === "deposit" ? "border-amber bg-amber-soft text-amber-bright shadow-soft" : "border-line text-muted hover:text-ink"
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setTab("otp")}
          className={`press rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
            tab === "otp" ? "border-teal bg-teal-soft text-teal-bright shadow-soft" : "border-line text-muted hover:text-ink"
          }`}
        >
          Beli OTP
        </button>
      </div>

      <div className="scale-in mt-6 overflow-hidden rounded-2xl border border-line shadow-soft">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-10 rounded-lg" />
            ))}
          </div>
        ) : tab === "deposit" ? (
          deposits.length === 0 ? (
            <p className="p-6 text-sm text-muted">Belum ada riwayat deposit.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Kode order</th>
                  <th className="px-4 py-3">Nominal</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {deposits.map((d) => (
                  <tr key={d.orderId} className="transition-colors hover:bg-surface2/60">
                    <td className="px-4 py-3 font-mono text-xs text-ink">{d.orderId}</td>
                    <td className="px-4 py-3 text-ink">Rp{Number(d.amount).toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">{new Date(d.createdAt).toLocaleString("id-ID")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : otpOrders.length === 0 ? (
          <p className="p-6 text-sm text-muted">Belum ada riwayat pembelian nomor OTP.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Layanan</th>
                <th className="px-4 py-3">Nomor</th>
                <th className="px-4 py-3">Harga</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {otpOrders.map((o) => (
                <tr key={o.orderId} className="transition-colors hover:bg-surface2/60">
                  <td className="px-4 py-3 text-ink">
                    {o.serviceName}
                    <span className="block text-xs text-muted">{o.countryName}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink">{o.phoneNumber}</td>
                  <td className="px-4 py-3 text-ink">Rp{Number(o.price).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-muted">{new Date(o.createdAt).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setOpenOrder(o)} className="underline-grow text-xs font-medium text-teal-bright">
                      {["pending"].includes(o.status) && !o.otpCode ? "Buka" : "Lihat"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openOrder && (
        <div className="fixed inset-0 z-[60] flex animate-fade-up items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="expand-down max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl sm:rounded-2xl">
            <OtpOrderPanel
              order={openOrder}
              token={token}
              onClose={() => setOpenOrder(null)}
              onChanged={() => loadHistory()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    completed: "text-teal border-teal/40",
    received: "text-teal border-teal/40",
    done: "text-teal border-teal/40",
    pending: "text-amber border-amber/40",
    canceled: "text-rose border-rose/40",
    expired: "text-rose border-rose/40"
  };
  const cls = map[status] || "text-muted border-line";
  return <span className={`rounded-full border px-2.5 py-1 text-xs ${cls}`}>{status || "-"}</span>;
}
