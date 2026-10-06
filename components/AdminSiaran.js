"use client";

// Pesan siaran ke segmen pengguna (notifikasi lonceng / push web / bot Telegram), dikirim bertahap lewat antrean.
import { useCallback, useEffect, useState } from "react";

const inp = "w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm text-ink";
async function api(path, body) {
  const r = await fetch(path, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Gagal (${r.status})`);
  return j;
}

export default function AdminSiaran() {
  const [f, setF] = useState({ judul: "", isi: "", url: "/", segmen: "semua", param: "50000", notif: true, push: false, bot: false });
  const [d, setD] = useState(null);
  const [hitung, setHitung] = useState(null);
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const muat = useCallback(async () => {
    try { const j = await api(`/api/admin/siaran?segmen=${f.segmen}&param=${f.param || 0}`); setD(j); setHitung(j.hitung ?? null); } catch (e) { setPesan("❌ " + e.message); }
  }, [f.segmen, f.param]);
  useEffect(() => { muat(); }, [muat]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  async function kirim() {
    if (!window.confirm(`Kirim siaran ini ke ±${hitung ?? "?"} pengguna?`)) return;
    setSibuk(true); setPesan("");
    try { const r = await api("/api/admin/siaran", { aksi: "buat", judul: f.judul, isi: f.isi, url: f.url, segmen: f.segmen, param: Number(f.param) || 0, kanal: { notif: f.notif, push: f.push, bot: f.bot } }); setPesan(`✅ Siaran dibuat untuk ${r.total} pengguna — dikirim bertahap.`); setF((x) => ({ ...x, judul: "", isi: "" })); await muat(); }
    catch (e) { setPesan("❌ " + e.message); } finally { setSibuk(false); }
  }
  async function aksi(a, id) { setSibuk(true); try { await api("/api/admin/siaran", { aksi: a, id }); await muat(); } catch (e) { setPesan("❌ " + e.message); } finally { setSibuk(false); } }
  return (
    <section className="rounded-2xl border-2 border-ink/10 bg-surface p-4 shadow-soft sm:p-5" data-testid="siaran">
      <h2 className="font-display text-base font-black text-ink">Pesan siaran ke segmen</h2>
      <div className="mt-3 grid gap-2">
        <input className={inp} value={f.judul} onChange={set("judul")} maxLength={80} placeholder="Judul (mis. Promo akhir pekan)" data-testid="sr-judul" />
        <textarea className={`${inp} h-20`} value={f.isi} onChange={set("isi")} maxLength={400} placeholder="Isi pesan (maks 400 huruf)" data-testid="sr-isi" />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-bold text-ink">Segmen
            <select className={inp} value={f.segmen} onChange={set("segmen")} data-testid="sr-segmen">{Object.entries(d?.segmen || { semua: "Semua pengguna" }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>
          {f.segmen === "saldo_besar" && <label className="text-xs font-bold text-ink">Batas saldo (Rp)<input className={inp} inputMode="numeric" value={f.param} onChange={(e) => setF({ ...f, param: e.target.value.replace(/\D/g, "") })} data-testid="sr-param" /></label>}
          <label className="text-xs font-bold text-ink">Tautan saat diketuk (jalur situs)<input className={inp} value={f.url} onChange={set("url")} placeholder="/deposit" data-testid="sr-url" /></label>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-bold text-ink">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.notif} onChange={set("notif")} data-testid="sr-notif" /> 🔔 Lonceng di web</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.push} onChange={set("push")} data-testid="sr-push" /> 📲 Push web</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.bot} onChange={set("bot")} data-testid="sr-bot" /> 🤖 Bot Telegram</label>
        </div>
        <p className="text-[11px] text-muted" data-testid="sr-hitung">Perkiraan penerima: <b className="text-ink">{hitung ?? "…"}</b> pengguna (akun yang di-ban dilewati).</p>
        <button type="button" disabled={sibuk || f.judul.trim().length < 3 || f.isi.trim().length < 3} onClick={kirim} className="btn-3d w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-black text-bg disabled:opacity-50" data-testid="sr-kirim">📣 Kirim siaran</button>
      </div>
      {pesan && <p className="mt-2 text-xs font-bold text-ink" data-testid="sr-pesan">{pesan}</p>}
      <h3 className="mt-4 text-xs font-black uppercase tracking-wide text-muted">Riwayat siaran</h3>
      <ul className="mt-2 space-y-1.5" data-testid="sr-daftar">
        {(d?.daftar || []).length === 0 && <li className="text-xs text-muted">Belum ada siaran.</li>}
        {(d?.daftar || []).map((s) => (
          <li key={s.id} className="rounded-lg border border-line px-2.5 py-1.5 text-xs" data-testid="sr-baris">
            <div className="flex items-center justify-between gap-2"><b className="truncate">{s.judul}</b><span className={`shrink-0 font-black ${s.status === "selesai" ? "text-success" : s.status === "berjalan" ? "text-amber-bright" : "text-muted"}`}>{s.status}</span></div>
            <p className="text-muted">{s.terkirim}/{s.total} terkirim · {d.segmen[s.segmen] || s.segmen} · {new Date(s.at).toLocaleString("id-ID")}</p>
            {s.status === "berjalan" && (
              <div className="mt-1 flex gap-2">
                <button type="button" disabled={sibuk} onClick={() => aksi("proses")} className="rounded-lg border border-line px-2 py-0.5 text-[11px] font-bold" data-testid="sr-proses">▶ Proses sekarang</button>
                <button type="button" disabled={sibuk} onClick={() => aksi("batal", s.id)} className="rounded-lg border border-rose/40 px-2 py-0.5 text-[11px] font-bold text-rose" data-testid="sr-batal">Hentikan</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
