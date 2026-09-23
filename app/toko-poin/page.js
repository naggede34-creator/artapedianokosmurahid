"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/app/providers";
import { rupiah } from "@/components/ui";

export default function TokoPoinPage() {
  const { token, ready, balance, setBalance } = useUser();
  const [items, setItems] = useState(null);
  const [points, setPoints] = useState(0);
  const [redeeming, setRedeeming] = useState(null);
  const [msg, setMsg] = useState({ text: "", ok: true });
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    fetch("/api/points-shop").then((r) => r.json()).then((d) => setItems(d.items));
  }, []);

  useEffect(() => {
    if (!token || !ready) return;
    // /api/user TIDAK PERNAH ADA. Permintaannya dibalas halaman 404, r.json()
    // melempar, .then berikutnya tidak pernah jalan, dan poinnya tertinggal di
    // nilai awal 0 — selamanya. Itu sebabnya halaman ini selalu menunjukkan
    // 0 poin dan semua item tampak tidak terjangkau.
    fetch(`/api/loyalty/info?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("gagal"))))
      .then((d) => setPoints(Number(d.points) || 0))
      .catch(() => setPoints(0));
  }, [token, ready]);

  async function redeem(item) {
    setConfirm(null);
    setRedeeming(item.id);
    const res = await fetch("/api/points-shop/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, itemId: item.id }),
    });
    const d = await res.json();
    setRedeeming(null);
    if (d.ok) {
      setPoints(d.pointsLeft);
      if (d.reward.type === "saldo") {
        setBalance?.(d.newBalance);
        setMsg({ text: `🎉 Berhasil! ${rupiah(d.reward.amount)} ditambahkan ke saldo kamu.`, ok: true });
      } else if (d.reward.type === "spin") {
        setMsg({ text: `🎡 Berhasil! 1 putaran roda gratis ditambahkan.`, ok: true });
      } else {
        setMsg({ text: `✅ Berhasil tukar ${d.pointsSpent} poin!`, ok: true });
      }
    } else {
      setMsg({ text: d.error || "Gagal tukar poin.", ok: false });
    }
    setTimeout(() => setMsg({ text: "", ok: true }), 4000);
  }

  const typeColor = {
    saldo: "bg-teal-bright/10 border-teal-bright/30 text-teal-bright",
    spin: "bg-amber/10 border-amber/30 text-amber-bright",
    discount: "bg-rose/10 border-rose/30 text-rose",
    cashback: "bg-success/10 border-success/30 text-success",
  };

  const typeLabel = { saldo: "Saldo", spin: "Spin", discount: "Diskon", cashback: "Cashback" };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-ink">🛍️ Toko Poin</h1>
        <p className="text-sm text-muted mt-1">Tukar poinmu dengan hadiah menarik</p>
      </div>

      {/* Saldo poin */}
      <div className="mb-5 rounded-2xl border border-amber bg-amber-soft p-4 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber/20 text-2xl">⭐</div>
        <div>
          <p className="text-xs text-muted">Poin kamu</p>
          <p className="text-2xl font-extrabold text-amber-bright tabular-nums">{Number(points).toLocaleString("id-ID")}</p>
        </div>
      </div>

      {msg.text && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${msg.ok ? "bg-success/10 text-success border border-success/30" : "bg-rose-soft text-rose border border-rose/30"}`}>
          {msg.text}
        </div>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgb(0 0 0/0.5)" }}>
          <div className="w-full max-w-xs rounded-2xl bg-surface p-5 shadow-xl">
            <div className="text-4xl text-center mb-2">{confirm.icon}</div>
            <h3 className="text-base font-bold text-ink text-center">{confirm.name}</h3>
            <p className="text-sm text-muted text-center mt-1 mb-4">Tukar <span className="font-bold text-amber-bright">{confirm.pointsCost} poin</span> untuk item ini?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-muted press">Batal</button>
              <button onClick={() => redeem(confirm)} className="flex-1 rounded-xl bg-amber py-2.5 text-sm font-bold text-white press">Tukar!</button>
            </div>
          </div>
        </div>
      )}

      {!items ? (
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4,5,6,7].map((i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => {
            const canAfford = points >= item.pointsCost;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 flex flex-col transition-all ${canAfford ? "border-line bg-surface hover:border-amber/50" : "border-line bg-surface opacity-60"}`}
              >
                <div className="text-3xl mb-2">{item.icon}</div>
                <p className="text-sm font-bold text-ink leading-tight">{item.name}</p>
                <p className="text-xs text-muted mt-0.5 mb-3 flex-1">{item.desc}</p>
                <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full border mb-3 ${typeColor[item.reward.type] || "bg-surface2 text-muted"}`}>
                  {typeLabel[item.reward.type] || item.reward.type}
                </span>
                <button
                  onClick={() => canAfford && setConfirm(item)}
                  disabled={!canAfford || redeeming === item.id}
                  className={`w-full rounded-xl py-2 text-xs font-bold press ${canAfford ? "bg-amber text-white" : "bg-surface2 text-muted cursor-not-allowed"}`}
                >
                  {redeeming === item.id ? "..." : `${item.pointsCost} Poin`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-line bg-surface2 p-4">
        <p className="text-sm font-bold text-ink mb-2">💡 Cara dapat poin</p>
        <ul className="space-y-1.5 text-xs text-muted">
          <li>• Beli nokos (OTP) → dapat poin otomatis</li>
          <li>• Selesaikan misi harian & mingguan</li>
          <li>• Deposit saldo → bonus poin</li>
          <li>• Undang teman pakai referral</li>
        </ul>
      </div>
    </div>
  );
}
