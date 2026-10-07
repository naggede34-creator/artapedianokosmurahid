"use client";

// Dasbor admin "Stor Gmail": koneksi penyedia, untung per room, tutup room manual, setoran (setujui/tolak manual),
// status asli dari penyedia (untuk mencocokkan daftar status di Konfigurasi), dan penarikan saldo Stor.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const tgl = (v) => (v ? new Date(v).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const FILTER = [["semua", "Semua"], ["diterima", "Diperiksa"], ["menunggu-admin", "Menunggu admin"], ["dibayar", "Dibayar"], ["ditolak", "Ditolak"], ["dikirim", "Dikirim"], ["digenerate", "Belum disetor"]];

async function api(url, opsi) {
  const r = await fetch(url, { cache: "no-store", ...opsi });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Gagal (${r.status})`);
  return d;
}
const post = (body) => api("/api/admin/setor-gmail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function AdminSetorGmail() {
  const [d, setD] = useState(null);
  const [status, setStatus] = useState("semua");
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [untung, setUntung] = useState({});

  const muat = useCallback(async (st = status) => {
    try { setD(await api(`/api/admin/setor-gmail?status=${st}`)); setGalat(""); } catch (e) { setGalat(e.message); }
  }, [status]);
  useEffect(() => { muat(); }, [muat]);

  const aksi = async (body, ok) => {
    setPesan(""); setGalat("");
    try { await post(body); setPesan(ok || "Berhasil ✅"); await muat(); } catch (e) { setGalat(e.message); }
  };
  const tes = async () => {
    setPesan(""); setGalat("");
    try { const r = await post({ aksi: "tes" }); setPesan(`Terhubung ✅ — ${r.rooms.length} room dari penyedia.`); await muat(); } catch (e) { setGalat(`Gagal terhubung: ${e.message}`); }
  };
  const r = d?.ringkas;
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6" data-testid="admin-setor-gmail">
      <h1 className="font-display text-2xl font-black text-ink">📧 Stor Gmail</h1>
      <p className="mt-1 text-sm text-muted">Pengguna membuat Gmail sesuai daftar, menyetor lewat penyedia (SetoranGmail), dan dibayar dari saldo Stor yang terpisah. Untungmu = harga room − upah pengguna.</p>
      {galat && <p className="mt-3 rounded-lg bg-rose-soft px-3 py-2 text-sm font-bold text-rose" data-testid="sg-galat">{galat}</p>}
      {pesan && <p className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-sm font-bold text-success" data-testid="sg-pesan">{pesan}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={tes} className="rounded-xl bg-ink px-3 py-2 text-sm font-black text-bg" data-testid="sg-tes">🔌 Tes koneksi penyedia</button>
        <button onClick={() => aksi({ aksi: "sapu" }, "Sinkron selesai ✅")} className="rounded-xl border-2 border-ink/20 px-3 py-2 text-sm font-black" data-testid="sg-sapu">🔄 Sinkron status sekarang</button>
        <Link href="/admin/dashboard?k=integrasi" prefetch={false} className="rounded-xl border-2 border-ink/20 px-3 py-2 text-sm font-black">⚙️ Konfigurasi (API key, untung, WD)</Link>
      </div>
      {d?.galatPenyedia && <p className="mt-3 rounded-lg bg-amber-soft px-3 py-2 text-xs font-bold text-amber-bright" data-testid="sg-galat-penyedia">Penyedia: {d.galatPenyedia} — menu Stor Gmail tertutup untuk pengguna sampai tersambung.</p>}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="sg-statistik">
        {[["Saldo Stor pengguna", rp(r?.saldoPengguna)], ["Upah dibayarkan (total)", rp(r?.upahDibayar)], ["Sudah ditarik", rp(r?.sudahDitarik)], ["Untung tercatat", rp(r?.untungTercatat)]].map(([k, v]) => (
          <div key={k} className="rounded-2xl border-2 border-ink/10 bg-surface p-3"><div className="text-lg font-black text-ink">{r ? v : "…"}</div><div className="text-[11px] font-bold text-muted">{k}</div></div>
        ))}
      </div>

      <section className="mt-5 rounded-2xl border-2 border-ink/10 bg-surface p-4" data-testid="sg-room">
        <h2 className="text-sm font-black uppercase tracking-wide text-muted">Room dari penyedia & untung</h2>
        {!d?.rooms?.length ? <p className="mt-2 text-xs text-muted">Belum ada room (cek API key / koneksi).</p> : (
          <ul className="mt-2 space-y-2">
            {d.rooms.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2 text-xs" data-testid="sg-room-baris">
                <span><b className="text-ink">{x.nama}</b> <span className="text-muted">· harga {rp(x.harga)} · untung {rp(x.untung)} · upah pengguna <b>{rp(x.upah)}</b></span><br /><span className={x.buka ? "font-bold text-success" : "font-bold text-rose"}>{x.buka ? "Buka" : `Tutup — ${x.alasanTutup}`}</span></span>
                <span className="flex items-center gap-1.5">
                  <input value={untung[x.id] ?? ""} onChange={(e) => setUntung({ ...untung, [x.id]: e.target.value.replace(/\D/g, "") })} placeholder={`untung ${x.untung}`} inputMode="numeric" className="w-24 rounded-lg border border-line bg-surface px-2 py-1" data-testid="sg-untung-input" />
                  <button onClick={() => aksi({ aksi: "room", roomId: x.id, untung: untung[x.id] === undefined || untung[x.id] === "" ? null : Number(untung[x.id]) }, "Untung room disimpan ✅")} className="rounded-lg bg-amber px-2.5 py-1 font-black text-white" data-testid="sg-untung-simpan">Simpan</button>
                  <button onClick={() => aksi({ aksi: "room", roomId: x.id, tutup: x.alasanTutup !== "Ditutup admin" ? true : false })} className="rounded-lg border border-line px-2.5 py-1 font-black" data-testid="sg-tutup-room">{x.alasanTutup === "Ditutup admin" ? "Buka" : "Tutup"}</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-muted">Kosongkan kolom lalu Simpan = kembali ke untung bawaan dari Konfigurasi. Room yang ditutup penyedia otomatis ikut tutup di sini.</p>
      </section>

      {r?.statusPenyedia?.length > 0 && (
        <section className="mt-5 rounded-2xl border-2 border-ink/10 bg-surface p-4" data-testid="sg-status-penyedia">
          <h2 className="text-sm font-black uppercase tracking-wide text-muted">Status asli dari penyedia</h2>
          <p className="mt-1 text-xs text-muted">Pastikan tiap status terdaftar di Konfigurasi (diterima / ditolak). Status yang tidak dikenal tidak pernah dibayar otomatis.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{r.statusPenyedia.map((s) => <span key={s.status} className="rounded-full bg-surface2 px-2.5 py-1 text-[11px] font-black text-ink">{s.status || "(kosong)"} · {s.jumlah}</span>)}</div>
        </section>
      )}

      <section className="mt-5" data-testid="sg-setoran">
        <h2 className="text-sm font-black uppercase tracking-wide text-muted">Setoran</h2>
        <div className="no-scrollbar mt-2 flex gap-1 overflow-x-auto">
          {FILTER.map(([id, lb]) => <button key={id} onClick={() => { setStatus(id); muat(id); }} className={`min-w-max rounded-lg px-3 py-1.5 text-xs font-bold ${status === id ? "bg-amber-soft text-amber-bright ring-1 ring-inset ring-amber/40" : "text-muted hover:bg-surface2"}`}>{lb}{r?.perStatus?.[id] ? ` (${r.perStatus[id]})` : ""}</button>)}
        </div>
        <ul className="mt-2 space-y-1.5">
          {!d && !galat && <li className="text-xs text-muted">Memuat…</li>}
          {d?.daftar?.length === 0 && <li className="rounded-xl bg-surface2 p-3 text-center text-xs text-muted" data-testid="sg-kosong">Tidak ada setoran.</li>}
          {d?.daftar?.map((x) => (
            <li key={x.email} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs" data-testid="sg-baris">
              <span className="min-w-0"><b className="font-mono text-ink">{x.email}</b> <span className="text-muted">· {x.token} · {x.room || "-"}</span><br /><span className="text-muted">{x.status}{x.statusPenyedia ? ` (penyedia: ${x.statusPenyedia})` : ""}{x.upah ? ` · upah ${rp(x.upah)}` : ""}{x.untung != null ? ` · untung ${rp(x.untung)}` : ""} · {tgl(x.at)}{x.alasan ? ` · ${x.alasan}` : ""}</span></span>
              {["diterima", "dikirim", "menunggu-admin"].includes(x.status) && (
                <span className="flex gap-1.5">
                  <button onClick={() => aksi({ aksi: "setuju", email: x.email }, "Upah dibayarkan ✅")} className="rounded-lg bg-success px-2.5 py-1 font-black text-white" data-testid="sg-setuju">Bayar</button>
                  <button onClick={() => aksi({ aksi: "tolak", email: x.email, alasan: "Ditolak admin" }, "Setoran ditolak")} className="rounded-lg bg-rose px-2.5 py-1 font-black text-white" data-testid="sg-tolak">Tolak</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-5" data-testid="sg-wd">
        <h2 className="text-sm font-black uppercase tracking-wide text-muted">Penarikan saldo Stor</h2>
        <ul className="mt-2 space-y-1.5">
          {d?.wd?.length === 0 && <li className="text-xs text-muted">Belum ada penarikan.</li>}
          {d?.wd?.map((w) => <li key={w.id} className="rounded-xl border border-line bg-surface px-3 py-2 text-xs"><b>{rp(w.nominal)}</b> → {w.wallet} {w.nomor} · {w.nama || w.token} · <b>{w.status}</b> · {tgl(w.dibuat)}</li>)}
        </ul>
      </section>
    </div>
  );
}
