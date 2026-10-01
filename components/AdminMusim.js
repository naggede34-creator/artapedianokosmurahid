"use client";

// Panel admin Event Musiman: kalender event otomatis (tanggal kembar, gajian, Ramadan, Lebaran, dst.), ubah diskon/cashback/
// banner/geser hari per event, tambah event kustom, dan lihat event yang sedang berlangsung.
import { useCallback, useEffect, useMemo, useState } from "react";
import { SKIN, GAYA } from "@/lib/gaya";

async function api(url, opsi) {
  const r = await fetch(url, { cache: "no-store", ...opsi });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Gagal (${r.status})`);
  return d;
}
const post = (b) => api("/api/admin/musim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
const tgl = (ymd) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const KOSONG = { nama: "", ikon: "🎉", mulai: "", selesai: "", banner: "", diskonPersen: 3, cashbackBonus: 1, warna: "#F59E0B", gaya: "", skin: "" };

export default function AdminMusim() {
  const [data, setData] = useState(null);
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [semuaKembar, setSemuaKembar] = useState(false);
  const [baru, setBaru] = useState(KOSONG);
  const [edit, setEdit] = useState({});

  const muat = useCallback(async () => {
    try { setData(await api("/api/admin/musim?hari=240")); setGalat(""); } catch (e) { setGalat(e.message); }
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const jalankan = async (b, ok = "Tersimpan ✅") => {
    setPesan(""); setGalat("");
    try { await post(b); setPesan(ok); await muat(); } catch (e) { setGalat(e.message); }
  };

  const daftar = useMemo(() => {
    const e = data?.events || [];
    return semuaKembar ? e : e.filter((x) => x.jenis !== "kembar" || (x.mulai <= (data?.hariIni || "") && x.selesai >= (data?.hariIni || "")) || e.filter((y) => y.jenis === "kembar" && y.mulai >= (data?.hariIni || "")).slice(0, 2).includes(x));
  }, [data, semuaKembar]);

  const sekarang = data?.sekarang;
  const nilai = (e, k) => (edit[e.id] && edit[e.id][k] !== undefined ? edit[e.id][k] : e[k]);
  const ubahLokal = (e, k, v) => setEdit((s) => ({ ...s, [e.id]: { ...(s[e.id] || {}), [k]: v } }));

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <h2 className="text-lg font-bold text-ink">🎉 Event Musiman Otomatis</h2>
        <p className="mt-1 text-sm text-muted">
          Event berjalan sendiri sesuai tanggal — banner, diskon harga nokos, bonus cashback, dan tema/skin maskot. Diskon dipotong dari markup
          (tidak pernah di bawah modal) dan dibatasi <b>MUSIM_DISKON_MAKS</b>. Saklar utama & batas ada di <b>Konfigurasi → Web</b>.
        </p>
        {galat && <p className="mt-2 rounded-lg bg-rose-soft px-3 py-2 text-sm font-medium text-rose">{galat}</p>}
        {pesan && <p className="mt-2 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success">{pesan}</p>}
        <div className="mt-3 rounded-xl border border-line bg-surface2 p-3 text-sm">
          {!data ? "Memuat…" : sekarang?.aktif ? (
            <>
              <p className="font-bold text-ink">Sedang berlangsung: {sekarang.utama?.ikon} {sekarang.utama?.nama} <span className="font-normal text-muted">(sampai {sekarang.utama && tgl(sekarang.utama.selesai)})</span></p>
              <p className="text-muted">Diskon efektif <b>{sekarang.diskonPersen}%</b> · bonus cashback <b>+{sekarang.cashbackBonus}%</b>{sekarang.semua?.length > 1 ? ` · ${sekarang.semua.length} event bersamaan` : ""}</p>
            </>
          ) : <p className="text-muted">Tidak ada event yang sedang berlangsung hari ini ({data.hariIni}).</p>}
          {sekarang?.berikutnya?.length > 0 && (
            <p className="mt-1 text-xs text-muted">Berikutnya: {sekarang.berikutnya.map((b) => `${b.ikon} ${b.nama} (${b.dalamHari} hari lagi)`).join(" · ")}</p>
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-ink">Kalender 8 bulan ke depan</h3>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={semuaKembar} onChange={(e) => setSemuaKembar(e.target.checked)} /> tampilkan semua tanggal kembar
          </label>
        </div>
        <div className="mt-3 space-y-2">
          {daftar.map((e) => {
            const aktif = e.aktif !== false;
            const berjalan = data && e.mulai <= data.hariIni && e.selesai >= data.hariIni;
            return (
              <div key={e.id} className={`rounded-xl border p-3 ${berjalan ? "border-amber bg-amber-soft" : "border-line bg-surface"} ${aktif ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xl">{e.ikon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">{e.nama}{berjalan && <span className="ml-2 rounded-full bg-amber px-2 py-0.5 text-[10px] text-white">BERLANGSUNG</span>}</p>
                    <p className="text-xs text-muted">{tgl(e.mulai)}{e.selesai !== e.mulai ? ` – ${tgl(e.selesai)}` : ""}{e.geserHari ? ` (geser ${e.geserHari > 0 ? "+" : ""}${e.geserHari} hari)` : ""}</p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                    <input type="checkbox" checked={aktif} onChange={(ev) => jalankan(e.bawaan ? { aksi: "ubah", id: e.id, aktif: ev.target.checked } : { aksi: "kustom", ...e, aktif: ev.target.checked })} /> aktif
                  </label>
                  {!e.bawaan && <button className="rounded-lg border border-rose px-2 py-1 text-xs font-bold text-rose" onClick={() => confirm(`Hapus event "${e.nama}"?`) && jalankan({ aksi: "hapus", id: e.id }, "Dihapus")}>Hapus</button>}
                </div>
                {e.bawaan && (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <label className="text-[11px] text-muted">Diskon %<input type="number" min="0" max="50" step="0.5" className="mt-0.5 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-amber" value={nilai(e, "diskonPersen")} onChange={(ev) => ubahLokal(e, "diskonPersen", ev.target.value)} /></label>
                    <label className="text-[11px] text-muted">Cashback +%<input type="number" min="0" max="20" step="0.5" className="mt-0.5 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-amber" value={nilai(e, "cashbackBonus")} onChange={(ev) => ubahLokal(e, "cashbackBonus", ev.target.value)} /></label>
                    <label className="text-[11px] text-muted">Geser hari<input type="number" min="-3" max="3" className="mt-0.5 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-amber" value={nilai(e, "geserHari") ?? 0} onChange={(ev) => ubahLokal(e, "geserHari", ev.target.value)} /></label>
                    <label className="col-span-2 text-[11px] text-muted">Teks banner<input className="mt-0.5 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-amber" maxLength={160} value={nilai(e, "banner") || ""} onChange={(ev) => ubahLokal(e, "banner", ev.target.value)} /></label>
                    {edit[e.id] && (
                      <button className="btn-3d col-span-2 rounded-lg bg-amber px-3 py-1.5 text-xs font-bold text-white sm:col-span-5" onClick={async () => { await jalankan({ aksi: "ubah", id: e.id, ...edit[e.id] }); setEdit((s) => { const n = { ...s }; delete n[e.id]; return n; }); }}>Simpan perubahan event ini</button>
                    )}
                  </div>
                )}
                {!e.bawaan && <p className="mt-1 text-xs text-muted">Diskon {e.diskonPersen}% · cashback +{e.cashbackBonus}% · {e.banner}</p>}
              </div>
            );
          })}
          {data && daftar.length === 0 && <p className="text-sm text-muted">Tidak ada event pada rentang ini.</p>}
        </div>
      </div>

      <div className="card p-4">
        <h3 className="font-bold text-ink">➕ Event kustom (mis. ulang tahun toko)</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="col-span-2 text-[11px] text-muted">Nama<input className="mt-0.5 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-amber" value={baru.nama} onChange={(e) => setBaru({ ...baru, nama: e.target.value })} maxLength={60} /></label>
          <label className="text-[11px] text-muted">Ikon<input className="mt-0.5 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-amber" value={baru.ikon} onChange={(e) => setBaru({ ...baru, ikon: e.target.value })} maxLength={4} /></label>
          <label className="text-[11px] text-muted">Warna<input type="color" className="mt-0.5 h-9 w-full rounded" value={baru.warna} onChange={(e) => setBaru({ ...baru, warna: e.target.value })} /></label>
          <label className="text-[11px] text-muted">Mulai<input type="date" className="mt-0.5 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-amber" value={baru.mulai} onChange={(e) => setBaru({ ...baru, mulai: e.target.value })} /></label>
          <label className="text-[11px] text-muted">Selesai<input type="date" className="mt-0.5 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-amber" value={baru.selesai} onChange={(e) => setBaru({ ...baru, selesai: e.target.value })} /></label>
          <label className="text-[11px] text-muted">Diskon %<input type="number" min="0" max="50" step="0.5" className="mt-0.5 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-amber" value={baru.diskonPersen} onChange={(e) => setBaru({ ...baru, diskonPersen: e.target.value })} /></label>
          <label className="text-[11px] text-muted">Cashback +%<input type="number" min="0" max="20" step="0.5" className="mt-0.5 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-amber" value={baru.cashbackBonus} onChange={(e) => setBaru({ ...baru, cashbackBonus: e.target.value })} /></label>
          <label className="col-span-2 text-[11px] text-muted">Teks banner<input className="mt-0.5 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-amber" maxLength={160} value={baru.banner} onChange={(e) => setBaru({ ...baru, banner: e.target.value })} /></label>
          <label className="text-[11px] text-muted">Gaya otomatis
            <select className="mt-0.5 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-amber" value={baru.gaya} onChange={(e) => setBaru({ ...baru, gaya: e.target.value })}><option value="">(tidak ubah)</option>{GAYA.map((g) => <option key={g.id} value={g.id}>{g.nama}</option>)}</select>
          </label>
          <label className="text-[11px] text-muted">Skin otomatis
            <select className="mt-0.5 w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink outline-none focus:border-amber" value={baru.skin} onChange={(e) => { const s = SKIN.find((x) => x.id === e.target.value); setBaru({ ...baru, skin: e.target.value, musim: s?.musim || "" }); }}><option value="">(tidak ubah)</option>{SKIN.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}</select>
          </label>
        </div>
        <button className="btn-3d mt-3 rounded-xl bg-amber px-4 py-2 text-sm font-bold text-white" onClick={async () => { await jalankan({ aksi: "kustom", ...baru }, "Event kustom dibuat ✅"); setBaru(KOSONG); }}>Buat event</button>
        <p className="mt-2 text-[11px] text-muted">Hijriah (Ramadan, Lebaran, dll.) dihitung kalender Umm al-Qura dan bisa selisih ±1 hari dari penetapan pemerintah — pakai &quot;geser hari&quot;.</p>
      </div>
    </div>
  );
}
