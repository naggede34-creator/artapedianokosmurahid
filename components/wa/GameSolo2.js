"use client";

// Tiga game solo tambahan: Dadu Naga, Keno Hoki, Roda Hoki. Server yang mengundi (acak kriptografis) dan membayar;
// layar ini hanya menganimasikan hasil. Taruhan SELALU memakai poin game (saldo utama game).
import { useEffect, useRef, useState } from "react";
import { Ik, Lembar, useWa } from "@/components/wa/kit";
import { useSolo, PanelDompet, Pengingat, CacahAngka, rp, fmtX, tidur } from "@/components/wa/GameSolo";
import { TombolSuara, useMusik, bunyiKlik } from "@/components/wa/Suara";
import { efek as bunyi } from "@/lib/suara";

const koma = (n, d = 2) => Number(n).toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Perayaan kemenangan besar (banner + hujan koin) — dipakai bersama ketiga layar. */
function usePerayaan(hidup) {
  const [banner, setBanner] = useState(null);
  const [hujan, setHujan] = useState(0);
  const rayakan = (pengali, bayar) => {
    const tingkat = pengali >= 100 ? 3 : pengali >= 30 ? 2 : pengali >= 10 ? 1 : 0;
    if (!tingkat) return false;
    setBanner({ teks: ["BIG WIN", "MEGA WIN", "SUPER WIN"][tingkat - 1], tingkat, nilai: bayar, kunci: Date.now() });
    setHujan((n) => n + 1);
    bunyi("menangBesar");
    setTimeout(() => hidup.current && setBanner(null), 3600);
    return true;
  };
  const tampil = (
    <>
      {hujan > 0 && <div key={hujan} className="sl-hujan" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <span key={i} style={{ "--i": i, "--x": `${(i * 37) % 100}%`, "--d": `${(i % 9) * 0.12}s` }}>🪙</span>)}</div>}
      {banner && (
        <div key={banner.kunci} className={`sl-banner t${banner.tingkat}`} role="status" data-testid="solo-banner" onClick={() => setBanner(null)}>
          <small>🪙 🪙 🪙</small><b>{banner.teks}</b><CacahAngka nilai={banner.nilai} format={rp} />
        </div>
      )}
    </>
  );
  return { rayakan, tampil };
}

function Kepala({ ikon, judul, sub, onTutup, kunci, onInfo }) {
  return (
    <header className="wa-kepala wg-kepala">
      <button className="wa-ikon" onClick={onTutup} aria-label="Kembali" disabled={kunci}><Ik n="back" s={22} /></button>
      <div className="wg-judul"><b>{ikon} {judul}</b><small>{sub}</small></div>
      <TombolSuara />
      <button className="wa-ikon" onClick={onInfo} aria-label="Cara main"><Ik n="info" s={22} /></button>
    </header>
  );
}

