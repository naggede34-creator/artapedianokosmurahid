"use client";

// Tab Game di dasbor admin: ringkasan duel, uang yang berputar, potongan, dan
// tombol membatalkan duel yang macet (taruhan dikembalikan ke kedua pemain).
// Pengaturan (aktif/mati, taruhan, batas, potongan) ada di tab Konfigurasi → Website.
import { useCallback, useEffect, useState } from "react";

const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const NAMA = { catur: "♟ Catur", uno: "🃏 UNO", remi: "🂡 Remi", mahjong: "🀄 Mahjong", gaple: "⚃ Domino Gaple" };
const NAMA_SOLO = { plinko: "🔮 Plinko", slot: "🀄 Mahjong Spin 1024", dadu: "🎲 Dadu Naga", keno: "🎱 Keno Hoki", roda: "🎡 Roda Hoki" };
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

      <div className="card p-4" data-testid="admin-solo">
        <h3 className="text-base font-extrabold text-ink">🎰 Game solo (Plinko & Mahjong Spin 1024)</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Hasil ditentukan server (acak kriptografis), RTP ≈ 96%. Game solo memakai <b>poin game</b> pemain (tidak ada koin latihan) — ini taruhan sungguhan, yang dilarang/diatur ketat di banyak negara
          (termasuk Indonesia) dan berisiko bagi pemain. Matikan lewat <b>GAME_KASINO_AKTIF</b> di Konfigurasi → Website bila perlu.
          Status sekarang: game solo <b>{d?.solo ? (d.solo.aktif ? "aktif" : "ditutup") : "…"}</b>, main dengan poin <b className={d?.solo?.kasino ? "text-rose" : ""}>{d?.solo ? (d.solo.kasino ? "DIIZINKAN" : "mati") : "…"}</b>.
          Batas taruhan, batas rugi harian, dan batas kemenangan diatur lewat GAME_SOLO_*.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(d?.solo?.ringkas || []).map((x) => (
            <div key={`${x.game}:${x.mode}`} className="rounded-xl border border-line bg-surface px-3 py-2.5 text-xs">
              <p className="text-sm font-bold text-ink">{NAMA_SOLO[x.game] || x.game} · {x.mode === "demo" ? "koin latihan" : "saldo"}</p>
              <p className="mt-0.5 text-muted">{x.ronde} ronde · taruhan {x.mode === "demo" ? x.taruhan.toLocaleString("id-ID") : rp(x.taruhan)} · dibayar {x.mode === "demo" ? x.bayar.toLocaleString("id-ID") : rp(x.bayar)}</p>
              <p className="text-muted">RTP nyata {(x.rtp * 100).toFixed(1)}% · menang terbesar {x.mode === "demo" ? x.menangTerbesar.toLocaleString("id-ID") : rp(x.menangTerbesar)}{x.mode === "saldo" ? ` · untung rumah ${rp(x.untungRumah)}` : ""}</p>
            </div>
          ))}
          {d && !(d.solo?.ringkas || []).length && <p className="text-sm text-muted">Belum ada ronde solo.</p>}
        </div>
        {d?.solo?.tertunda > 0 && <p className="mt-2 text-xs font-bold text-rose">⚠ {d.solo.tertunda} ronde menunggu penyelesaian — jalankan penyapu.</p>}
      </div>

      <div className="card p-4" data-testid="admin-anticurang">
        <h3 className="text-base font-extrabold text-ink">🛡️ Anti-curang game</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Mendeteksi akun ganda pada satu perangkat/jaringan, duel antar-akun yang sama perangkat/IP, pasangan yang terlalu sering bertaruh, dan duel bertaruh yang selesai tanpa langkah.
          Temuan dikabari ke Telegram admin. Akun yang di-ban otomatis bisa dibuka lewat tab <b>Pengguna → Aktifkan</b>. Saklar: <b>GAME_ANTICURANG_AKTIF</b> dan <b>GAME_ANTICURANG_BAN</b> (Konfigurasi → Website).
          Status: pemeriksaan <b>{d?.anticurang ? (d.anticurang.aktif ? "aktif" : "mati") : "…"}</b>, ban otomatis <b>{d?.anticurang ? (d.anticurang.banAktif ? "aktif" : "mati (hanya kabar)") : "…"}</b> · 7 hari: <b>{d?.anticurang?.ban7hari ?? 0}</b> ban, <b>{d?.anticurang?.peringatan7hari ?? 0}</b> peringatan.
        </p>
        <div className="mt-3 space-y-1.5">
          {d?.anticurang && !d.anticurang.terbaru.length && <p className="text-sm text-muted">Belum ada temuan. 👍</p>}
          {(d?.anticurang?.terbaru || []).map((x, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface px-3 py-2 text-xs">
              <p className="font-bold text-ink">{{ ban: "🚫 Ban otomatis", strike: "🟡 Peringatan", peringatan: "⚠️ Peringatan", "ip-ramai": "🌐 Banyak akun satu IP", "duel-ip-sama": "⚔️ Duel satu IP", "kolusi-perangkat": "🚨 Duel satu perangkat", "pasangan-sering": "🔁 Pasangan terlalu sering", "duel-terlalu-cepat": "⏱ Duel terlalu cepat" }[x.jenis] || x.jenis}{x.token ? ` · ${x.token}` : ""}</p>
              <p className="text-muted">{x.alasan || ""}{x.ip ? ` · IP ${x.ip}` : ""} · {new Date(x.at).toLocaleString("id-ID")}</p>
            </div>
          ))}
        </div>
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
