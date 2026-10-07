"use client";

// Tab Pembaruan di dasbor admin: kelola isi popup "Yang Baru" yang dilihat
// pengguna — tambah, ubah, hapus, aktif/nonaktif, urutkan, dan pratinjau.
import { useCallback, useEffect, useState } from "react";

const KOSONG = { id: "", ikon: "✨", judul: "", isi: "", baru: true, aktif: true, href: "", tombol: "" };
const IKON_CEPAT = ["✨", "🎮", "🎰", "🀄", "💬", "📞", "🎁", "💸", "🔥", "🛡", "🤖", "⚡"];

async function panggil(aksi, data = {}) {
  const r = await fetch("/api/admin/pembaruan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi, ...data }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Gagal.");
  return j;
}

export default function AdminPembaruan() {
  const [d, setD] = useState(null);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [form, setForm] = useState(null); // butir yang sedang disunting/ditambah
  const [meta, setMeta] = useState(null);

  const muat = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/pembaruan", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal memuat.");
      setD(j);
      setMeta((m) => m || j.meta);
      setGalat("");
    } catch (e) { setGalat(e.message); }
  }, []);
  useEffect(() => { muat(); }, [muat]);

  async function jalan(aksi, data, pesan) {
    setSibuk(true); setGalat(""); setInfo("");
    try { await panggil(aksi, data); if (pesan) setInfo(pesan); await muat(); return true; }
    catch (e) { setGalat(e.message); return false; }
    finally { setSibuk(false); }
  }

  async function simpanForm(e) {
    e.preventDefault();
    const ok = await jalan(form.id ? "ubah" : "tambah", form, form.id ? "Butir diperbarui." : "Butir ditambahkan di urutan paling atas.");
    if (ok) setForm(null);
  }

  const isi = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const kelas = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-amber";

  return (
    <div className="mt-5 space-y-4" data-testid="admin-pembaruan">
      <div className="card p-4">
        <h3 className="text-base font-extrabold text-ink">✨ Popup pembaruan</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Atur pesan “Yang Baru” yang muncul di layar pengguna. Mengubah butir aktif otomatis membuat popup muncul lagi bagi yang sudah menutupnya;
          tombol “Tampilkan lagi ke semua” memaksa hal yang sama tanpa mengubah isi.
        </p>
        {galat && <p className="mt-3 rounded-lg bg-rose-soft px-3 py-2 text-xs font-bold text-rose">{galat}</p>}
        {info && <p className="mt-3 rounded-lg bg-teal-soft px-3 py-2 text-xs font-bold text-teal-bright">{info}</p>}

        {meta && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted">Judul popup
              <input className={`${kelas} mt-1 normal-case`} maxLength={80} value={meta.judul} onChange={(e) => setMeta({ ...meta, judul: e.target.value })} data-testid="pb-judul" />
            </label>
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted">Kalimat pembuka
              <input className={`${kelas} mt-1 normal-case`} maxLength={160} value={meta.sub} onChange={(e) => setMeta({ ...meta, sub: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-ink">
              <input type="checkbox" checked={meta.otomatis} onChange={(e) => setMeta({ ...meta, otomatis: e.target.checked })} />
              Muncul otomatis ke pengguna
            </label>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <button type="button" disabled={sibuk} onClick={() => jalan("meta", meta, "Pengaturan popup disimpan.")} className="btn-3d rounded-xl border-2 border-ink bg-amber px-4 py-2 text-xs font-black text-white" data-testid="pb-simpan-meta">Simpan pengaturan</button>
              <button type="button" disabled={sibuk} onClick={() => jalan("paksa", {}, "Popup akan muncul lagi untuk semua pengguna.")} className="btn-3d rounded-xl border border-line bg-surface px-4 py-2 text-xs font-black text-ink" data-testid="pb-paksa">📣 Tampilkan lagi ke semua</button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-extrabold text-ink">Daftar pesan {d && <span className="text-xs font-semibold text-muted">({d.item.length})</span>}</h3>
          <button type="button" onClick={() => setForm({ ...KOSONG })} className="btn-3d rounded-xl border-2 border-blue bg-blue-bright px-4 py-2 text-xs font-black text-white" data-testid="pb-tambah">＋ Tambah pesan</button>
        </div>

        {form && (
          <form onSubmit={simpanForm} className="mt-3 space-y-2.5 rounded-2xl border-2 border-amber/50 bg-amber-soft/40 p-3.5" data-testid="pb-form">
            <p className="text-sm font-black text-ink">{form.id ? "Ubah pesan" : "Pesan baru"}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {IKON_CEPAT.map((k) => (
                <button key={k} type="button" onClick={() => setForm((f) => ({ ...f, ikon: k }))} className={`h-9 w-9 rounded-lg border text-lg ${form.ikon === k ? "border-amber bg-amber-soft" : "border-line bg-surface"}`}>{k}</button>
              ))}
              <input className={`${kelas} !w-20 text-center`} maxLength={8} value={form.ikon} onChange={isi("ikon")} aria-label="Ikon" />
            </div>
            <input className={kelas} placeholder="Judul (wajib)" maxLength={90} value={form.judul} onChange={isi("judul")} data-testid="pb-f-judul" />
            <textarea className={`${kelas} min-h-[84px]`} placeholder="Isi pesan" maxLength={600} value={form.isi} onChange={isi("isi")} data-testid="pb-f-isi" />
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={kelas} placeholder="Tautan tombol (mis. /kaget) — opsional" maxLength={300} value={form.href} onChange={isi("href")} />
              <input className={kelas} placeholder="Tulisan tombol (mis. Main sekarang)" maxLength={30} value={form.tombol} onChange={isi("tombol")} />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-ink">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={form.baru} onChange={isi("baru")} /> Tandai BARU</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={form.aktif} onChange={isi("aktif")} /> Tampilkan ke pengguna</label>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={sibuk || !form.judul.trim()} className="btn-3d rounded-xl border-2 border-ink bg-amber px-5 py-2 text-xs font-black text-white disabled:opacity-50" data-testid="pb-f-simpan">Simpan</button>
              <button type="button" onClick={() => setForm(null)} className="btn-3d rounded-xl border border-line bg-surface px-5 py-2 text-xs font-black text-ink">Batal</button>
            </div>
          </form>
        )}

        <div className="mt-3 space-y-2">
          {!d && <p className="text-sm text-muted">Memuat…</p>}
          {d && !d.item.length && <p className="text-sm text-muted">Belum ada pesan. Popup tidak akan tampil sampai ada butir aktif.</p>}
          {(d?.item || []).map((x, n) => (
            <div key={x.id} data-testid="pb-item" className={`flex flex-wrap items-start gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 ${x.aktif ? "" : "opacity-60"}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-soft text-xl">{x.ikon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-ink">
                  {x.judul}
                  {x.baru && <span className="ml-1.5 rounded-full bg-rose px-2 py-0.5 text-[10px] font-black text-white">BARU</span>}
                  {!x.aktif && <span className="ml-1.5 rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-black text-muted">DISEMBUNYIKAN</span>}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted">{x.isi || "—"}</p>
                {x.href && <p className="mt-0.5 truncate text-[11px] text-blue-bright">{x.tombol || "Buka"} → {x.href}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                <button type="button" disabled={sibuk || n === 0} onClick={() => jalan("geser", { id: x.id, arah: "atas" })} className="rounded-lg border border-line px-2 py-1 text-xs font-black disabled:opacity-40" aria-label="Naik">↑</button>
                <button type="button" disabled={sibuk || n === d.item.length - 1} onClick={() => jalan("geser", { id: x.id, arah: "bawah" })} className="rounded-lg border border-line px-2 py-1 text-xs font-black disabled:opacity-40" aria-label="Turun">↓</button>
                <button type="button" disabled={sibuk} onClick={() => jalan("aktif", { id: x.id, aktif: !x.aktif })} className="rounded-lg border border-line px-2 py-1 text-xs font-black" data-testid="pb-toggle">{x.aktif ? "Sembunyikan" : "Tampilkan"}</button>
                <button type="button" onClick={() => setForm({ ...KOSONG, ...x })} className="rounded-lg border border-amber/60 bg-amber-soft px-2 py-1 text-xs font-black text-amber-bright" data-testid="pb-ubah">Ubah</button>
                <button type="button" disabled={sibuk} onClick={() => { if (confirm(`Hapus “${x.judul}”?`)) jalan("hapus", { id: x.id }, "Butir dihapus."); }} className="rounded-lg border border-rose/50 bg-rose-soft px-2 py-1 text-xs font-black text-rose" data-testid="pb-hapus">Hapus</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => window.dispatchEvent(new Event("buka-pembaruan"))} className="btn-3d mt-3 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-black text-ink">👁 Pratinjau popup</button>
      </div>
    </div>
  );
}
