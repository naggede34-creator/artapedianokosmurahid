"use client";

// Season Arena: peringkat musim (ELO), turnamen mingguan, hadiah & aturan. Dibuka dari hub Arena Pendekar.
import { useEffect, useState } from "react";
import { useWa } from "@/components/wa/kit";
import KartuMenang from "@/components/KartuMenang";

const rp = (n) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const sisa = (ms) => {
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60), d = Math.floor(h / 24);
  return d > 0 ? `${d} hari ${h % 24} jam` : h > 0 ? `${h} jam ${m % 60} mnt` : `${m} mnt`;
};
const MEDALI = ["🥇", "🥈", "🥉"];

function Baris({ r, hadiah, musim }) {
  return (
    <li className={`sa-baris${r.saya ? " saya" : ""}`}>
      <b className="sa-no">{MEDALI[r.peringkat - 1] || r.peringkat}</b>
      <span className="sa-nama">{r.nama}{musim && r.tingkat ? <em>{r.tingkat.ikon} {r.tingkat.nama}</em> : null}</span>
      <span className="sa-nilai">{musim ? `${r.rating}` : `${r.poin} poin`}<small>{r.menang}M · {r.main} duel</small></span>
      {hadiah && r.layak ? <span className="sa-hadiah">{rp(hadiah)}</span> : null}
    </li>
  );
}

export default function SeasonArena({ onTutup }) {
  const wa = useWa();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("minggu");
  const [galat, setGalat] = useState("");
  const [kartu, setKartu] = useState(false);

  useEffect(() => {
    let batal = false;
    (async () => {
      if (!wa?.api) { setGalat("Masuk dulu untuk melihat papan arena."); return; }
      const r = await wa.api.get("/api/game/arena");
      if (batal) return;
      if (r.ok) setData(r.data); else setGalat(r.error || "Gagal memuat.");
    })();
    return () => { batal = true; };
  }, [wa]);

  const p = data && data[tab === "musim" ? "musim" : "minggu"];
  const musim = tab === "musim";
  return (
    <div className="sa-latar" role="dialog" aria-label="Season Arena" data-testid="sa-layar">
      <div className="sa-kartu">
        <div className="sa-atas">
          <button className="tr-bulat" onClick={onTutup} aria-label="Tutup" data-testid="sa-tutup">✕</button>
          <h2>SEASON ARENA</h2>
        </div>
        {galat && <p className="sa-galat">{galat}</p>}
        {!data && !galat && <p className="sa-muat">Memuat papan…</p>}
        {data && (
          <>
            {!data.aktif && <p className="sa-galat">Season Arena sedang dinonaktifkan admin.</p>}
            <div className="sa-tab">
              <button className={tab === "minggu" ? "on" : ""} onClick={() => setTab("minggu")} data-testid="sa-tab-minggu">🏟 Turnamen Mingguan</button>
              <button className={tab === "musim" ? "on" : ""} onClick={() => setTab("musim")} data-testid="sa-tab-musim">👑 Peringkat Musim</button>
            </div>
            <p className="sa-info">
              {musim ? `Musim ${p.id}` : `Pekan ${p.id}`} · berakhir <b>{sisa(p.sisaMs)}</b> lagi · minimal {p.minMain} duel sah untuk berhak hadiah
            </p>
            <div className="sa-hadiah-baris">
              {p.hadiah.map((h, i) => <span key={i}>{MEDALI[i] || `#${i + 1}`} {rp(h)}</span>)}
            </div>
            {p.saya && (
              <div className="sa-saya" data-testid="sa-saya">
                <b>Posisimu: {p.saya.peringkat ? `#${p.saya.peringkat}` : "belum bertanding"}</b>
                <span>{musim ? `Rating ${p.saya.rating} · ${p.saya.tingkat.ikon} ${p.saya.tingkat.nama}` : `${p.saya.poin} poin turnamen`} · {p.saya.menang} menang / {p.saya.main} duel{!p.saya.layak ? ` · butuh ${Math.max(0, p.minMain - p.saya.main)} duel lagi` : " · ✅ berhak hadiah"}</span>
              </div>
            )}
            {p.saya?.peringkat && <button className="sa-bagi" onClick={() => setKartu(true)} data-testid="sa-bagikan">📸 Bagikan peringkatku</button>}
            <ol className="sa-daftar" data-testid="sa-daftar">
              {p.papan.length === 0 && <li className="sa-kosong">Belum ada pertandingan. Jadilah yang pertama! Menangkan duel Arena Pendekar melawan pemain lain.</li>}
              {p.papan.map((r) => <Baris key={r.pid} r={r} musim={musim} hadiah={p.hadiah[r.peringkat - 1]} />)}
            </ol>
            {p.juaraLalu && (
              <p className="sa-lalu">🏅 Juara periode {p.juaraLalu.periode}: {p.juaraLalu.pemenang.map((x) => `${MEDALI[x.peringkat - 1] || ""}${x.nama}`).join(" · ")}</p>
            )}
            <details className="sa-aturan">
              <summary>Aturan & cara main</summary>
              <ul>
                <li>Hanya duel <b>Arena Pendekar antar pemain</b> yang dihitung (bukan solo/CPU).</li>
                <li>Peringkat musim memakai rating ELO (mulai {data.aturan.ratingAwal}); menang dari lawan kuat memberi lebih banyak poin.</li>
                <li>Turnamen mingguan: tiap kemenangan sah +{data.aturan.poinMenang} poin. Reset tiap Senin.</li>
                <li>Duel harus berlangsung ≥ {data.aturan.minDetik} detik; maksimal {data.aturan.maksPasangan} duel dengan lawan yang sama dihitung per hari.</li>
                <li>Hadiah masuk otomatis ke Saldo Game saat periode berganti. Akun yang dibekukan tidak berhak hadiah.</li>
                <li>Tingkat: {data.tingkat.map((t) => `${t.ikon} ${t.nama} (${t.min}+)`).join(" · ")}</li>
              </ul>
            </details>
          </>
        )}
      </div>
      {kartu && p?.saya && (
        <KartuMenang judul={`PERINGKAT #${p.saya.peringkat}`} subjudul={musim ? `Season Arena ${p.id}` : "Turnamen Mingguan Arena"} nama={wa?.saya?.nama || ""}
          baris={[musim ? `Rating ${p.saya.rating} · ${p.saya.tingkat.ikon} ${p.saya.tingkat.nama}` : `${p.saya.poin} poin turnamen`, `${p.saya.menang} menang dari ${p.saya.main} duel`]}
          teksBagikan={`Aku peringkat #${p.saya.peringkat} di Arena Pendekar ARTA PEDIA! 🥋`} onTutup={() => setKartu(false)} />
      )}
    </div>
  );
}
