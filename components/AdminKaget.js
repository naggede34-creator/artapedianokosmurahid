"use client";

// Tab Saldo Kaget di dasbor admin: memantau paket, menutup paket bermasalah. Batas & saklar ada di Konfigurasi (grup Website).
import { useCallback, useEffect, useState } from "react";
import { fmtWIB, rupiah } from "@/components/ui";
import "./kaget.css";

const STATUS = [["", "Semua"], ["aktif", "Aktif"], ["habis", "Habis"], ["berakhir", "Berakhir"], ["dibatalkan", "Ditutup"]];

export default function AdminKaget() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState("");

  const muat = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/kaget?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal memuat.");
      setData(d); setGalat("");
    } catch (e) { setGalat(e.message); }
  }, [status, q]);

  useEffect(() => { const t = setTimeout(muat, 250); return () => clearTimeout(t); }, [muat]);

  async function tutup(k) {
    if (!window.confirm(`Tutup paksa paket ${k.kid} (${rupiah(k.total)}) milik ${k.pembuat}? Sisa yang belum diambil dikembalikan ke pembuatnya.`)) return;
    setSibuk(k.kid); setInfo(""); setGalat("");
    try {
      const r = await fetch("/api/admin/kaget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "tutup", kid: k.kid }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal menutup.");
      setInfo(`Paket ${k.kid} ditutup. ${rupiah(d.dikembalikan)} dikembalikan ke pembuat.`);
      muat();
    } catch (e) { setGalat(e.message); } finally { setSibuk(""); }
  }

  const k = data?.konfig;
  return (
    <div className="space-y-5" data-testid="admin-kaget">
      <div className="glass rounded-2xl p-5 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-ink">🧧 Saldo Kaget</h2>
        <p className="mt-1 text-xs text-muted">Pengguna membagi saldo ke teman lewat tautan. Saldo ditahan di paket (escrow) dan sisanya kembali otomatis saat paket berakhir. Saldo yang diterima bukan saldo deposit — tidak bisa ditarik.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Paket aktif", data?.ringkasan?.aktif ?? "…"],
            ["Paket 7 hari", data?.ringkasan?.paket7Hari ?? "…"],
            ["Nilai 7 hari", data ? rupiah(data.ringkasan.total7Hari) : "…"],
            ["Status fitur", k ? (k.aktif ? "Aktif" : "Ditutup") : "…"]
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-line bg-surface p-3"><p className="text-[11px] text-muted">{l}</p><p className="text-lg font-black text-ink">{v}</p></div>
          ))}
        </div>
        {k && (
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Batas sekarang: total {rupiah(k.minTotal)}–{rupiah(k.maksTotal)} · tiap penerima ≥ {rupiah(k.minPerOrang)} · maks {k.maksPenerima} penerima · berlaku {k.masaJam} jam · maks {k.maksAktif} paket aktif/pembuat · biaya {k.biayaPersen}%.
            Ubah di tab <b>Konfigurasi</b> (kunci <code>KAGET_*</code>).
          </p>
        )}
      </div>

      <div className="glass rounded-2xl p-5 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS.map(([v, l]) => (
            <button key={v || "semua"} onClick={() => setStatus(v)} className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${status === v ? "border-amber bg-amber text-white" : "border-line text-muted"}`}>{l}</button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode paket / kode akun pembuat" className="ml-auto w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-amber sm:w-72" />
        </div>
        {info && <p className="mt-3 text-xs font-bold text-teal-bright">{info}</p>}
        {galat && <p className="mt-3 text-xs font-bold text-rose">{galat}</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-3 py-2 font-medium">Paket</th><th className="px-3 py-2 font-medium">Pembuat</th><th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Diambil</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Dibuat</th><th className="px-3 py-2 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((p) => (
                <tr key={p.kid} className="border-b border-line/60">
                  <td className="px-3 py-2"><a href={`/kaget/${p.kid}`} target="_blank" rel="noreferrer" className="font-mono text-xs font-bold text-amber-bright underline">{p.kid}</a><span className="block text-[10px] text-muted">{p.mode === "rata" ? "rata" : "acak"}{p.pesan ? ` · “${p.pesan.slice(0, 24)}”` : ""}</span></td>
                  <td className="px-3 py-2"><span className="text-ink">{p.pembuat}</span><span className="block font-mono text-[10px] text-muted">{String(p.owner).slice(0, 10)}…</span></td>
                  <td className="px-3 py-2 font-bold text-ink">{rupiah(p.total)}{p.biaya > 0 && <span className="block text-[10px] font-normal text-muted">biaya {rupiah(p.biaya)}</span>}</td>
                  <td className="px-3 py-2">{p.diklaim}/{p.jumlah}{p.refund != null && <span className="block text-[10px] text-muted">kembali {rupiah(p.refund)}</span>}</td>
                  <td className="px-3 py-2"><span className={`kg-chip ${p.status}`}>{p.status}</span>{p.ditutupOleh === "admin" && <span className="ml-1 text-[10px] text-rose">admin</span>}</td>
                  <td className="px-3 py-2 text-xs text-muted">{fmtWIB(p.dibuat)}</td>
                  <td className="px-3 py-2 text-right">
                    {p.status === "aktif" && <button disabled={sibuk === p.kid} onClick={() => tutup(p)} className="rounded-lg border border-rose/40 px-3 py-1 text-xs font-bold text-rose hover:bg-rose-soft disabled:opacity-50">{sibuk === p.kid ? "…" : "Tutup paksa"}</button>}
                  </td>
                </tr>
              ))}
              {data && data.items.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-xs text-muted">Belum ada paket.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
