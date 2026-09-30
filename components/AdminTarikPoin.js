"use client";

// Tab admin: pengajuan tarik POIN GAME ke e-wallet. Poin sudah ditahan saat diajukan; admin mengirim rupiah
// ke e-wallet pengguna lalu menandai "Sudah dibayar", atau menolak (poin dikembalikan ke pengguna).
import { useCallback, useEffect, useState } from "react";
import { teksPoin } from "@/lib/poinGame";

const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const waktu = (d) => (d ? new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—");
const STATUS = { menunggu: "Menunggu dibayar", dibayar: "Sudah dibayar", ditolak: "Ditolak", batal: "Dibatalkan", semua: "Semua" };

export default function AdminTarikPoin() {
  const [filter, setFilter] = useState("menunggu");
  const [d, setD] = useState(null);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState("");
  const [catatan, setCatatan] = useState({});

  const muat = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/tarik-poin?status=${filter}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal memuat.");
      setD(j); setGalat("");
    } catch (e) { setGalat(e.message); }
  }, [filter]);
  useEffect(() => { muat(); const t = setInterval(muat, 20000); return () => clearInterval(t); }, [muat]);

  async function putus(t, aksi) {
    const c = (catatan[t.id] || "").trim();
    if (aksi === "tolak" && !c && !confirm("Tolak tanpa alasan? Poin dikembalikan ke pengguna.")) return;
    if (aksi === "bayar" && !confirm(`Yakin sudah mentransfer ${rp(t.bersih)} ke ${t.ewallet} ${t.nomor} a.n. ${t.nama}?`)) return;
    setSibuk(t.id); setGalat(""); setInfo("");
    try {
      const r = await fetch("/api/admin/tarik-poin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi, id: t.id, catatan: c, refBayar: aksi === "bayar" ? c : "" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal.");
      setInfo(aksi === "bayar" ? "Ditandai sudah dibayar; pengguna diberi tahu." : "Ditolak; poin dikembalikan ke pengguna.");
      await muat();
    } catch (e) { setGalat(e.message); } finally { setSibuk(""); }
  }

  return (
    <div className="mt-5 space-y-4" data-testid="admin-tarik-poin">
      <div className="card p-4">
        <h3 className="text-base font-extrabold text-ink">💸 Tarik poin game ke e-wallet</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Poin pengguna sudah <b>ditahan</b> begitu mengajukan. Transfer <b>jumlah yang diterima</b> ke e-wallet tujuan, lalu tekan “Sudah dibayar”. Menolak mengembalikan poin utuh.
          Sebelum membayar, cek riwayat deposit pengguna dan pastikan uangnya benar-benar masuk di mutasi QRIS-mu (bukti transfer bisa dipalsukan). Batas, biaya, jam kerja, dan syarat perputaran diatur di Konfigurasi → Website (GAME_TARIK_*, GAME_SYARAT_PUTAR_KALI).
        </p>
        {galat && <p className="mt-3 rounded-lg bg-rose-soft px-3 py-2 text-xs font-bold text-rose">{galat}</p>}
        {info && <p className="mt-3 rounded-lg bg-teal-soft px-3 py-2 text-xs font-bold text-teal-bright">{info}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {["menunggu", "dibayar", "ditolak", "batal", "semua"].map((s) => (
            <button key={s} type="button" onClick={() => setFilter(s)} data-testid={`tp-filter-${s}`} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === s ? "bg-ink text-bg" : "border border-line text-muted"}`}>
              {STATUS[s]}{s === "menunggu" && d?.menunggu ? ` (${d.menunggu})` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {!d && <p className="text-sm text-muted">Memuat…</p>}
        {d && !d.items.length && <p className="card p-4 text-sm text-muted">Tidak ada pengajuan di filter ini.</p>}
        {(d?.items || []).map((t) => (
          <div key={t.id} className="card p-4" data-testid="tp-item">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted">{t.id} · {waktu(t.dibuat)}</p>
                <p className="mt-0.5 text-lg font-black text-ink">Transfer {rp(t.bersih)}</p>
                <p className="text-xs text-muted">{teksPoin(t.rp)} = {rp(t.rp)}{t.fee ? ` (biaya ${rp(t.fee)})` : ""}</p>
                <p className="mt-1 text-sm font-bold text-ink">🏦 {t.ewallet} · <span className="font-mono" data-testid="tp-nomor">{t.nomor}</span> a.n. {t.nama}</p>
                <p className="mt-0.5 text-[11px] text-muted">Akun: {t.namaAkun || "(tanpa nama)"} · <span className="font-mono">{t.token}</span></p>
                {t.catatan && <p className="mt-1 text-xs text-ink">Catatan: {t.catatan}{t.refBayar ? ` · ref ${t.refBayar}` : ""}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${t.status === "menunggu" ? "bg-amber-soft text-amber-bright" : t.status === "dibayar" ? "bg-teal-soft text-teal-bright" : "bg-surface2 text-muted"}`}>{STATUS[t.status] || t.status}</span>
            </div>
            {t.status === "menunggu" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input value={catatan[t.id] || ""} onChange={(e) => setCatatan((c) => ({ ...c, [t.id]: e.target.value.slice(0, 200) }))} placeholder="Catatan / no. referensi transfer (opsional)" className="min-w-[200px] flex-1 rounded-lg border border-line bg-bg px-3 py-1.5 text-xs text-ink outline-none focus:border-amber" data-testid="tp-catatan" />
                <button type="button" disabled={sibuk === t.id} onClick={() => putus(t, "bayar")} className="btn-3d rounded-md bg-teal px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60" data-testid="tp-bayar">✓ Sudah dibayar</button>
                <button type="button" disabled={sibuk === t.id} onClick={() => putus(t, "tolak")} className="btn-3d rounded-md border border-rose/40 px-3 py-1.5 text-xs font-bold text-rose disabled:opacity-60" data-testid="tp-tolak">✕ Tolak</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
