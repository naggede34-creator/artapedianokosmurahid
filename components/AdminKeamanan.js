"use client";

// Kartu admin: status keamanan otomatis, kejadian terbaru, tombol pindai sekarang, dan saklar cepat.
import { useCallback, useEffect, useState } from "react";

const WARNA = { info: "bg-surface2 text-muted", sedang: "bg-amber-soft text-amber-bright", tinggi: "bg-rose-soft text-rose", kritis: "bg-rose text-white" };
const waktu = (d) => (d ? new Date(d).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "—");

export default function AdminKeamanan() {
  const [d, setD] = useState(null);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState("");

  const muat = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/keamanan", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal memuat.");
      setD(j); setGalat("");
    } catch (e) { setGalat(e.message); }
  }, []);
  useEffect(() => { muat(); const t = setInterval(muat, 30000); return () => clearInterval(t); }, [muat]);

  async function pindai() {
    setSibuk("pindai"); setInfo(""); setGalat("");
    try {
      const r = await fetch("/api/admin/keamanan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "pindai" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal.");
      setInfo(`Selesai: ${j.flagged} temuan, ${j.ditangguhkan} akun dibekukan.`);
      await muat();
    } catch (e) { setGalat(e.message); } finally { setSibuk(""); }
  }
  async function saklar(nama, nyalakan) {
    setSibuk(nama);
    try {
      const r = await fetch("/api/admin/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi: "simpan", nama, nilai: nyalakan ? "1" : "0" }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal.");
      await muat();
    } catch (e) { setGalat(e.message); } finally { setSibuk(""); }
  }

  if (!d) return <div className="card p-4 text-sm text-muted">{galat || "Memuat keamanan…"}</div>;
  const Sak = ({ nama, nilai, judul, ket }) => (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface p-3">
      <div className="min-w-0"><b className="block text-xs text-ink">{judul}</b><span className="text-[11px] leading-snug text-muted">{ket}</span></div>
      <button type="button" role="switch" aria-checked={nilai} aria-label={judul} disabled={sibuk === nama} onClick={() => saklar(nama, !nilai)} className={`btn-3d relative h-7 w-12 shrink-0 rounded-full transition-colors ${nilai ? "bg-teal" : "bg-rose"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${nilai ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
  return (
    <div className="card p-4" data-testid="admin-keamanan">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-extrabold text-ink">🛡️ Keamanan Otomatis</h3>
        <button type="button" onClick={pindai} disabled={sibuk === "pindai"} className="btn-3d rounded-lg bg-amber px-3 py-2 text-xs font-black text-white disabled:opacity-60" data-testid="keamanan-pindai">{sibuk === "pindai" ? "Memindai…" : "🔍 Pindai sekarang"}</button>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">Gerbang otomatis memblokir pemindai kerentanan & banjir permintaan; sistem memindai pola mencurigakan tiap ±10 menit dan membekukan akun yang jelas melanggar. Temuan dikabari ke Telegram admin.</p>
      {galat && <p className="mt-3 rounded-lg bg-rose-soft px-3 py-2 text-xs font-bold text-rose">{galat}</p>}
      {info && <p className="mt-3 rounded-lg bg-teal-soft px-3 py-2 text-xs font-bold text-teal-bright">{info}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Temuan berat 24 jam", d.tinggi24jam], ["Login admin gagal 24 jam", d.loginGagal24jam], ["Akun dibekukan 24 jam", d.suspend24jam], ["Ban anti-curang game 7 hari", d.game?.ban7hari ?? 0]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-surface p-3 text-center"><b className="block text-xl text-ink">{v}</b><span className="text-[11px] text-muted">{k}</span></div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">Pemindaian terakhir: {waktu(d.pemindaianTerakhir)}{d.hasilTerakhir ? ` · ${d.hasilTerakhir.flagged} temuan` : ""}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Sak nama="KEAMANAN_OTOMATIS" nilai={d.aktif} judul="Pemindaian otomatis" ket="Memindai OTP/deposit/transfer janggal & banyak akun satu perangkat." />
        <Sak nama="KEAMANAN_SUSPEND_OTOMATIS" nilai={d.suspendAktif} judul="Bekukan otomatis" ket="Temuan tingkat tinggi langsung membekukan akun; mati = hanya dikabari." />
      </div>
      <h4 className="mt-4 text-sm font-extrabold text-ink">Kejadian terbaru</h4>
      <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
        {d.terbaru.length === 0 && <p className="text-xs text-muted">Belum ada kejadian. Bagus! 🎉</p>}
        {d.terbaru.map((e, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs">
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${WARNA[e.tingkat] || WARNA.info}`}>{e.tingkat}</span>
            <span className="min-w-0 flex-1"><b className="text-ink">{e.jenis}</b>{e.token ? <> · <code>{e.token}</code></> : null}{e.ip ? <> · {e.ip}</> : null}<br /><span className="text-muted">{e.detail}</span></span>
            <span className="shrink-0 text-[10px] text-muted">{waktu(e.at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
