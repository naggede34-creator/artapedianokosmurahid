"use client";

// Kelola akun admin tambahan + peran (khusus Owner = kode admin utama).
import { useCallback, useEffect, useState } from "react";

const inp = "w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm text-ink";
async function api(body) {
  const r = await fetch("/api/admin/akun-admin", { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Gagal (${r.status})`);
  return j;
}

export default function AdminAkun() {
  const [d, setD] = useState(null);
  const [galat, setGalat] = useState("");
  const [f, setF] = useState({ nama: "", peran: "cs", kode: "" });
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback(async () => { try { setD(await api()); setGalat(""); } catch (e) { setGalat(e.message); } }, []);
  useEffect(() => { muat(); }, [muat]);
  async function kirim(body, ok = "") { setSibuk(true); try { await api(body); setGalat(ok); await muat(); } catch (e) { setGalat("❌ " + e.message); } finally { setSibuk(false); } }
  if (galat && !d) return <p className="rounded-xl border border-rose/30 bg-rose-soft px-3 py-2 text-xs font-bold text-rose" data-testid="akun-galat">{galat}</p>;
  return (
    <section className="rounded-2xl border-2 border-ink/10 bg-surface p-4 shadow-soft sm:p-5" data-testid="akun-admin">
      <h2 className="font-display text-base font-black text-ink">Akun admin & peran</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">Kode admin utama = <b>Owner</b> (akses penuh). Akun tambahan punya kode sendiri dan hanya bisa memakai fitur sesuai perannya; pengaturan sensitif (konfigurasi, API key, backup) tetap khusus Owner.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <input className={inp} value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} maxLength={40} placeholder="Nama (mis. Budi CS)" data-testid="ak-nama" />
        <select className={inp} value={f.peran} onChange={(e) => setF({ ...f, peran: e.target.value })} data-testid="ak-peran">
          {Object.entries(d?.peran || {}).filter(([k]) => k !== "owner").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input className={inp} type="password" autoComplete="new-password" value={f.kode} onChange={(e) => setF({ ...f, kode: e.target.value })} placeholder="Kode masuk (min 8)" data-testid="ak-kode" />
      </div>
      <button type="button" disabled={sibuk || f.nama.trim().length < 2 || f.kode.length < 8} onClick={() => kirim({ aksi: "tambah", ...f }, "✅ Akun ditambahkan.").then(() => setF((x) => ({ ...x, nama: "", kode: "" })))} className="btn-3d mt-2 w-full rounded-xl bg-ink px-4 py-2 text-sm font-black text-bg disabled:opacity-50" data-testid="ak-tambah">+ Tambah akun admin</button>
      {galat && <p className="mt-2 text-xs font-bold text-ink" data-testid="akun-pesan">{galat}</p>}
      <ul className="mt-3 space-y-1.5" data-testid="ak-daftar">
        {(d?.akun || []).length === 0 && <li className="text-xs text-muted">Belum ada akun tambahan.</li>}
        {(d?.akun || []).map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5 text-xs" data-testid="ak-baris">
            <span><b>{a.nama}</b> · {a.peran}{a.aktif ? "" : " · NONAKTIF"}{a.masukAt ? ` · masuk ${new Date(a.masukAt).toLocaleDateString("id-ID")}` : ""}</span>
            <span className="flex gap-1.5">
              <button type="button" disabled={sibuk} onClick={() => kirim({ aksi: "ubah", id: a.id, aktif: !a.aktif })} className="rounded-lg border border-line px-2 py-0.5 font-bold" data-testid="ak-aktif">{a.aktif ? "Nonaktifkan" : "Aktifkan"}</button>
              <button type="button" disabled={sibuk} onClick={() => { const k = window.prompt("Kode baru (min 8 karakter):"); if (k) kirim({ aksi: "ubah", id: a.id, kode: k }, "✅ Kode diganti."); }} className="rounded-lg border border-line px-2 py-0.5 font-bold">Ganti kode</button>
              <button type="button" disabled={sibuk} onClick={() => { if (window.confirm(`Hapus akun ${a.nama}?`)) kirim({ aksi: "hapus", id: a.id }); }} className="rounded-lg border border-rose/40 px-2 py-0.5 font-bold text-rose" data-testid="ak-hapus">Hapus</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
