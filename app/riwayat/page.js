"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";

export default function RiwayatPage() {
  const { token } = useUser();
  const [tab, setTab] = useState("deposit");
  const [deposits, setDeposits] = useState([]);
  const [otpOrders, setOtpOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/deposit/history?token=${token}`).then((r) => r.json()),
      fetch(`/api/otp/history?token=${token}`).then((r) => r.json())
    ])
      .then(([d, o]) => {
        setDeposits(d.items || []);
        setOtpOrders(o.items || []);
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="mx-auto max-w-content px-5 py-14">
      <p className="text-sm font-medium text-amber">Riwayat</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink">Riwayat transaksi kamu</h1>
      <p className="mt-3 text-sm text-muted">Terhubung lewat kode akun kamu, jadi pastikan kode itu tersimpan aman.</p>

      <div className="mt-8 flex gap-2">
        <button
          onClick={() => setTab("deposit")}
          className={`rounded-full border px-4 py-1.5 text-sm ${tab === "deposit" ? "border-amber text-amber-bright" : "border-line text-muted"}`}
        >
          Deposit
        </button>
        <button
          onClick={() => setTab("otp")}
          className={`rounded-full border px-4 py-1.5 text-sm ${tab === "otp" ? "border-teal text-teal-bright" : "border-line text-muted"}`}
        >
          Beli OTP
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line">
        {loading ? (
          <p className="p-6 text-sm text-muted">Memuat riwayat...</p>
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
                  <tr key={d.orderId}>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {otpOrders.map((o) => (
                <tr key={o.orderId}>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
