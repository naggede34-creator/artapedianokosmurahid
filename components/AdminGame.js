"use client";

// Tab Game di dasbor admin: ringkasan duel, uang yang berputar, potongan, dan
// tombol membatalkan duel yang macet (taruhan dikembalikan ke kedua pemain).
// Pengaturan (aktif/mati, taruhan, batas, potongan) ada di tab Konfigurasi → Website.
import { useCallback, useEffect, useState } from "react";

const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const NAMA = { catur: "♟ Catur", uno: "🃏 UNO", remi: "🂡 Remi", mahjong: "🀄 Mahjong" };
const STATUS = { menunggu: "Menunggu lawan", gabung: "Bergabung", main: "Berjalan", selesai: "Selesai", batal: "Batal" };

export default function AdminGame() {
  const [d, setD] = useState(null);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [sibuk, setSibuk] = useState("");

  const muat = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/game", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal memuat.");
      setD(j);
      setGalat("");
    } catch (e) { setGalat(e.message); }
  }, []);
  useEffect(() => { muat(); const t = setInterval(muat, 15000); return () => clearInterval(t); }, [muat]);

  async function kirim(aksi, id) {
    setSibuk(id || aksi);
    setInfo(""); setGalat("");
    try {
      const r = await fetch("/api/admin/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi, id }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal.");
      setInfo(aksi === "batalkan" ? "Duel dibatalkan, taruhan dikembalikan." : `Penyapu selesai (${j.diproses ?? 0} diproses).`);
      await muat();
    } catch (e) { setGalat(e.message); } finally { setSibuk(""); }
  }

  const Kotak = ({ label, nilai, warna = "text-ink" }) => (
    <div className="rounded-2xl border border-line bg-surface2/50 p-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold tabular-nums ${warna}`}>{nilai}</p>
    </div>
  );

  return (
    <div className="mt-5 space-y-4">
      <div className="card p-4">
        <h3 className="text-base font-extrabold text-ink">🎮 Duel permainan</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          UNO, Remi, Mahjong, dan Catur antar pengguna. Saldo taruhan dipotong lewat pembaruan atomik yang tidak bisa mengembalikan/membayar dua kali;
          seri atau batal mengembalikan taruhan utuh. Saklar, batas taruhan, dan potongan admin diatur di <b>Konfigurasi → Website</b> (GAME_*).
          Catatan: taruhan uang sungguhan punya risiko hukum di banyak tempat — matikan <b>GAME_TARUHAN_AKTIF</b> bila perlu.
        </p>
        {galat && <p className="mt-3 rounded-lg bg-rose-soft px-3 py-2 text-xs font-bold text-rose">{galat}</p>}
        {info && <p className="mt-3 rounded-lg bg-teal-soft px-3 py-2 text-xs font-bold text-teal-bright">{info}</p>}
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kotak label="Duel aktif" nilai={d ? d.aktif : "…"} />
          <Kotak label="Duel selesai" nilai={d ? d.selesai : "…"} />
          <Kotak label="Uang berputar" nilai={d ? rp(d.perputaran) : "…"} />
          <Kotak label="Potongan terkumpul" nilai={d ? rp(d.fee) : "…"} warna="text-teal-bright" />
          <Kotak label="Bayaran tertunda" nilai={d ? d.belumLunas : "…"} warna={d?.belumLunas ? "text-rose" : "text-ink"} />
        </div>
        <button type="button" onClick={() => kirim("sapu")} disabled={sibuk === "sapu"} className="btn-3d mt-3 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-black text-ink">
          🧹 Jalankan penyapu (waktu habis, tantangan basi, bayaran tertunda)
        </button>
      </div>

      <div className="card p-4">
        <h3 className="text-base font-extrabold text-ink">Duel terbaru</h3>
        <div className="mt-3 space-y-2">
          {!d && <p className="text-sm text-muted">Memuat…</p>}
          {d && !d.daftar.length && <p className="text-sm text-muted">Belum ada duel.</p>}
          {(d?.daftar || []).map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{NAMA[g.jenis] || g.jenis} · {g.pemain.join(" vs ") || "—"}</p>
                <p className="truncate text-[11px] text-muted">
                  {STATUS[g.status] || g.status} · taruhan {rp(g.taruhan)}{g.pemenang ? ` · menang: ${g.pemenang}` : ""}{g.alasan ? ` · ${g.alasan}` : ""}{g.fee ? ` · fee ${rp(g.fee)}` : ""}{g.bayarStatus === "antri" ? " · ⚠ bayaran tertunda" : ""}
                </p>
              </div>
              {["menunggu", "gabung", "main"].includes(g.status) && (
                <button type="button" disabled={sibuk === g.id} onClick={() => confirm("Batalkan duel ini dan kembalikan taruhan kedua pemain?") && kirim("batalkan", g.id)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-rose press disabled:opacity-50">
                  Batalkan & refund
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
