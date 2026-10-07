"use client";

// Kartu pengaturan Cashback di Pengaturan Umum (admin): persen dasar, tingkat, bonus nominal, batas — dengan pratinjau hitung langsung.
import { useEffect, useMemo, useState } from "react";
import { hitungCashback } from "@/lib/cashbackHitung";
import { rupiah } from "@/components/ui";

const kolom = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-amber";
const ke = (s) => ({
  dasar: String(s?.loyalty?.cashbackDepositPercent ?? 1),
  maksPersen: String(s?.loyalty?.maksPersen ?? 15),
  maksRupiah: String(s?.loyalty?.maksRupiah ?? 100000),
  tier: (s?.loyalty?.tier || []).map((t) => ({ ...t, minBelanja: String(t.minBelanja), tambahan: String(t.tambahan) })),
  nominal: (s?.loyalty?.nominal || []).map((n) => ({ min: String(n.min), tambahan: String(n.tambahan) }))
});

export default function AdminCashback() {
  const [s, setS] = useState(null);
  const [f, setF] = useState(null);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [contoh, setContoh] = useState("100000");

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (!d.error) { setS(d); setF(ke(d)); } }).catch(() => setPesan("Gagal memuat."));
  }, []);

  const pratinjau = useMemo(() => {
    if (!f) return [];
    const loyalty = {
      tier: f.tier.map((t) => ({ ...t, minBelanja: Number(t.minBelanja) || 0, tambahan: Number(t.tambahan) || 0 })).sort((a, b) => a.minBelanja - b.minBelanja),
      nominal: f.nominal.map((n) => ({ min: Number(n.min) || 0, tambahan: Number(n.tambahan) || 0 })),
      maksPersen: Number(f.maksPersen) || 0, maksRupiah: Number(f.maksRupiah) || 0
    };
    const settings = { loyalty, eventCashbackBonus: 0 };
    return loyalty.tier.map((t) => ({ t, h: hitungCashback({ amount: Number(contoh) || 0, dasar: Number(f.dasar) || 0, totalSpent: t.minBelanja, settings }) }));
  }, [f, contoh]);

  if (!f) return <div className="glass rounded-2xl p-5 text-sm text-muted shadow-soft">{pesan || "Memuat pengaturan cashback…"}</div>;

  const ubahTier = (i, k, v) => setF((x) => ({ ...x, tier: x.tier.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const ubahNom = (i, k, v) => setF((x) => ({ ...x, nominal: x.nominal.map((n, j) => (j === i ? { ...n, [k]: v } : n)) }));

  async function simpan() {
    setSibuk(true); setPesan("");
    try {
      const loyalty = {
        cashbackDepositPercent: Number(f.dasar) || 0, maksPersen: Number(f.maksPersen) || 0, maksRupiah: Number(f.maksRupiah) || 0,
        tier: f.tier.map((t) => ({ key: t.key, nama: t.nama, ikon: t.ikon, minBelanja: Number(t.minBelanja) || 0, tambahan: Number(t.tambahan) || 0 })),
        nominal: f.nominal.map((n) => ({ min: Number(n.min) || 0, tambahan: Number(n.tambahan) || 0 }))
      };
      const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loyalty }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal menyimpan.");
      setS(d); setF(ke(d)); setPesan("Pengaturan cashback tersimpan.");
    } catch (e) { setPesan(e.message); } finally { setSibuk(false); setTimeout(() => setPesan(""), 4000); }
  }

  return (
    <div className="glass rounded-2xl p-5 shadow-soft sm:p-6" data-testid="admin-cashback">
      <h2 className="font-display text-base font-semibold text-ink">🎁 Cashback Deposit & Tingkat</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Persen akhir = <b>dasar</b> + <b>tambahan tingkat</b> (dari total belanja nokos pengguna) + <b>bonus nominal</b> (deposit besar) + bonus event musiman,
        lalu dibatasi maksimal persen &amp; rupiah. Ini uang sungguhan yang keluar tiap deposit — periksa pratinjau di bawah sebelum menyimpan.
        Cashback khusus QRIS manual diatur di kartu QRIS Manual.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="text-xs font-medium text-muted">Cashback dasar (%)<input type="number" step="0.1" min="0" max="50" value={f.dasar} onChange={(e) => setF({ ...f, dasar: e.target.value })} className={kolom} data-testid="cb-dasar" /></label>
        <label className="text-xs font-medium text-muted">Batas persen total (%)<input type="number" step="0.5" min="0" max="50" value={f.maksPersen} onChange={(e) => setF({ ...f, maksPersen: e.target.value })} className={kolom} /></label>
        <label className="text-xs font-medium text-muted">Batas cashback per deposit (Rp, 0 = bebas)<input type="number" step="1000" min="0" value={f.maksRupiah} onChange={(e) => setF({ ...f, maksRupiah: e.target.value })} className={kolom} /></label>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between"><h3 className="text-sm font-black text-ink">Tingkat (maks 6)</h3>
            {f.tier.length < 6 && <button type="button" onClick={() => setF({ ...f, tier: [...f.tier, { key: `t${f.tier.length + 1}`, nama: `Tingkat ${f.tier.length + 1}`, ikon: "⭐", minBelanja: "0", tambahan: "0" }] })} className="text-xs font-bold text-amber-bright">+ Tambah</button>}</div>
          <div className="mt-2 space-y-2">
            {f.tier.map((t, i) => (
              <div key={i} className="grid grid-cols-[44px_1fr_1fr_70px_auto] items-end gap-2 rounded-xl border border-line p-2">
                <label className="text-[10px] text-muted">Ikon<input value={t.ikon} maxLength={4} onChange={(e) => ubahTier(i, "ikon", e.target.value)} className={kolom + " px-1 text-center"} /></label>
                <label className="text-[10px] text-muted">Nama<input value={t.nama} maxLength={20} onChange={(e) => ubahTier(i, "nama", e.target.value)} className={kolom} /></label>
                <label className="text-[10px] text-muted">Belanja ≥ (Rp)<input type="number" min="0" disabled={i === 0} value={i === 0 ? "0" : t.minBelanja} onChange={(e) => ubahTier(i, "minBelanja", e.target.value)} className={kolom} /></label>
                <label className="text-[10px] text-muted">+ %<input type="number" step="0.1" min="0" max="20" value={t.tambahan} onChange={(e) => ubahTier(i, "tambahan", e.target.value)} className={kolom} /></label>
                <button type="button" disabled={f.tier.length <= 1} onClick={() => setF({ ...f, tier: f.tier.filter((_, j) => j !== i) })} aria-label="Hapus tingkat" className="mb-1 rounded-lg px-2 py-1 text-xs font-bold text-rose disabled:opacity-30">✕</button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between"><h3 className="text-sm font-black text-ink">Bonus deposit besar (maks 6)</h3>
            {f.nominal.length < 6 && <button type="button" onClick={() => setF({ ...f, nominal: [...f.nominal, { min: "100000", tambahan: "0.5" }] })} className="text-xs font-bold text-amber-bright">+ Tambah</button>}</div>
          <div className="mt-2 space-y-2">
            {f.nominal.map((n, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_auto] items-end gap-2 rounded-xl border border-line p-2">
                <label className="text-[10px] text-muted">Deposit ≥ (Rp)<input type="number" min="1000" step="1000" value={n.min} onChange={(e) => ubahNom(i, "min", e.target.value)} className={kolom} /></label>
                <label className="text-[10px] text-muted">+ %<input type="number" step="0.1" min="0" max="20" value={n.tambahan} onChange={(e) => ubahNom(i, "tambahan", e.target.value)} className={kolom} /></label>
                <button type="button" onClick={() => setF({ ...f, nominal: f.nominal.filter((_, j) => j !== i) })} aria-label="Hapus bonus" className="mb-1 rounded-lg px-2 py-1 text-xs font-bold text-rose">✕</button>
              </div>
            ))}
            {f.nominal.length === 0 && <p className="text-xs text-muted">Tidak ada bonus nominal.</p>}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-surface2 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-black text-ink">Pratinjau untuk deposit</h3>
          <input type="number" min="0" step="1000" value={contoh} onChange={(e) => setContoh(e.target.value)} className="w-32 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-amber" aria-label="Nominal contoh" />
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {pratinjau.map(({ t, h }) => (
            <li key={t.key + t.minBelanja} className="rounded-lg border border-line bg-surface p-2.5 text-xs">
              <p className="font-black text-ink">{t.ikon} {t.nama}</p>
              <p className="text-muted">{h.persen}% → <b className="text-success">{rupiah(h.cashback)}</b></p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={simpan} disabled={sibuk} className="btn-3d rounded-lg bg-gradient-to-r from-amber to-amber-bright px-5 py-2.5 text-sm font-medium text-white shadow-3d disabled:opacity-60" data-testid="cb-simpan">{sibuk ? "Menyimpan…" : "Simpan cashback"}</button>
        {pesan && <span className="text-xs font-medium text-teal-bright">{pesan}</span>}
      </div>
    </div>
  );
}