// ═════════════════════════ DADU NAGA ═════════════════════════
export function LayarDadu({ onTutup }) {
  const s = useSolo();
  const wa = useWa();
  const { info, bet } = s;
  const [arah, setArah] = useState("bawah");
  const [target, setTarget] = useState(50);
  const [tampil, setTampil] = useState("50,00");
  const [penanda, setPenanda] = useState(null);
  const [gulir, setGulir] = useState(false);
  const [akhir, setAkhir] = useState(null);
  const [riwayat, setRiwayat] = useState([]);
  const [aturan, setAturan] = useState(false);
  const hidup = useRef(true);
  useEffect(() => () => { hidup.current = false; }, []);
  useMusik("lounge");
  const perayaan = usePerayaan(hidup);

  const pengali = info?.dadu?.pengali?.[target] ?? 0;
  const zona = arah === "bawah" ? [0, target] : [100 - target, 100];

  async function lempar() {
    if (gulir) return;
    setGulir(true); setAkhir(null);
    const r = await s.main("dadu", { arah, target });
    if (!hidup.current) return;
    if (!r.ok) { wa.toast(r.error || "Gagal melempar."); setGulir(false); return; }
    const d = r.data;
    s.setSaldo((k) => k - d.bet);
    bunyi("putar");
    for (let i = 0; i < 13 && hidup.current; i++) {
      const x = Math.random() * 100;
      setTampil(koma(x)); setPenanda(x); bunyi("tik");
      await tidur(55 + i * 9);
    }
    if (!hidup.current) return;
    setTampil(koma(d.hasil.angka)); setPenanda(d.hasil.angka);
    bunyi("berhenti");
    await tidur(260);
    s.setSaldo(d.saldo); s.refreshBalance?.();
    setAkhir(d);
    setRiwayat((h) => [{ id: Date.now(), angka: d.hasil.angka, menang: d.hasil.menang }, ...h].slice(0, 10));
    if (d.hasil.menang) { if (!perayaan.rayakan(d.pengali, d.bayar)) bunyi("menang"); } else bunyi("kalah");
    setGulir(false);
  }

  return (
    <div className="wg-layar ws-layar ws-dadu" role="dialog" aria-label="Dadu Naga" onClickCapture={bunyiKlik}>
      <Kepala ikon="🎲" judul="Dadu Naga" sub={`Solo · RTP ≈ 96% · hingga ${fmtX(19.2)}`} onTutup={onTutup} kunci={gulir} onInfo={() => setAturan(true)} />
      <div className="wg-isi ws-isi">
        {!info && <div className="wa-memuat"><span className="wa-spin" /> Memuat…</div>}
        {info && !info.aktif && <div className="wa-galat-blok"><span>🎲</span><p>Game solo sedang ditutup admin.</p></div>}
        {info?.aktif && (
          <>
            <div className={`dd-angka${akhir ? (akhir.hasil.menang ? " menang" : " kalah") : ""}${gulir && !akhir ? " putar" : ""}`} data-testid="dadu-angka" aria-live="polite">
              <span className="naga" aria-hidden="true">🐉</span>
              <b>{tampil}</b>
              <span className="naga kanan" aria-hidden="true">🐉</span>
            </div>
            <div className="dd-jalur" aria-hidden="true">
              <div className="zona" style={{ left: `${zona[0]}%`, width: `${zona[1] - zona[0]}%` }} />
              {penanda != null && <i className="penanda" style={{ left: `${penanda}%` }} />}
              <span className="skala a">0</span><span className="skala b">50</span><span className="skala c">100</span>
            </div>

            <div className="dd-arah" role="group" aria-label="Arah tebakan">
              <button className={arah === "bawah" ? "on" : ""} disabled={gulir} onClick={() => setArah("bawah")} data-testid="dadu-arah-bawah">⬇ BAWAH <small>angka &lt; {target}</small></button>
              <button className={arah === "atas" ? "on" : ""} disabled={gulir} onClick={() => setArah("atas")} data-testid="dadu-arah-atas">⬆ ATAS <small>angka ≥ {100 - target}</small></button>
            </div>
            <label className="dd-target">
              <span>Peluang menang <b data-testid="dadu-peluang">{target}%</b></span>
              <input type="range" min={info.dadu.targetMin} max={info.dadu.targetMaks} step={1} value={target} disabled={gulir} onChange={(e) => setTarget(Number(e.target.value))} data-testid="dadu-target" aria-label="Peluang menang" />
            </label>
            <div className="ws-chips">
              {[10, 25, 50, 75, 90].map((x) => <button key={x} className={target === x ? "on" : ""} disabled={gulir} onClick={() => setTarget(x)}>{x}%</button>)}
            </div>
            <div className="dd-info">
              <span><small>Pengali</small><b data-testid="dadu-pengali">{fmtX(pengali)}</b></span>
              <span><small>Bila menang</small><b>{rp(Math.floor(bet * pengali))}</b></span>
            </div>

            {akhir && !gulir && (
              <p className={`ws-hasil-baris ${akhir.hasil.menang ? "menang" : "kalah"}`} data-testid="dadu-hasil" role="status">
                Angka {koma(akhir.hasil.angka)} · {akhir.hasil.menang ? `Menang ${fmtX(akhir.pengali)} · +${rp(akhir.bayar)}` : `Belum beruntung · −${rp(akhir.bet)}`}
              </p>
            )}
            <div className="ws-riwayat" aria-label="Lemparan terakhir">
              {riwayat.length === 0 && <span className="ws-kosong">Hasil lemparan tampil di sini</span>}
              {riwayat.map((h) => <span key={h.id} style={{ background: h.menang ? "#16a34a" : "#64748b" }}>{koma(h.angka)}</span>)}
            </div>
            <PanelDompet s={s} kunci={gulir} />
            <div className="ws-aksi"><button className="wa-tombol utama ws-besar" onClick={lempar} disabled={gulir || s.dompet < bet} data-testid="dadu-lempar">{gulir ? "Mengocok…" : "🎲 LEMPAR"}</button></div>
            <Pengingat />
          </>
        )}
      </div>
      {perayaan.tampil}
      {aturan && (
        <Lembar judul="Cara main Dadu Naga" onTutup={() => setAturan(false)} lebar={440}>
          <ul className="wg-aturan">
            <li>Server mengundi angka acak 00,00–99,99. Pilih <b>peluang menang</b> (5–95%) dan arah: <b>BAWAH</b> menang bila angka &lt; peluangmu, <b>ATAS</b> menang bila angka ≥ 100 − peluangmu.</li>
            <li>Makin kecil peluang, makin besar pengali: pengali = 96 ÷ peluang (dibulatkan ke bawah). Peluang 50% = ×1,92; 5% = ×19,2; 95% = ×1,01.</li>
            <li>RTP ≈ 96% di semua pilihan. Hasil ditentukan server dengan acak kriptografis <i>sebelum</i> animasi berjalan.</li>
            <li>Taruhan memakai poin game dan dipotong saat lemparan dimulai. Ada batas rugi harian.</li>
          </ul>
        </Lembar>
      )}
    </div>
  );
}

