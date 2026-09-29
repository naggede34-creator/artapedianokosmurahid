"use client";

// Tab Referral di dasbor admin: bonus undang teman yang ditahan penjaga
// anti-farming. Admin memutuskan: setujui (bonus cair) atau tolak.
import { useCallback, useEffect, useState } from "react";

const rupiah = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const jam = (d) => new Date(d).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function AdminReferral() {
  const [status, setStatus] = useState("menunggu");
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const muat = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch(`/api/admin/referral?status=${status}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal memuat.");
      setItems(d.items);
    } catch (e) {
      setErr(e.message);
    }
  }, [status]);

  useEffect(() => {
    setItems(null);
    muat();
  }, [muat]);

  async function putuskan(id, keputusan) {
    setBusy(id);
    setErr("");
    try {
      const r = await fetch("/api/admin/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, keputusan })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal menyimpan keputusan.");
      await muat();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="card p-4">
        <h3 className="text-base font-extrabold text-ink">🛡 Bonus undang teman yang ditahan</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Bonus ditahan kalau IP daftar sama dengan pengundang, beberapa akun undangan daftar dari IP yang sama, atau
          pengundang melewati batas harian. Belum masuk ke saldo siapa pun sampai kamu menyetujuinya.
        </p>
        <div className="mt-3 flex gap-2">
          {[["menunggu", "Menunggu"], ["disetujui", "Disetujui"], ["ditolak", "Ditolak"]].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setStatus(k)}
              className={`chip-3d px-3 py-1.5 text-xs font-bold ${status === k ? "text-amber-bright" : "text-muted"}`}
              data-on={status === k}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {err && <p className="rounded-xl bg-rose-soft px-3 py-2 text-sm text-rose">{err}</p>}
      {items === null && !err && <p className="text-sm text-muted">Memuat…</p>}
      {items?.length === 0 && <p className="text-sm text-muted">Tidak ada data.</p>}

      {items?.map((r) => (
        <div key={r.id} className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-ink">
              {r.referrer} <span className="text-muted">mengundang</span> {r.invited}
            </p>
            <span className="text-[11px] text-muted">{jam(r.createdAt)} WIB</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Deposit {rupiah(r.amount)} · bonus <b className="text-ink">{rupiah(r.bonus)}</b>
          </p>
          <ul className="mt-2 list-inside list-disc text-xs text-rose">
            {r.alasan.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          {r.status === "menunggu" && (
            <div className="mt-3 flex gap-2">
              <button
                disabled={busy === r.id}
                onClick={() => putuskan(r.id, "setujui")}
                className="btn-3d rounded-lg bg-success px-4 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                ✅ Setujui &amp; cairkan
              </button>
              <button
                disabled={busy === r.id}
                onClick={() => putuskan(r.id, "tolak")}
                className="btn-3d rounded-lg bg-rose px-4 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                ❌ Tolak
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
