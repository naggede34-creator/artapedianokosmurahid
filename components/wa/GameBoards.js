"use client";

// Papan permainan: catur, UNO, remi, mahjong. Semua hanya MENAMPILKAN keadaan
// dari server dan mengirim niat langkah — aturan ditegakkan di server.
import { useMemo, useState } from "react";
import { Ik } from "@/components/wa/kit";

// ═════════════════════════════ CATUR ═════════════════════════════
const GLIF = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };
const NAMA_PROMO = { Q: "Menteri", R: "Benteng", B: "Gajah", N: "Kuda" };

export function PapanCatur({ papan, onAksi, sibuk }) {
  const [dipilih, setDipilih] = useState(null);
  const [promo, setPromo] = useState(null); // { dari, ke }
  const putih = papan.warnaSaya === "w";
  const urutan = useMemo(() => {
    const a = Array.from({ length: 64 }, (_, i) => i);
    return putih ? a : a.reverse();
  }, [putih]);

  const target = useMemo(() => {
    const m = new Map();
    if (dipilih === null) return m;
    for (const [d, k, p] of papan.langkah) if (d === dipilih) m.set(k, p);
    return m;
  }, [dipilih, papan.langkah]);
  const bisaDipilih = useMemo(() => new Set(papan.langkah.map((l) => l[0])), [papan.langkah]);

  const rajaSkak = papan.skak ? papan.papan.findIndex((x) => x === papan.giliranWarna + "K") : -1;

  function klik(i) {
    if (sibuk || !papan.giliranSaya) return;
    if (dipilih !== null && target.has(i)) {
      if (target.get(i)) { setPromo({ dari: dipilih, ke: i }); return; }
      onAksi({ tipe: "jalan", dari: dipilih, ke: i });
      setDipilih(null);
      return;
    }
    if (bisaDipilih.has(i)) setDipilih(i === dipilih ? null : i);
    else setDipilih(null);
  }

  return (
    <div className="wg-catur">
      <div className="wg-catur-papan" role="grid" aria-label="Papan catur">
        {urutan.map((i, n) => {
          const b = papan.papan[i];
          const gelap = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          const kelas = ["wg-petak", gelap ? "gelap" : "terang", dipilih === i ? "dipilih" : "", target.has(i) ? (b ? "tangkap" : "tujuan") : "", papan.langkahTerakhir?.includes(i) ? "terakhir" : "", rajaSkak === i ? "skak" : ""].filter(Boolean).join(" ");
          const kolom = i % 8, baris = Math.floor(i / 8);
          const pinggirBawah = putih ? baris === 7 : baris === 0;
          const pinggirKiri = putih ? kolom === 0 : kolom === 7;
          return (
            <button key={i} className={kelas} onClick={() => klik(i)} aria-label={`${"abcdefgh"[kolom]}${8 - baris}${b ? " " + b : ""}`} disabled={!papan.giliranSaya}>
              {b && <span className={`wg-bidak ${b[0] === "w" ? "putih" : "hitam"}`}>{GLIF[b[1]]}</span>}
              {pinggirBawah && <i className="wg-kor bawah">{"abcdefgh"[kolom]}</i>}
              {pinggirKiri && <i className="wg-kor kiri">{8 - baris}</i>}
              {n < 0 && null}
            </button>
          );
        })}
      </div>
      {papan.skak && !papan.selesai && <div className="wg-skak">⚠ SKAK!</div>}
      {promo && (
        <div className="wg-promo" role="dialog" aria-label="Pilih bidak promosi">
          <b>Promosi pion jadi:</b>
          <div>
            {["Q", "R", "B", "N"].map((p) => (
              <button key={p} onClick={() => { onAksi({ tipe: "jalan", dari: promo.dari, ke: promo.ke, promo: p }); setPromo(null); setDipilih(null); }}>
                <span className={`wg-bidak ${putih ? "putih" : "hitam"}`}>{GLIF[p]}</span>
                {NAMA_PROMO[p]}
              </button>
            ))}
          </div>
        </div>
      )}
      {papan.tawarSeri === "lawan" && !papan.selesai && (
        <div className="wg-tawar">
          <span>Lawan menawarkan remis.</span>
          <button className="wa-tombol kecil utama" onClick={() => onAksi({ tipe: "terimaSeri" })}>Terima</button>
          <button className="wa-tombol kecil" onClick={() => onAksi({ tipe: "tolakSeri" })}>Tolak</button>
        </div>
      )}
      <div className="wg-riwayat" aria-label="Riwayat langkah">
        {papan.riwayat.length === 0 ? <em>Belum ada langkah.</em> : papan.riwayat.map((r, i) => {
          const total = (papan.nomor - 1) * 2 + (papan.giliranWarna === "b" ? 1 : 0); // jumlah setengah-langkah sejauh ini
          const urut = total - papan.riwayat.length + i; // 0 = langkah putih pertama
          return <span key={i}>{urut % 2 === 0 ? <b>{Math.floor(urut / 2) + 1}.</b> : null} {r.san}</span>;
        })}
      </div>
      {!papan.selesai && (
        <div className="wg-aksi-bawah">
          {papan.tawarSeri === "saya" ? <small>Tawaran remis terkirim…</small> : <button className="wa-tombol kecil" onClick={() => onAksi({ tipe: "tawarSeri" })} disabled={sibuk}>🤝 Tawar remis</button>}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════ UNO ═════════════════════════════
const WARNA_UNO = { R: "#e5383b", Y: "#f6c026", G: "#2a9d5b", B: "#2b6cdf" };
const NAMA_WARNA = { R: "Merah", Y: "Kuning", G: "Hijau", B: "Biru" };
const simbolUno = (k) => (k === "W" ? "🌈" : k === "F" ? "+4" : k[1] === "S" ? "⊘" : k[1] === "V" ? "⇄" : k[1] === "D" ? "+2" : k[1]);

export function KartuUno({ kartu, kecil = false, bisa = false, redup = false, onClick, warnaAktif = null }) {
  const liar = kartu === "W" || kartu === "F";
  const latar = liar ? (warnaAktif ? WARNA_UNO[warnaAktif] : "#1f2937") : WARNA_UNO[kartu[0]];
  return (
    <button
      className={`wg-uno${kecil ? " kecil" : ""}${bisa ? " bisa" : ""}${redup ? " redup" : ""}${liar ? " liar" : ""}`}
      style={{ background: latar }}
      onClick={onClick}
      disabled={!onClick}
      aria-label={`Kartu ${liar ? (kartu === "F" ? "liar ambil empat" : "liar") : NAMA_WARNA[kartu[0]] + " " + simbolUno(kartu)}`}
    >
      <i className="pojok atas">{simbolUno(kartu)}</i>
      <span className="oval"><b>{simbolUno(kartu)}</b></span>
      <i className="pojok bawah">{simbolUno(kartu)}</i>
    </button>
  );
}

export function PapanUno({ papan, onAksi, sibuk }) {
  const [pilihWarna, setPilihWarna] = useState(null); // kartu liar yang menunggu warna
  const bisa = new Set(papan.bisa);
  function main(k) {
    if (sibuk || !papan.giliranSaya || !bisa.has(k)) return;
    if (k === "W" || k === "F") { setPilihWarna(k); return; }
    onAksi({ tipe: "main", kartu: k });
  }
  return (
    <div className="wg-uno-meja">
      <div className="wg-uno-lawan" aria-label={`Lawan punya ${papan.jumlahLawan} kartu`}>
        {Array.from({ length: Math.min(papan.jumlahLawan, 14) }).map((_, i) => <span key={i} className="wg-uno-punggung" style={{ marginLeft: i ? -22 : 0 }} />)}
        <b className="wg-uno-jumlah">{papan.jumlahLawan}</b>
        {papan.unoLawan && <em className="wg-uno-teriak">UNO!</em>}
      </div>
      <div className="wg-uno-tengah">
        <button className="wg-uno-tumpukan" onClick={() => onAksi({ tipe: "ambil" })} disabled={sibuk || !papan.giliranSaya || papan.sudahAmbil} aria-label="Ambil kartu dari tumpukan">
          <span className="wg-uno-punggung besar" />
          <small>{papan.sisaTumpukan}</small>
        </button>
        <div className="wg-uno-buangan">
          <KartuUno kartu={papan.atas} warnaAktif={papan.atas === "W" || papan.atas === "F" ? papan.warna : null} />
          <span className="wg-uno-warna" style={{ background: WARNA_UNO[papan.warna] }} title={`Warna aktif: ${NAMA_WARNA[papan.warna]}`}>{NAMA_WARNA[papan.warna]}</span>
        </div>
      </div>
      {papan.giliranSaya && papan.sudahAmbil && (
        <div className="wg-uno-info">Kamu sudah mengambil kartu. Mainkan kartunya (kalau bisa) atau <button className="wa-tombol kecil" onClick={() => onAksi({ tipe: "lewat" })} disabled={sibuk}>Lewati giliran</button></div>
      )}
      {papan.giliranSaya && !papan.sudahAmbil && papan.bisa.length === 0 && <div className="wg-uno-info">Tidak ada kartu yang cocok — ketuk tumpukan untuk mengambil.</div>}
      <div className="wg-uno-tangan" role="list" aria-label="Kartumu">
        {papan.tangan.map((k, i) => (
          <div role="listitem" key={k + i} className="wg-uno-slot">
            <KartuUno kartu={k} bisa={papan.giliranSaya && bisa.has(k)} redup={papan.giliranSaya && !bisa.has(k)} onClick={papan.giliranSaya ? () => main(k) : undefined} />
          </div>
        ))}
      </div>
      {papan.unoSaya && <div className="wg-uno-teriak saya">UNO! Tinggal 1 kartu</div>}
      {pilihWarna && (
        <div className="wg-promo" role="dialog" aria-label="Pilih warna">
          <b>Pilih warna:</b>
          <div>
            {Object.entries(WARNA_UNO).map(([w, c]) => (
              <button key={w} onClick={() => { onAksi({ tipe: "main", kartu: pilihWarna, warna: w }); setPilihWarna(null); }}>
                <span className="wg-titik" style={{ background: c }} />{NAMA_WARNA[w]}
              </button>
            ))}
          </div>
          <button className="wa-tombol polos kecil" onClick={() => setPilihWarna(null)}>Batal</button>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════ REMI ═════════════════════════════
const SIMBOL_JENIS = { S: "♠", H: "♥", D: "♦", C: "♣" };
const nilaiTeks = (k) => (k[0] === "T" ? "10" : k[0]);

export function KartuRemi({ kartu, dipilih = false, onClick, kecil = false, redup = false, bisaTutup = false }) {
  const merah = kartu[1] === "H" || kartu[1] === "D";
  return (
    <button className={`wg-remi${dipilih ? " dipilih" : ""}${kecil ? " kecil" : ""}${redup ? " redup" : ""}${bisaTutup ? " tutup" : ""}`} onClick={onClick} disabled={!onClick} aria-label={`Kartu ${nilaiTeks(kartu)} ${SIMBOL_JENIS[kartu[1]]}`}>
      <b className={merah ? "merah" : ""}>{nilaiTeks(kartu)}</b>
      <span className={merah ? "merah" : ""}>{SIMBOL_JENIS[kartu[1]]}</span>
    </button>
  );
}

export function PapanRemi({ papan, onAksi, sibuk }) {
  const [pilih, setPilih] = useState(null);
  const ambilFase = papan.giliranSaya && papan.fase === "ambil";
  const buangFase = papan.giliranSaya && papan.fase === "buang";
  const bisaTutup = new Set(papan.bisaTutup);
  const dalamSusunan = new Set(papan.susunanSaya.flat());
  return (
    <div className="wg-remi-meja">
      <div className="wg-uno-lawan" aria-label={`Lawan punya ${papan.jumlahLawan} kartu`}>
        {Array.from({ length: papan.jumlahLawan }).map((_, i) => <span key={i} className="wg-uno-punggung" style={{ marginLeft: i ? -26 : 0 }} />)}
        <b className="wg-uno-jumlah">{papan.jumlahLawan}</b>
      </div>
      <div className="wg-remi-tengah">
        <button className="wg-uno-tumpukan" onClick={() => onAksi({ tipe: "ambilTumpukan" })} disabled={sibuk || !ambilFase} aria-label="Ambil dari tumpukan tertutup">
          <span className="wg-uno-punggung besar" />
          <small>{papan.sisaTumpukan}</small>
        </button>
        <div className="wg-remi-buangan">
          {papan.atasBuangan ? (
            <KartuRemi kartu={papan.atasBuangan} onClick={ambilFase ? () => onAksi({ tipe: "ambilBuangan" }) : undefined} />
          ) : <span className="wg-kosong-kartu">kosong</span>}
          <small>Buangan{ambilFase ? " (ketuk untuk ambil)" : ""}</small>
        </div>
        <div className="wg-remi-riwayat">
          {papan.buangan.slice(0, -1).slice(-5).map((k, i) => <KartuRemi key={k + i} kartu={k} kecil redup />)}
        </div>
      </div>
      <div className="wg-remi-info">
        {ambilFase && "Ambil satu kartu: dari tumpukan tertutup atau buangan teratas."}
        {buangFase && (pilih ? "Buang kartu terpilih, atau tutup bila poin sisa ≤ 10." : "Pilih satu kartu untuk dibuang.")}
        {!papan.giliranSaya && !papan.selesai && "Menunggu lawan…"}
      </div>
      <div className="wg-remi-tangan" role="list" aria-label="Kartumu">
        {papan.tangan.map((k) => (
          <div key={k} role="listitem">
            <KartuRemi kartu={k} dipilih={pilih === k} bisaTutup={buangFase && bisaTutup.has(k)} redup={!dalamSusunan.has(k) ? false : false}
              onClick={buangFase && k !== papan.dariBuangan ? () => setPilih(pilih === k ? null : k) : undefined} />
            {dalamSusunan.has(k) && <i className="wg-remi-titik" title="Bagian susunan" />}
          </div>
        ))}
      </div>
      <div className="wg-remi-poin">
        Poin sisa: <b>{papan.poinSaya}</b>
        <span>{papan.susunanSaya.length ? ` · ${papan.susunanSaya.length} susunan` : ""}</span>
        {papan.dariBuangan && buangFase && <span> · kartu dari buangan tak boleh langsung dibuang</span>}
      </div>
      {buangFase && (
        <div className="wg-aksi-bawah">
          <button className="wa-tombol kecil" disabled={!pilih || sibuk} onClick={() => { onAksi({ tipe: "buang", kartu: pilih }); setPilih(null); }}>Buang</button>
          <button className="wa-tombol kecil utama" disabled={!pilih || !bisaTutup.has(pilih) || sibuk} onClick={() => { onAksi({ tipe: "tutup", kartu: pilih }); setPilih(null); }}>
            {papan.poinSaya === 0 ? "Gin! Tutup" : "Tutup"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Hasil akhir remi: tangan kedua pemain terbuka. */
export function HasilRemi({ selesai }) {
  if (!selesai?.tanganPenutup) return null;
  const Tangan = ({ judul, t }) => (
    <div className="wg-remi-hasil">
      <b>{judul} — poin sisa {t.poin}</b>
      <div className="baris">
        {t.susunan.map((m, i) => <span className="grup" key={i}>{m.map((k) => <KartuRemi key={k} kartu={k} kecil />)}</span>)}
        {t.sisa.length > 0 && <span className="grup sisa">{t.sisa.map((k) => <KartuRemi key={k} kartu={k} kecil redup />)}</span>}
      </div>
    </div>
  );
  return (
    <>
      <Tangan judul="Penutup" t={selesai.tanganPenutup} />
      <Tangan judul="Lawan penutup" t={selesai.tanganLawan} />
    </>
  );
}

// ═════════════════════════════ MAHJONG ═════════════════════════════
const NAMA_ANGIN = { 1: "東", 2: "南", 3: "西", 4: "北", 5: "中", 6: "發", 7: "白" };
const JENIS_MJ = { b: { label: "竹", warna: "#1b8a4b" }, c: { label: "筒", warna: "#1d5fd6" }, m: { label: "萬", warna: "#c92a2a" } };

export function UbinMj({ ubin, dipilih = false, kecil = false, baru = false, onClick, redup = false }) {
  const z = ubin[0] === "z";
  const angka = Number(ubin[1]);
  const teks = z ? NAMA_ANGIN[angka] : angka;
  const warna = z ? (angka === 5 ? "#c92a2a" : angka === 6 ? "#1b8a4b" : angka === 7 ? "#4b5563" : "#111827") : JENIS_MJ[ubin[0]].warna;
  return (
    <button className={`wg-mj${dipilih ? " dipilih" : ""}${kecil ? " kecil" : ""}${baru ? " baru" : ""}${redup ? " redup" : ""}`} style={{ color: warna }} onClick={onClick} disabled={!onClick} aria-label={`Ubin ${z ? NAMA_ANGIN[angka] : angka + " " + JENIS_MJ[ubin[0]].label}`}>
      <b>{teks}</b>
      {!z && <i>{JENIS_MJ[ubin[0]].label}</i>}
    </button>
  );
}

export function PapanMahjong({ papan, onAksi, sibuk }) {
  const [pilih, setPilih] = useState(null);
  const buangFase = papan.giliranSaya && papan.fase === "buang";
  const ambilFase = papan.giliranSaya && papan.fase === "ambil";
  const klaim = papan.giliranSaya && papan.fase === "klaim" ? papan.klaim : null;
  const Susunan = ({ daftar }) => daftar.length ? (
    <div className="wg-mj-susunan">{daftar.map((m, i) => <span key={i}>{m.ubin.map((u, j) => <UbinMj key={j} ubin={u} kecil />)}</span>)}</div>
  ) : null;
  return (
    <div className="wg-mj-meja">
      <div className="wg-mj-lawan">
        <span className="wg-mj-tutup-ubin">{Array.from({ length: papan.jumlahLawan }).map((_, i) => <i key={i} />)}</span>
        <Susunan daftar={papan.susunanLawan} />
      </div>
      <div className="wg-mj-buangan" aria-label="Ubin buangan lawan">
        {papan.buanganLawan.map((u, i) => <UbinMj key={i} ubin={u} kecil baru={papan.fase === "klaim" && i === papan.buanganLawan.length - 1 && !!papan.ubinBuang && !papan.giliranSaya === false} />)}
      </div>
      <div className="wg-mj-tengah">
        <span>Dinding: <b>{papan.sisaDinding}</b></span>
        {papan.fase === "klaim" && papan.ubinBuang && <span>Ubin dibuang: <UbinMj ubin={papan.ubinBuang} kecil /></span>}
      </div>
      <div className="wg-mj-buangan" aria-label="Ubin buanganmu">
        {papan.buanganSaya.map((u, i) => <UbinMj key={i} ubin={u} kecil redup />)}
      </div>
      <div className="wg-remi-info">
        {ambilFase && "Ambil satu ubin dari dinding."}
        {buangFase && (papan.bisaTsumo ? "Tanganmu menang — tekan TSUMO!" : pilih ? "Buang ubin terpilih." : "Pilih ubin yang mau dibuang.")}
        {klaim && "Lawan membuang ubin — mau klaim?"}
        {!papan.giliranSaya && !papan.selesai && "Menunggu lawan…"}
      </div>
      <Susunan daftar={papan.susunanSaya} />
      <div className="wg-mj-tangan" role="list" aria-label="Ubinmu">
        {papan.tangan.map((u, i) => (
          <div role="listitem" key={u + i}>
            <UbinMj ubin={u} dipilih={pilih === i} baru={papan.ambilTerakhir === u && i === papan.tangan.lastIndexOf(u)} onClick={buangFase ? () => setPilih(pilih === i ? null : i) : undefined} />
          </div>
        ))}
      </div>
      <div className="wg-aksi-bawah wrap">
        {ambilFase && <button className="wa-tombol kecil utama" onClick={() => onAksi({ tipe: "ambil" })} disabled={sibuk}>Ambil ubin</button>}
        {buangFase && <button className="wa-tombol kecil" onClick={() => { onAksi({ tipe: "buang", ubin: papan.tangan[pilih] }); setPilih(null); }} disabled={pilih === null || sibuk}>Buang</button>}
        {buangFase && papan.bisaTsumo && <button className="wa-tombol kecil utama" onClick={() => onAksi({ tipe: "tsumo" })} disabled={sibuk}>🀄 TSUMO</button>}
        {klaim?.ron && <button className="wa-tombol kecil utama" onClick={() => onAksi({ tipe: "ron" })} disabled={sibuk}>🀄 RON</button>}
        {klaim?.pon && <button className="wa-tombol kecil" onClick={() => onAksi({ tipe: "pon" })} disabled={sibuk}>PON</button>}
        {klaim?.chi?.map((p, i) => <button key={i} className="wa-tombol kecil" onClick={() => onAksi({ tipe: "chi", pasangan: p })} disabled={sibuk}>CHI {p.map((u) => (u[0] === "z" ? NAMA_ANGIN[u[1]] : u[1])).join("-")}</button>)}
        {klaim && <button className="wa-tombol kecil polos" onClick={() => onAksi({ tipe: "lewat" })} disabled={sibuk}>Lewat</button>}
      </div>
    </div>
  );
}

/** Tangan pemenang mahjong (ditampilkan di hasil). */
export function HasilMahjong({ selesai }) {
  if (!selesai?.tanganMenang) return null;
  return (
    <div className="wg-remi-hasil">
      <b>Tangan menang ({selesai.cara === "ron" ? "Ron" : "Tsumo"})</b>
      <div className="baris">
        {selesai.tanganMenang.susunan.map((m, i) => <span className="grup" key={i}>{m.ubin.map((u, j) => <UbinMj key={j} ubin={u} kecil />)}</span>)}
        <span className="grup">{selesai.tanganMenang.tangan.map((u, i) => <UbinMj key={i} ubin={u} kecil />)}</span>
      </div>
    </div>
  );
}

export { Ik };