// ═════════════════════════ KENO HOKI ═════════════════════════
export function LayarKeno({ onTutup }) {
  const s = useSolo();
  const wa = useWa();
  const { info, bet } = s;
  const [pilih, setPilih] = useState([]);
  const [keluar, setKeluar] = useState([]);
  const [main, setMain] = useState(false);
  const [akhir, setAkhir] = useState(null);
  const [turbo, setTurbo] = useState(false);
  const [aturan, setAturan] = useState(false);
  const hidup = useRef(true);
  useEffect(() => () => { hidup.current = false; }, []);
  useMusik("lounge");
  const perayaan = usePerayaan(hidup);

  const total = info?.keno?.total ?? 40;
  const maks = info?.keno?.maksPilih ?? 10;
  const tabelN = info?.keno?.tabel?.[pilih.length]?.pengali || null;
  const set = new Set(pilih), keluarSet = new Set(keluar);
  const kenaSekarang = pilih.filter((x) => keluarSet.has(x)).length;

  function ketuk(n) {
    if (main) return;
    setAkhir(null); setKeluar([]);
    setPilih((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length >= maks ? p : [...p, n].sort((a, b) => a - b)));
  }
  function acak(n) {
    if (main) return;
    setAkhir(null); setKeluar([]);
    const a = Array.from({ length: total }, (_, i) => i + 1);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    setPilih(a.slice(0, n).sort((x, y) => x - y));
    bunyi("kartu");
  }

  async function kocok() {
    if (main || !pilih.length) return;
    setMain(true); setAkhir(null); setKeluar([]);
    const r = await s.main("keno", { pilih });
    if (!hidup.current) return;
    if (!r.ok) { wa.toast(r.error || "Gagal mengocok."); setMain(false); return; }
    const d = r.data;
    s.setSaldo((k) => k - d.bet);
    bunyi("putar");
    await tidur(turbo ? 150 : 450);
    let hit = 0;
    const pilSet = new Set(d.hasil.pilih);
    for (const x of d.hasil.keluar) {
      if (!hidup.current) return;
      setKeluar((k) => [...k, x]);
      if (pilSet.has(x)) { hit++; bunyi("koin", { nada: 0.8 + hit * 0.1 }); } else bunyi("tik");
      await tidur(turbo ? 70 : 190);
    }
    await tidur(260);
    s.setSaldo(d.saldo); s.refreshBalance?.();
    setAkhir(d);
    if (d.bayar > 0) { if (!perayaan.rayakan(d.pengali, d.bayar)) bunyi("menang"); } else bunyi("kalah");
    setMain(false);
  }

  return (
    <div className="wg-layar ws-layar ws-keno" role="dialog" aria-label="Keno Hoki" onClickCapture={bunyiKlik}>
      <Kepala ikon="🎱" judul="Keno Hoki" sub="Solo · RTP ≈ 96% · hingga ×1000" onTutup={onTutup} kunci={main} onInfo={() => setAturan(true)} />
      <div className="wg-isi ws-isi">
        {!info && <div className="wa-memuat"><span className="wa-spin" /> Memuat…</div>}
        {info && !info.aktif && <div className="wa-galat-blok"><span>🎱</span><p>Game solo sedang ditutup admin.</p></div>}
        {info?.aktif && (
          <>
            <div className="kn-atas">
              <span>Dipilih <b data-testid="keno-jumlah">{pilih.length}</b>/{maks}</span>
              <span className="kn-tombol">
                {[3, 5, 8, 10].map((n) => <button key={n} disabled={main} onClick={() => acak(n)} data-testid={`keno-acak-${n}`}>🎲 {n}</button>)}
                <button disabled={main || !pilih.length} onClick={() => { setPilih([]); setKeluar([]); setAkhir(null); }} data-testid="keno-hapus">Hapus</button>
              </span>
            </div>
            <div className="kn-papan" data-testid="keno-papan">
              {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
                const dip = set.has(n), kel = keluarSet.has(n);
                return (
                  <button key={n} className={`kn-sel${dip ? " dipilih" : ""}${kel ? " keluar" : ""}${dip && kel ? " kena" : ""}`} disabled={main} onClick={() => ketuk(n)} data-testid={`keno-sel-${n}`} aria-pressed={dip} aria-label={`Angka ${n}${dip ? " dipilih" : ""}${kel ? " keluar" : ""}`}>{n}</button>
                );
              })}
            </div>
            <div className="kn-tabel" data-testid="keno-tabel">
              {tabelN ? tabelN.map((m, k) => (m > 0 ? <span key={k} className={main || akhir ? (k === kenaSekarang ? "on" : "") : ""}><small>{k} kena</small><b>{fmtX(m)}</b></span> : null)) : <span className="kn-kosong">Pilih 1–{maks} angka untuk melihat tabel bayar</span>}
            </div>
            {(main || akhir) && <p className="kn-status" role="status">Kena <b>{kenaSekarang}</b> dari {pilih.length} · bola keluar {keluar.length}/10</p>}
            {akhir && !main && (
              <p className={`ws-hasil-baris ${akhir.bayar > 0 ? "menang" : "kalah"}`} data-testid="keno-hasil" role="status">
                {akhir.hasil.k} kena · {akhir.bayar > 0 ? `Menang ${fmtX(akhir.pengali)} · +${rp(akhir.bayar)}` : `Belum beruntung · −${rp(akhir.bet)}`}
              </p>
            )}
            <PanelDompet s={s} kunci={main} />
            <div className="ws-aksi">
              <button className="wa-tombol utama ws-besar" onClick={kocok} disabled={main || !pilih.length || s.dompet < bet} data-testid="keno-kocok">{main ? "Mengundi…" : "🎱 KOCOK"}</button>
              <button className={`wa-tombol${turbo ? " utama" : ""}`} onClick={() => setTurbo((t) => !t)} aria-pressed={turbo}>⚡ Turbo</button>
            </div>
            <Pengingat />
          </>
        )}
      </div>
      {perayaan.tampil}
      {aturan && (
        <Lembar judul="Cara main Keno Hoki" onTutup={() => setAturan(false)} lebar={440}>
          <ul className="wg-aturan">
            <li>Pilih 1–10 angka dari 1–40. Server mengundi 10 bola berbeda. Hadiah menurut banyaknya angkamu yang keluar (tabel bayar di bawah papan).</li>
            <li>Makin banyak angka dipilih, makin besar hadiah untuk tebakan benar yang banyak — tapi makin sulit. Hadiah maksimum ×1000.</li>
            <li>RTP ≈ 96% untuk setiap jumlah pilihan. Hasil ditentukan server dengan acak kriptografis sebelum bola dianimasikan.</li>
            <li>Taruhan memakai poin game dan dipotong saat undian dimulai. Ada batas rugi harian.</li>
          </ul>
        </Lembar>
      )}
    </div>
  );
}

