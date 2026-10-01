"use client";

// Dasbor admin "Popup & Tampilan": (1) popup untuk pengguna — tambah / ubah / hapus, foto unggahan, teks, judul, tombol ke dasbor;
// (2) tampilan layar akun di-ban — judul, teks, foto, latar, tombol, dan HTML kustom (disandbox), dengan pratinjau langsung.
import { useCallback, useEffect, useRef, useState } from "react";
import { TAUTAN_DASBOR } from "@/lib/tautanDasbor";
import { LayarBanView } from "@/components/LayarBan";

const tgl = (v) => (v ? new Date(v).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const input = "w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm text-ink";

async function api(url, opsi) {
  const r = await fetch(url, { cache: "no-store", ...opsi });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Gagal (${r.status})`);
  return d;
}
const post = (url, body) => api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Foto dikecilkan di browser (maks 900 px) supaya ringan dimuat semua pengguna.
function pilihFoto(file, onDone, onErr) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) return onErr("Ukuran foto maksimal 10 MB.");
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new window.Image();
    img.onload = () => {
      const rasio = Math.min(900 / img.width, 900 / img.height, 1);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * rasio); c.height = Math.round(img.height * rasio);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      let out = c.toDataURL("image/webp", 0.85);
      if (out.length > 1_300_000) out = c.toDataURL("image/jpeg", 0.7);
      if (out.length > 1_400_000) return onErr("Foto masih terlalu besar. Pakai gambar yang lebih kecil.");
      onDone(out);
    };
    img.onerror = () => onErr("Berkas itu bukan gambar yang bisa dibaca.");
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

const KOSONG = { id: "", judul: "", teks: "", gambar: "", tombolTeks: "", tombolHref: "", frekuensi: "sekali", urutan: 0, mulai: "", selesai: "", aktif: true };
const kelokal = (v) => { if (!v) return ""; const d = new Date(v); if (Number.isNaN(d.getTime())) return ""; const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

function TujuanTombol({ nilai, onUbah }) {
  const dalamDaftar = TAUTAN_DASBOR.some((t) => t.href === nilai);
  const [lain, setLain] = useState(!!nilai && !dalamDaftar);
  return (
    <div className="space-y-1.5">
      <select value={lain ? "__lain" : nilai} onChange={(e) => { if (e.target.value === "__lain") { setLain(true); onUbah(""); } else { setLain(false); onUbah(e.target.value); } }} className={input} aria-label="Tujuan tombol" data-testid="tampil-tujuan">
        <option value="">— tanpa tombol —</option>
        {TAUTAN_DASBOR.map((t) => <option key={t.href} value={t.href}>{t.label} ({t.href})</option>)}
        <option value="__lain">Alamat lain…</option>
      </select>
      {lain && <input value={nilai} onChange={(e) => onUbah(e.target.value)} placeholder="/halaman atau https://…" className={input} data-testid="tampil-tujuan-lain" />}
    </div>
  );
}

function PratinjauPopup({ f }) {
  return (
    <div className="mx-auto w-full max-w-xs overflow-hidden rounded-3xl border-2 border-ink/15 bg-surface shadow-lift" data-testid="popup-pratinjau">
      {f.gambar && /* eslint-disable-next-line @next/next/no-img-element */ <img src={f.gambar} alt="" className="max-h-48 w-full object-cover" />}
      <div className="p-4 text-center">
        {f.judul && <h3 className="font-display text-xl leading-tight text-ink">{f.judul}</h3>}
        {f.teks && <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-muted">{f.teks}</p>}
        {!f.judul && !f.teks && !f.gambar && <p className="text-xs text-muted">Pratinjau muncul di sini.</p>}
      </div>
      <div className="space-y-1.5 border-t border-line p-3">
        {f.tombolTeks && f.tombolHref && <div className="rounded-xl bg-blue py-2 text-center text-xs font-black uppercase tracking-wide text-white">{f.tombolTeks}</div>}
        <div className="text-center text-[11px] font-bold text-muted">{f.tombolTeks && f.tombolHref ? "Nanti saja" : "Mengerti, tutup"}</div>
      </div>
    </div>
  );
}

function ManajerPopup() {
  const [items, setItems] = useState(null);
  const [f, setF] = useState(null); // null = tidak mengedit
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const berkas = useRef(null);

  const muat = useCallback(async () => { try { setItems((await api("/api/admin/popup")).items); } catch (e) { setGalat(e.message); } }, []);
  useEffect(() => { muat(); }, [muat]);

  const simpan = async () => {
    setSibuk(true); setGalat(""); setPesan("");
    try {
      await post("/api/admin/popup", { aksi: "simpan", ...f, mulai: f.mulai || null, selesai: f.selesai || null });
      setPesan(f.id ? "Popup diperbarui ✅" : "Popup dibuat ✅"); setF(null); await muat();
    } catch (e) { setGalat(e.message); }
    setSibuk(false);
  };
  const aksi = async (a, id, ok) => { setGalat(""); setPesan(""); try { await post("/api/admin/popup", { aksi: a, id }); setPesan(ok); await muat(); } catch (e) { setGalat(e.message); } };

  return (
    <section className="rounded-2xl border-2 border-ink/10 bg-surface p-4" data-testid="manajer-popup">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-lg font-black text-ink">🪟 Popup untuk pengguna</h2><p className="text-xs text-muted">Muncul di layar pengguna setelah popup pembuka bawaan. Bisa pakai foto, judul, teks, dan tombol ke dasbor mana pun.</p></div>
        {!f && <button onClick={() => { setF({ ...KOSONG }); setPesan(""); setGalat(""); }} className="rounded-xl bg-amber px-3 py-2 text-sm font-black text-white" data-testid="popup-tambah">＋ Tambah popup</button>}
      </div>
      {galat && <p className="mt-3 rounded-lg bg-rose-soft px-3 py-2 text-xs font-bold text-rose" data-testid="popup-galat">{galat}</p>}
      {pesan && <p className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-xs font-bold text-success" data-testid="popup-pesan">{pesan}</p>}

      {f && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]" data-testid="popup-form">
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-muted">Judul<input value={f.judul} onChange={(e) => setF({ ...f, judul: e.target.value })} maxLength={120} className={input} data-testid="popup-judul" /></label>
            <label className="block text-xs font-bold text-muted">Teks<textarea value={f.teks} onChange={(e) => setF({ ...f, teks: e.target.value })} rows={4} maxLength={1500} className={input} data-testid="popup-teks" /></label>
            <div>
              <p className="text-xs font-bold text-muted">Foto (unggah)</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input ref={berkas} type="file" accept="image/*" onChange={(e) => pilihFoto(e.target.files?.[0], (d) => setF((x) => ({ ...x, gambar: d })), setGalat)} className="text-xs" data-testid="popup-foto" />
                {f.gambar && <button onClick={() => { setF({ ...f, gambar: "" }); if (berkas.current) berkas.current.value = ""; }} className="rounded-lg border border-line px-2 py-1 text-xs font-bold" data-testid="popup-foto-hapus">Hapus foto</button>}
              </div>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <label className="block text-xs font-bold text-muted">Teks tombol<input value={f.tombolTeks} onChange={(e) => setF({ ...f, tombolTeks: e.target.value })} maxLength={40} placeholder="mis. Buka Stor Gmail" className={input} data-testid="popup-tombol-teks" /></label>
              <div className="text-xs font-bold text-muted">Tombol mengarah ke<TujuanTombol nilai={f.tombolHref} onUbah={(v) => setF((x) => ({ ...x, tombolHref: v }))} /></div>
              <label className="block text-xs font-bold text-muted">Frekuensi tampil
                <select value={f.frekuensi} onChange={(e) => setF({ ...f, frekuensi: e.target.value })} className={input} data-testid="popup-frekuensi"><option value="sekali">Sekali saja (per pengguna)</option><option value="hari">Sekali sehari</option><option value="sesi">Setiap membuka web</option></select></label>
              <label className="block text-xs font-bold text-muted">Urutan (kecil = lebih dulu)<input type="number" min={0} max={999} value={f.urutan} onChange={(e) => setF({ ...f, urutan: e.target.value })} className={input} /></label>
              <label className="block text-xs font-bold text-muted">Mulai tampil (opsional)<input type="datetime-local" value={kelokal(f.mulai)} onChange={(e) => setF({ ...f, mulai: e.target.value ? new Date(e.target.value).toISOString() : "" })} className={input} /></label>
              <label className="block text-xs font-bold text-muted">Berakhir (opsional)<input type="datetime-local" value={kelokal(f.selesai)} onChange={(e) => setF({ ...f, selesai: e.target.value ? new Date(e.target.value).toISOString() : "" })} className={input} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={f.aktif} onChange={(e) => setF({ ...f, aktif: e.target.checked })} /> Aktif (tampil ke pengguna)</label>
            <div className="flex gap-2">
              <button disabled={sibuk} onClick={simpan} className="rounded-xl bg-success px-4 py-2 text-sm font-black text-white disabled:opacity-60" data-testid="popup-simpan">{f.id ? "Simpan perubahan" : "Buat popup"}</button>
              <button onClick={() => setF(null)} className="rounded-xl border border-line px-4 py-2 text-sm font-bold" data-testid="popup-batal">Batal</button>
            </div>
          </div>
          <PratinjauPopup f={f} />
        </div>
      )}

      <ul className="mt-4 space-y-2" data-testid="popup-daftar">
        {!items && !galat && <li className="text-xs text-muted">Memuat…</li>}
        {items?.length === 0 && <li className="rounded-xl bg-surface2 p-3 text-center text-xs text-muted" data-testid="popup-kosong">Belum ada popup.</li>}
        {items?.map((p) => (
          <li key={p.id} className={`flex flex-wrap items-center gap-3 rounded-xl border bg-bg p-2.5 ${p.aktif ? "border-line" : "border-line opacity-60"}`} data-testid="popup-baris">
            {p.gambar ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.gambar} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-surface2 text-2xl">🪟</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-ink">{p.judul || "(tanpa judul)"} <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-black ${p.aktif ? "bg-success-soft text-success" : "bg-surface2 text-muted"}`}>{p.aktif ? "AKTIF" : "NONAKTIF"}</span></p>
              <p className="truncate text-[11px] text-muted">{p.tombolTeks ? `Tombol “${p.tombolTeks}” → ${p.tombolHref}` : "Tanpa tombol"} · {p.frekuensi === "sekali" ? "sekali" : p.frekuensi === "hari" ? "sekali sehari" : "tiap buka web"}{p.mulai ? ` · mulai ${tgl(p.mulai)}` : ""}{p.selesai ? ` · sampai ${tgl(p.selesai)}` : ""}</p>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => aksi("toggle", p.id, p.aktif ? "Popup dinonaktifkan" : "Popup diaktifkan ✅")} className="rounded-lg border border-line px-2.5 py-1 text-xs font-bold" data-testid="popup-toggle">{p.aktif ? "Matikan" : "Aktifkan"}</button>
              <button onClick={() => { setF({ ...KOSONG, ...p }); setPesan(""); setGalat(""); }} className="rounded-lg bg-amber px-2.5 py-1 text-xs font-black text-white" data-testid="popup-edit">Edit</button>
              <button onClick={() => { if (confirm("Hapus popup ini?")) aksi("hapus", p.id, "Popup dihapus"); }} className="rounded-lg bg-rose px-2.5 py-1 text-xs font-black text-white" data-testid="popup-hapus">Hapus</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EditorBan() {
  const [c, setC] = useState(null);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback(async () => { try { setC(await api("/api/admin/tampilan-ban")); } catch (e) { setGalat(e.message); } }, []);
  useEffect(() => { muat(); }, [muat]);
  if (!c) return <section className="rounded-2xl border-2 border-ink/10 bg-surface p-4 text-xs text-muted">{galat || "Memuat…"}</section>;
  const set = (k, v) => setC((x) => ({ ...x, [k]: v }));
  const simpan = async () => { setSibuk(true); setGalat(""); setPesan(""); try { await post("/api/admin/tampilan-ban", { aksi: "simpan", ...c }); setPesan("Tampilan layar ban disimpan ✅"); await muat(); } catch (e) { setGalat(e.message); } setSibuk(false); };
  const reset = async () => { if (!confirm("Kembalikan ke tampilan bawaan (satu kalimat saja)?")) return; try { await post("/api/admin/tampilan-ban", { aksi: "reset" }); setPesan("Dikembalikan ke bawaan ✅"); await muat(); } catch (e) { setGalat(e.message); } };
  const pr = { ...c, gambar: c.gambar, gambarLatar: c.gambarLatar };
  return (
    <section className="rounded-2xl border-2 border-ink/10 bg-surface p-4" data-testid="editor-ban">
      <h2 className="text-lg font-black text-ink">🚫 Tampilan layar akun di-ban</h2>
      <p className="text-xs text-muted">Ini yang dilihat pengguna yang di-ban (dan IP yang diblokir). Kosong / nonaktif = bawaan: satu kalimat saja tanpa tombol.</p>
      {galat && <p className="mt-3 rounded-lg bg-rose-soft px-3 py-2 text-xs font-bold text-rose" data-testid="ban-galat">{galat}</p>}
      {pesan && <p className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-xs font-bold text-success" data-testid="ban-pesan">{pesan}</p>}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2.5">
          <label className="flex items-center gap-2 text-sm font-bold text-ink"><input type="checkbox" checked={!!c.aktif} onChange={(e) => set("aktif", e.target.checked)} data-testid="ban-aktif" /> Pakai tampilan kustom</label>
          <label className="block text-xs font-bold text-muted">Judul<input value={c.judul} onChange={(e) => set("judul", e.target.value)} maxLength={160} className={input} data-testid="ban-in-judul" /></label>
          <label className="block text-xs font-bold text-muted">Teks<textarea value={c.teks} onChange={(e) => set("teks", e.target.value)} rows={3} maxLength={1500} className={input} data-testid="ban-in-teks" /></label>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="text-xs font-bold text-muted">Foto utama
              <input type="file" accept="image/*" onChange={(e) => pilihFoto(e.target.files?.[0], (d) => set("gambar", d), setGalat)} className="mt-1 block text-[11px]" data-testid="ban-foto" />
              {c.gambar && <button onClick={() => set("gambar", "")} className="mt-1 rounded-lg border border-line px-2 py-0.5 text-[11px]">Hapus</button>}</div>
            <div className="text-xs font-bold text-muted">Foto latar belakang
              <input type="file" accept="image/*" onChange={(e) => pilihFoto(e.target.files?.[0], (d) => set("gambarLatar", d), setGalat)} className="mt-1 block text-[11px]" data-testid="ban-foto-latar" />
              {c.gambarLatar && <button onClick={() => set("gambarLatar", "")} className="mt-1 rounded-lg border border-line px-2 py-0.5 text-[11px]">Hapus</button>}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["latar1", "Latar (tengah)"], ["latar2", "Latar (tepi)"], ["warnaTeks", "Warna teks"], ["warnaJudul", "Warna judul/tombol"]].map(([k, lb]) => (
              <label key={k} className="block text-[11px] font-bold text-muted">{lb}<input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c[k]) ? c[k] : "#000000"} onChange={(e) => set(k, e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-line bg-bg" data-testid={`ban-${k}`} /></label>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs font-bold text-muted">Teks tombol<input value={c.tombolTeks} onChange={(e) => set("tombolTeks", e.target.value)} maxLength={40} className={input} data-testid="ban-tombol-teks" /></label>
            <div className="text-xs font-bold text-muted">Tombol mengarah ke<TujuanTombol nilai={c.tombolHref} onUbah={(v) => set("tombolHref", v)} /></div>
          </div>
          <label className="block text-xs font-bold text-muted">HTML kustom (opsional — ditampilkan di bingkai aman tanpa skrip)
            <textarea value={c.html} onChange={(e) => set("html", e.target.value)} rows={6} maxLength={20000} spellCheck={false} placeholder={'<div style="color:#fff;text-align:center"><h2>Pengumuman</h2></div>'} className={`${input} font-mono text-xs`} data-testid="ban-html-in" /></label>
          <label className="block text-xs font-bold text-muted">Tinggi bingkai HTML (px)<input type="number" min={80} max={900} value={c.htmlTinggi} onChange={(e) => set("htmlTinggi", e.target.value)} className={input} /></label>
          <p className="text-[11px] text-muted">Skrip (&lt;script&gt;, onclick, dll.) tidak dijalankan demi keamanan. Gaya CSS & gambar tetap bekerja.</p>
          <div className="flex gap-2">
            <button disabled={sibuk} onClick={simpan} className="rounded-xl bg-success px-4 py-2 text-sm font-black text-white disabled:opacity-60" data-testid="ban-simpan">Simpan</button>
            <button onClick={reset} className="rounded-xl border border-line px-4 py-2 text-sm font-bold" data-testid="ban-reset">Kembalikan bawaan</button>
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-bold text-muted">Pratinjau langsung</p>
          <div className="overflow-hidden rounded-2xl border-2 border-ink/15" data-testid="ban-pratinjau-kotak"><LayarBanView cfg={{ ...pr, aktif: true }} tertanam /></div>
        </div>
      </div>
    </section>
  );
}

export default function AdminTampilan() {
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 pb-16 pt-6" data-testid="admin-tampilan">
      <div><h1 className="font-display text-2xl font-black text-ink">🎨 Popup & Tampilan</h1><p className="mt-1 text-sm text-muted">Atur apa yang muncul di layar pengguna: popup pengumuman dan layar akun di-ban.</p></div>
      <ManajerPopup />
      <EditorBan />
    </div>
  );
}
