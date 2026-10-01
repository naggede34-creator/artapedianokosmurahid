"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/app/providers";

const MEDALI = ["🥇", "🥈", "🥉"];
const sisa = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)); const h = Math.floor(m / 60), d = Math.floor(h / 24); return d > 0 ? `${d} hari ${h % 24} jam` : `${h} jam ${m % 60} mnt`; };

async function panggil(url, body) {
  const r = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok && !d.error, data: d, error: d.error };
}

function Papan({ judul, baris }) {
  return (
    <section className="card p-4" data-testid="klan-papan">
      <h3 className="mb-2 text-sm font-extrabold text-ink">{judul}</h3>
      {baris.length === 0 ? <p className="text-xs text-muted">Belum ada skor. Selesaikan misi untuk naik peringkat!</p> : (
        <ol className="space-y-1.5">
          {baris.map((b) => (
            <li key={b.klanId} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${b.saya ? "border-amber bg-amber-soft" : "border-line bg-surface"}`}>
              <b className="w-7 text-center">{MEDALI[b.peringkat - 1] || b.peringkat}</b>
              <span className="min-w-0 flex-1 truncate font-bold text-ink">[{b.tag}] {b.nama}<small className="ml-1 font-normal text-muted">{b.jumlah} anggota</small></span>
              <span className="font-mono text-xs font-bold text-amber-bright">{b.skor.toLocaleString("id-ID")}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function KlanPage() {
  const { token, ready } = useUser();
  const [d, setD] = useState(null);
  const [pesan, setPesan] = useState({ t: "", ok: true });
  const [form, setForm] = useState({ nama: "", tag: "", deskripsi: "" });
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    if (!token) return;
    const r = await panggil(`/api/klan?token=${encodeURIComponent(token)}`);
    if (r.ok) setD(r.data); else setPesan({ t: r.error || "Gagal memuat klan.", ok: false });
  }, [token]);
  useEffect(() => { if (ready) muat(); }, [ready, muat]);

  const aksi = async (body, ok) => {
    setSibuk(true);
    const r = await panggil("/api/klan", { ...body, token });
    setSibuk(false);
    setPesan({ t: r.ok ? ok : r.error || "Gagal.", ok: r.ok });
    if (r.ok) await muat();
    return r;
  };

  const s = d?.saya;
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">🛡 Klan</h1>
        <p className="mt-1 text-sm text-muted">Bentuk tim, ngobrol di grup klan, selesaikan misi bersama, dan naik papan peringkat.</p>
      </div>
      {pesan.t && <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${pesan.ok ? "border border-success/30 bg-success/10 text-success" : "border border-rose/30 bg-rose-soft text-rose"}`} data-testid="klan-pesan">{pesan.t}</div>}
      {!d && !pesan.t && <div className="skeleton h-40 rounded-2xl" />}
      {d && !d.aktif && <p className="rounded-xl bg-surface2 p-3 text-sm text-muted">Fitur klan sedang dinonaktifkan admin.</p>}

      {s && (
        <>
          <section className="card p-4" data-testid="klan-saya">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-extrabold text-ink">[{s.tag}] {s.nama}</p>
                <p className="text-xs text-muted">{s.jumlah}/{d.maks} anggota · skor minggu ini <b>{s.skorMinggu}</b> · total <b>{s.skorTotal}</b></p>
                {s.deskripsi && <p className="mt-1 text-sm text-ink">{s.deskripsi}</p>}
              </div>
              <Link href={`/chat?room=${encodeURIComponent(s.roomId)}`} className="btn-3d press shrink-0 rounded-xl bg-amber px-3 py-2 text-xs font-bold text-white" data-testid="klan-chat">💬 Grup Klan</Link>
            </div>
          </section>

          <section className="card p-4" data-testid="klan-misi">
            <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-extrabold text-ink">Misi bersama minggu ini</h3><span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-muted">reset {sisa(d.minggu.sisaMs)} lagi</span></div>
            <div className="space-y-3">
              {s.misi.map((m) => {
                const pct = Math.min(100, Math.round((m.progres / m.target) * 100));
                return (
                  <div key={m.id}>
                    <div className="flex justify-between text-xs"><span className="font-semibold text-ink">{m.ikon} {m.judul}</span><span className="font-mono font-bold">{Math.min(m.progres, m.target)}/{m.target}{m.selesai ? " ✅" : ""}</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-gradient-to-r from-amber to-amber-bright" style={{ width: `${pct}%` }} /></div>
                    <p className="mt-0.5 text-[11px] text-muted">Hadiah penyumbang: +{m.poin} poin toko</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card p-4">
            <h3 className="mb-2 text-sm font-extrabold text-ink">Anggota</h3>
            <ul className="space-y-1.5">
              {s.anggota.map((a) => (
                <li key={a.pid} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                  <span className="flex-1 truncate font-semibold text-ink">{a.ketua ? "👑 " : ""}{a.nama}</span>
                  <span className="text-xs text-muted">{a.sumbangan} sumbangan</span>
                  {s.peran === "ketua" && !a.ketua && <button className="rounded-lg border border-rose px-2 py-0.5 text-[11px] font-bold text-rose" onClick={() => confirm(`Keluarkan ${a.nama}?`) && aksi({ aksi: "keluarkan", pid: a.pid }, "Anggota dikeluarkan")}>Keluarkan</button>}
                </li>
              ))}
            </ul>
            <button disabled={sibuk} className="mt-3 text-xs font-bold text-rose underline" data-testid="klan-keluar" onClick={() => confirm("Keluar dari klan?") && aksi({ aksi: "keluar" }, "Kamu sudah keluar dari klan")}>Keluar dari klan</button>
          </section>
        </>
      )}

      {d && d.aktif && !s && (
        <>
          <section className="card p-4" data-testid="klan-buat">
            <h3 className="mb-2 text-sm font-extrabold text-ink">Buat klan baru</h3>
            <div className="grid grid-cols-3 gap-2">
              <input className="field col-span-2" placeholder="Nama klan" maxLength={24} value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} data-testid="klan-nama" />
              <input className="field uppercase" placeholder="TAG" maxLength={5} value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} data-testid="klan-tag" />
              <input className="field col-span-3" placeholder="Deskripsi singkat (opsional)" maxLength={120} value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} />
            </div>
            <button disabled={sibuk} className="btn-3d press mt-3 w-full rounded-xl bg-amber py-2.5 text-sm font-bold text-white disabled:opacity-60" data-testid="klan-buat-btn" onClick={() => aksi({ aksi: "buat", ...form }, "Klan dibuat! 🎉")}>Buat klan</button>
          </section>
          <section className="card p-4" data-testid="klan-daftar">
            <h3 className="mb-2 text-sm font-extrabold text-ink">Gabung klan</h3>
            {d.bukaGabung.length === 0 ? <p className="text-xs text-muted">Belum ada klan terbuka. Jadilah pembuat pertama!</p> : (
              <ul className="space-y-1.5">
                {d.bukaGabung.map((k) => (
                  <li key={k.klanId} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1"><b className="text-ink">[{k.tag}] {k.nama}</b><small className="block truncate text-muted">{k.jumlah} anggota{k.deskripsi ? ` · ${k.deskripsi}` : ""}</small></span>
                    <button disabled={sibuk} className="btn-3d press rounded-lg bg-amber px-3 py-1.5 text-xs font-bold text-white" data-testid="klan-gabung" onClick={() => aksi({ aksi: "gabung", klanId: k.klanId }, `Bergabung ke ${k.nama}!`)}>Gabung</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {d && <Papan judul="🏆 Klan teratas minggu ini" baris={d.papanMinggu} />}
      {d && <Papan judul="👑 Klan teratas sepanjang masa" baris={d.papanTotal} />}
      <p className="text-[11px] text-muted">Skor klan: menang duel Arena +3 · duel +1 · beli OTP +2 · deposit +3. Hadiah misi berupa poin toko, bukan uang tunai.</p>
    </div>
  );
}