// ═════════════════════════ RODA HOKI ═════════════════════════
const warnaIris = (m) => (m === 0 ? "#334155" : m >= 10 ? "#f59e0b" : m >= 4 ? "#a855f7" : m >= 2 ? "#3b82f6" : "#10b981");
const titik = (cx, cy, r, sudut) => { const a = ((sudut - 90) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };

function Roda({ irisan, rot, putar }) {
  const N = irisan.length, sd = 360 / N, C = 150, R = 140;
  return (
    <svg viewBox="0 0 300 300" className="rd-svg" role="img" aria-label="Roda Hoki">
      <defs><radialGradient id="rd-pusat" cx="50%" cy="40%" r="60%"><stop offset="0" stopColor="#fde68a" /><stop offset="1" stopColor="#b45309" /></radialGradient></defs>
      <g style={{ transform: `rotate(${rot}deg)`, transformOrigin: "150px 150px", transition: putar ? "transform 4.2s cubic-bezier(.12,.72,.14,1)" : "none" }}>
        {irisan.map((m, i) => {
          const [x1, y1] = titik(C, C, R, i * sd), [x2, y2] = titik(C, C, R, (i + 1) * sd);
          const [tx, ty] = titik(C, C, R * 0.76, (i + 0.5) * sd);
          return (
            <g key={i}>
              <path d={`M${C} ${C} L${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2} Z`} fill={warnaIris(m)} stroke="#0f172a" strokeWidth="1.4" />
              <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize={N > 30 ? 9 : 11} fontWeight="900" fill="#fff" transform={`rotate(${(i + 0.5) * sd} ${tx} ${ty})`}>{m === 0 ? "✕" : m}</text>
            </g>
          );
        })}
      </g>
      <circle cx={C} cy={C} r="26" fill="url(#rd-pusat)" stroke="#78350f" strokeWidth="3" />
      <text x={C} y={C + 1} textAnchor="middle" dominantBaseline="middle" fontSize="22">🐉</text>
      <circle cx={C} cy={C} r={R + 3} fill="none" stroke="#fbbf24" strokeWidth="5" />
      <path d="M150 2 L138 -14 L162 -14 Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2" transform="translate(0 16)" />
    </svg>
  );
}

export function LayarRoda({ onTutup }) {
  const s = useSolo();
  const wa = useWa();
  const { info, bet } = s;
  const [risiko, setRisiko] = useState("sedang");
  const [rot, setRot] = useState(0);
  const [putar, setPutar] = useState(false);
  const [akhir, setAkhir] = useState(null);
  const [riwayat, setRiwayat] = useState([]);
  const [aturan, setAturan] = useState(false);
  const hidup = useRef(true);
  const timers = useRef([]);
  useEffect(() => () => { hidup.current = false; timers.current.forEach(clearTimeout); }, []);
  useMusik("lounge");
  const perayaan = usePerayaan(hidup);

  const irisan = info?.roda?.irisan?.[risiko] || [];
  const maks = irisan.length ? Math.max(...irisan) : 0;

  async function putarRoda() {
    if (putar || !irisan.length) return;
    setPutar(true); setAkhir(null);
    const r = await s.main("roda", { risiko });
    if (!hidup.current) return;
    if (!r.ok) { wa.toast(r.error || "Gagal memutar."); setPutar(false); return; }
    const d = r.data;
    s.setSaldo((k) => k - d.bet);
    const N = irisan.length, sd = 360 / N;
    const dasar = Math.ceil(rot / 360) * 360 + 360 * 6;
    const akhirRot = dasar + ((360 - (d.hasil.idx + 0.5) * sd) % 360);
    bunyi("putar");
    setRot(akhirRot);
    const DUR = 4200;
    timers.current = Array.from({ length: 26 }, (_, i) => setTimeout(() => hidup.current && bunyi("tik"), DUR * (1 - (1 - i / 26) ** 2.4) * 0.97));
    await tidur(DUR + 120);
    if (!hidup.current) return;
    bunyi("berhenti");
    s.setSaldo(d.saldo); s.refreshBalance?.();
    setAkhir(d);
    setRiwayat((h) => [{ id: Date.now(), m: d.pengali }, ...h].slice(0, 12));
    if (d.bayar > 0) { if (!perayaan.rayakan(d.pengali, d.bayar)) bunyi("menang"); } else bunyi("kalah");
    setPutar(false);
  }

  return (
    <div className="wg-layar ws-layar ws-roda" role="dialog" aria-label="Roda Hoki" onClickCapture={bunyiKlik}>
      <Kepala ikon="🎡" judul="Roda Hoki" sub={`Solo · RTP 96% · hingga ${fmtX(17.4)}`} onTutup={onTutup} kunci={putar} onInfo={() => setAturan(true)} />
      <div className="wg-isi ws-isi">
        {!info && <div className="wa-memuat"><span className="wa-spin" /> Memuat…</div>}
        {info && !info.aktif && <div className="wa-galat-blok"><span>🎡</span><p>Game solo sedang ditutup admin.</p></div>}
        {info?.aktif && (
          <>
            <div className="ws-pilih">
              <div className="ws-seg" role="group" aria-label="Risiko">
                {info.roda.risiko.map((x) => <button key={x} className={`${risiko === x ? "on" : ""} r-${x}`} disabled={putar} onClick={() => setRisiko(x)} data-testid={`roda-risiko-${x}`}>{x}</button>)}
                <small>risiko</small>
              </div>
            </div>
            <div className={`rd-papan${akhir && akhir.bayar > 0 ? " menang" : ""}`} data-testid="roda-papan">
              {irisan.length > 0 && <Roda irisan={irisan} rot={rot} putar={putar} />}
            </div>
            <p className="rd-catatan">{irisan.length} irisan · hadiah tertinggi {fmtX(maks)} · peluang kalah {Math.round((irisan.filter((m) => m === 0).length / (irisan.length || 1)) * 100)}%</p>
            {akhir && !putar && (
              <p className={`ws-hasil-baris ${akhir.bayar > 0 ? "menang" : "kalah"}`} data-testid="roda-hasil" role="status">
                {akhir.bayar > 0 ? `Menang ${fmtX(akhir.pengali)} · +${rp(akhir.bayar)}` : `Belum beruntung · −${rp(akhir.bet)}`}
              </p>
            )}
            <div className="ws-riwayat" aria-label="Hasil terakhir">
              {riwayat.length === 0 && <span className="ws-kosong">Hasil putaran tampil di sini</span>}
              {riwayat.map((h) => <span key={h.id} style={{ background: warnaIris(h.m) }}>{h.m === 0 ? "✕" : fmtX(h.m)}</span>)}
            </div>
            <PanelDompet s={s} kunci={putar} />
            <div className="ws-aksi"><button className="wa-tombol utama ws-besar" onClick={putarRoda} disabled={putar || s.dompet < bet} data-testid="roda-putar">{putar ? "Berputar…" : "🎡 PUTAR RODA"}</button></div>
            <Pengingat />
          </>
        )}
      </div>
      {perayaan.tampil}
      {aturan && (
        <Lembar judul="Cara main Roda Hoki" onTutup={() => setAturan(false)} lebar={440}>
          <ul className="wg-aturan">
            <li>Pilih risiko lalu putar. Jarum merah di atas menentukan hadiah: taruhan × angka di irisan. ✕ = hangus.</li>
            <li>Rendah: 20 irisan, hadiah kecil tapi sering. Sedang: 30 irisan, hingga ×3. Tinggi: 40 irisan, jarang menang tapi ada ×17,4.</li>
            <li>Semua irisan berpeluang sama; komposisi irisan membuat RTP tepat 96,0%. Hasil ditentukan server dengan acak kriptografis sebelum roda berputar.</li>
            <li>Taruhan memakai poin game dan dipotong saat roda diputar. Ada batas rugi harian.</li>
          </ul>
        </Lembar>
      )}
    </div>
  );
}
