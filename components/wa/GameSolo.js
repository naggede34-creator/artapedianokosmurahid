"use client";

// Game solo di WEARTA CHAT: Plinko & Mahjong Spin 1024. Server yang menentukan hasil (acak kriptografis);
// layar ini hanya menganimasikannya. Dua mode: koin latihan (bawaan) dan saldo sungguhan (bila admin menyalakan).
import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/app/providers";
import { Ik, Lembar, useWa } from "@/components/wa/kit";
import { teksPoinRp, POIN_RP } from "@/lib/poinGame";
import { Ubin, WILD, SCATTER } from "@/components/wa/UbinSlot";
import { TombolSuara, useMusik, bunyiKlik } from "@/components/wa/Suara";
import { efek as bunyi } from "@/lib/suara";

// Nominal saldo game tampil sebagai poin + padanan rupiah (2 poin = Rp1.000).
const rp = (n) => teksPoinRp(n);
const fmtX = (x) => `×${Number(x).toLocaleString("id-ID", { maximumFractionDigits: 2 })}`;
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

export const KATALOG_SOLO = [
  { kode: "plinko", nama: "Plinko", ikon: "🔮", ringkas: "Jatuhkan bola, pilih risiko. Hingga ×1000." },
  { kode: "slot", nama: "Mahjong Spin 1024", ikon: "🀄", ringkas: "1024 jalur, kaskade kombo & putaran gratis." }
];

// ═════════════════════════ DATA & DOMPET ═════════════════════════
function useSolo() {
  const { api, toast } = useWa();
  const { refreshBalance } = useUser();
  const [info, setInfo] = useState(null);
  const [mode, setMode] = useState("demo");
  const [bet, setBet] = useState(1000);
  // Saldo yang DITAMPILKAN (bisa tertunda sampai animasi selesai agar tidak membocorkan hasil).
  const [koin, setKoin] = useState(0);
  const [saldo, setSaldo] = useState(0);

  const muat = useCallback(async () => {
    const r = await api.get("/api/game/solo");
    if (r.ok) { setInfo(r.data); setKoin(r.data.koin); setSaldo(r.data.saldo); }
    else toast(r.error || "Gagal memuat game solo.");
  }, [api, toast]);
  useEffect(() => { muat(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const batas = info ? (mode === "demo" ? [info.demoMin, info.demoMaks] : [info.min, info.maks]) : [100, 20000];
  // Taruhan awal mengikuti mode: koin latihan 100, saldo = minimal.
  useEffect(() => { if (info) setBet((b) => Math.min(batas[1], Math.max(batas[0], mode === "demo" ? Math.min(b, 1000) : Math.max(b, info.min)))); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, info]);

  const dompet = mode === "demo" ? koin : saldo;
  const set = { setKoin, setSaldo };
  const main = useCallback(async (aksi, data) => {
    const r = await api.post("/api/game/solo", { aksi, mode, bet, ...data });
    return r;
  }, [api, mode, bet]);
  const isiUlang = useCallback(async () => {
    const r = await api.post("/api/game/solo", { aksi: "isi-ulang" });
    if (r.ok) { setKoin(r.data.koin); toast("Koin latihan diisi ulang."); } else toast(r.error || "Gagal mengisi ulang.");
  }, [api, toast]);

  return { info, mode, setMode, bet, setBet, batas, dompet, koin, saldo, ...set, main, isiUlang, muat, refreshBalance };
}

function PanelDompet({ s, kunci = false }) {
  const { info, mode, setMode, bet, setBet, batas, dompet } = s;
  if (!info) return null;
  const unit = mode === "demo" ? "koin" : "poin";
  // Mode saldo: taruhan diketik dalam POIN, disimpan/dikirim dalam rupiah.
  const tampilBet = mode === "demo" ? bet : bet / POIN_RP;
  const ketikBet = (v) => setBet(mode === "demo" ? Math.round(Number(v) || 0) : Math.round((Number(v) || 0) * POIN_RP));
  const fmt = (n) => (mode === "demo" ? `${Number(n).toLocaleString("id-ID")} koin` : rp(n));
  const ubah = (v) => setBet(Math.min(batas[1], Math.max(batas[0], Math.round(Number(v) || 0))));
  return (
    <div className="ws-dompet" data-testid="ws-dompet">
      <div className="ws-mode" role="tablist" aria-label="Mode taruhan">
        <button role="tab" aria-selected={mode === "demo"} className={mode === "demo" ? "on" : ""} disabled={kunci} onClick={() => setMode("demo")}>🪙 Koin latihan</button>
        <button role="tab" aria-selected={mode === "saldo"} className={mode === "saldo" ? "on" : ""} disabled={kunci || !info.kasino} onClick={() => setMode("saldo")} title={info.kasino ? "" : "Dimatikan admin"}>
          💳 Poin game {!info.kasino && <small>(mati)</small>}
        </button>
      </div>
      <div className="ws-saldo"><span>{mode === "demo" ? "Koin kamu" : "Poin game"}</span><b data-testid="ws-saldo">{fmt(dompet)}</b></div>
      <div className="ws-bet">
        <button disabled={kunci} onClick={() => ubah(bet / 2)} aria-label="Setengah">½</button>
        <label>
          <small>Taruhan ({unit})</small>
          <input type="number" inputMode="numeric" min={mode === "demo" ? batas[0] : batas[0] / POIN_RP} max={mode === "demo" ? batas[1] : batas[1] / POIN_RP} step={mode === "demo" ? 100 : 1} value={tampilBet} disabled={kunci}
            onChange={(e) => ketikBet(e.target.value)} onBlur={() => ubah(bet)} data-testid="ws-bet" />
        </label>
        <button disabled={kunci} onClick={() => ubah(bet * 2)} aria-label="Dua kali">2×</button>
        <button disabled={kunci} onClick={() => ubah(batas[1])}>Maks</button>
      </div>
      <div className="ws-chips">
        {(mode === "demo" ? [100, 500, 1000, 5000, 10000] : [2, 10, 20, 50, 100].map((x) => x * POIN_RP)).filter((x) => x >= batas[0] && x <= batas[1]).map((x) => (
          <button key={x} className={bet === x ? "on" : ""} disabled={kunci} onClick={() => setBet(x)}>{mode === "demo" ? (x >= 1000 ? `${x / 1000}K` : x) : `${x / POIN_RP}`}</button>
        ))}
      </div>
      {mode === "demo" && dompet < info.demoMin * 10 && <button className="wa-tombol kecil" onClick={s.isiUlang} disabled={kunci}>🪙 Isi ulang koin ({info.koinAwal.toLocaleString("id-ID")})</button>}
      {mode === "saldo" && dompet < info.min && <a className="wa-tombol kecil" href="/game-deposit" style={{ textAlign: "center", textDecoration: "none" }}>➕ Isi poin game</a>}
      {mode === "saldo" && info.rugiHarian > 0 && <p className="ws-catatan">Batas rugi harian {rp(info.rugiHarian)} · terpakai {rp(info.rugiHariIni)}</p>}
    </div>
  );
}

function Pengingat({ mode }) {
  return (
    <p className="ws-peringatan">
      {mode === "saldo"
        ? "⚠️ Ini permainan untung-untungan dengan uang sungguhan — bisa kalah. Main sebatas kemampuan; RTP ≈ 96% (rumah untung jangka panjang). Bukan cara mencari uang."
        : "🪙 Koin latihan tidak bernilai uang & tidak bisa ditukar. Hasil acak ditentukan server; RTP ≈ 96%."}
    </p>
  );
}

// ═════════════════════════ PLINKO ═════════════════════════
const warnaSel = (m) => (m >= 100 ? "#dc2626" : m >= 26 ? "#ea580c" : m >= 5 ? "#f59e0b" : m >= 1.5 ? "#eab308" : m >= 1 ? "#84cc16" : "#64748b");

function Bola({ n, jalur, dx, rowH, top, onMendarat, onPasak, cepat }) {
  const [p, setP] = useState({ x: 0, y: 0, jejak: [] });
  const jejak = useRef([]);
  const iTerakhir = useRef(-1);
  useEffect(() => {
    const per = cepat ? 70 : 150; // ms per baris
    const total = per * (jalur.length + 1);
    const t0 = performance.now();
    let id;
    const pos = (i) => { let k = 0; for (let a = 0; a < i; a++) k += jalur[a]; return (k - i / 2) * dx; };
    const langkah = (t) => {
      const e = t - t0;
      const f = Math.min(jalur.length + 1, e / per);
      const i = Math.min(jalur.length, Math.floor(f));
      const u = f - i;
      const x0 = pos(i), x1 = i < jalur.length ? pos(i + 1) : x0;
      const y0 = top + i * rowH;
      const loncat = Math.abs(Math.sin(u * Math.PI)) * rowH * 0.45; // pantul kecil di tiap pasak
      if (i !== iTerakhir.current) {
        iTerakhir.current = i;
        let k = 0; for (let a = 0; a < i; a++) k += jalur[a];
        if (i < jalur.length) onPasak?.(i, k); // baris terakhir = kotak hadiah, bukan pasak
      }
      const px = x0 + (x1 - x0) * u, py = y0 + (i < jalur.length ? u * rowH : 0) - (i < jalur.length ? loncat : 0);
      jejak.current = [...jejak.current.slice(-6), { x: px, y: py }];
      setP({ x: px, y: py, jejak: jejak.current });
      if (e < total) id = requestAnimationFrame(langkah);
      else onMendarat(n);
    };
    id = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const r = Math.max(5, dx * 0.2);
  return (
    <g>
      {p.jejak.slice(0, -1).map((q, i, a) => <circle key={i} cx={q.x} cy={q.y} r={r * (0.35 + 0.5 * ((i + 1) / a.length))} className="ws-jejak" opacity={0.08 + 0.3 * ((i + 1) / a.length)} />)}
      <circle cx={p.x} cy={p.y} r={r} className="ws-bola" />
    </g>
  );
}

export function LayarPlinko({ onTutup }) {
  const s = useSolo();
  const wa = useWa();
  const { info, mode, bet } = s;
  const [baris, setBaris] = useState(12);
  const [risiko, setRisiko] = useState("sedang");
  const [bola, setBola] = useState([]); // bola yang sedang jatuh
  const [riwayat, setRiwayat] = useState([]);
  const [sorot, setSorot] = useState(null);
  const [auto, setAuto] = useState(0); // sisa auto-drop
  const [sibuk, setSibuk] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [aturan, setAturan] = useState(false);
  const [terakhir, setTerakhir] = useState(null);
  const noBola = useRef(0);
  const autoRef = useRef(0);
  const hidup = useRef(true);
  const tertunda = useRef({});
  const [nyala, setNyala] = useState({}); // pasak yang baru terkena bola → menyala sebentar
  const [ledakan, setLedakan] = useState(null); // { sel, n, x }
  const [goyang, setGoyang] = useState(false);
  useEffect(() => () => { hidup.current = false; }, []);
  useMusik("lounge");

  const pasakKena = useCallback((i, k) => {
    bunyi("pasak", { baris: i });
    const kunci = `${i}-${k}`;
    setNyala((m) => ({ ...m, [kunci]: (m[kunci] || 0) + 1 }));
    setTimeout(() => hidup.current && setNyala((m) => { if (!m[kunci]) return m; const b = { ...m }; b[kunci] = (b[kunci] || 1) - 1; if (b[kunci] <= 0) delete b[kunci]; return b; }), 260);
  }, []);

  const tabel = info?.plinko.meta[risiko]?.[baris]?.tabel || [];
  const rtp = info?.plinko.meta[risiko]?.[baris]?.rtp;
  const W = 640;
  const dx = (W - 60) / (baris + 1);
  const rowH = Math.min(30, 330 / baris);
  const top = 30;
  const H = top + baris * rowH + 64;

  const mendarat = useCallback((n) => {
    const t = tertunda.current[n];
    delete tertunda.current[n];
    setBola((b) => b.filter((x) => x.n !== n));
    if (!t || !hidup.current) return;
    setSorot({ sel: t.hasil.sel, n });
    bunyi("mendarat", { pengali: t.pengali });
    if (t.pengali >= 1.5) { setLedakan({ sel: t.hasil.sel, n, x: t.pengali }); setTimeout(() => hidup.current && setLedakan((l) => (l?.n === n ? null : l)), 1300); }
    if (t.pengali >= 26) { setGoyang(true); setTimeout(() => hidup.current && setGoyang(false), 700); }
    setTimeout(() => hidup.current && setSorot((x) => (x?.n === n ? null : x)), 900);
    setRiwayat((r) => [{ x: t.pengali, untung: t.untung, id: n }, ...r].slice(0, 12));
    setTerakhir(t);
    if (t.mode === "demo") s.setKoin(t.saldo); else { s.setSaldo(t.saldo); s.refreshBalance?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jatuhkan = useCallback(async () => {
    if (sibuk) return false;
    setSibuk(true);
    const r = await s.main("plinko", { baris, risiko });
    if (!hidup.current) return false;
    if (!r.ok) { wa.toast(r.error || "Gagal menjatuhkan bola."); setSibuk(false); autoRef.current = 0; setAuto(0); return false; }
    const n = ++noBola.current;
    tertunda.current[n] = r.data;
    // Saldo langsung dipotong di tampilan (taruhan), hadiah menyusul saat bola mendarat.
    if (r.data.mode === "demo") s.setKoin((k) => k - r.data.bet); else s.setSaldo((k) => k - r.data.bet);
    setBola((b) => [...b, { n, jalur: r.data.hasil.jalur }]);
    setSibuk(false);
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sibuk, baris, risiko, s.main]);

  // Auto-drop: satu bola tiap ~0.9 dtk sampai habis atau gagal.
  useEffect(() => {
    if (!auto) return undefined;
    const id = setTimeout(async () => {
      if (autoRef.current <= 0) return;
      const ok = await jatuhkan();
      if (!ok) return;
      autoRef.current -= 1; setAuto(autoRef.current);
    }, turbo ? 350 : 900);
    return () => clearTimeout(id);
  }, [auto, jatuhkan, turbo, bola.length]);

  const mulaiAuto = (n) => { autoRef.current = n; setAuto(n); };
  const kunci = bola.length > 0 || auto > 0;

  return (
    <div className="wg-layar ws-layar" role="dialog" aria-label="Plinko" onClickCapture={bunyiKlik}>
      <header className="wa-kepala wg-kepala">
        <button className="wa-ikon" onClick={onTutup} aria-label="Kembali"><Ik n="back" s={22} /></button>
        <div className="wg-judul"><b>🔮 Plinko</b><small>Solo · RTP ≈ {rtp ? (rtp * 100).toFixed(1) : "96"}% · maks {tabel.length ? fmtX(Math.max(...tabel)) : "…"}</small></div>
        <TombolSuara />
        <button className="wa-ikon" onClick={() => setAturan(true)} aria-label="Cara main"><Ik n="info" s={22} /></button>
      </header>
      <div className="wg-isi ws-isi">
        {!info && <div className="wa-memuat"><span className="wa-spin" /> Memuat…</div>}
        {info && !info.aktif && <div className="wa-galat-blok"><span>🔮</span><p>Game solo sedang ditutup admin.</p></div>}
        {info?.aktif && (
          <>
            <div className="ws-pilih">
              <div className="ws-seg" role="group" aria-label="Jumlah baris">
                {info.plinko.baris.map((n) => <button key={n} className={baris === n ? "on" : ""} disabled={kunci} onClick={() => setBaris(n)} data-testid={`pl-baris-${n}`}>{n}</button>)}
                <small>baris</small>
              </div>
              <div className="ws-seg" role="group" aria-label="Risiko">
                {info.plinko.risiko.map((r) => <button key={r} className={`${risiko === r ? "on" : ""} r-${r}`} disabled={kunci} onClick={() => setRisiko(r)} data-testid={`pl-risiko-${r}`}>{r}</button>)}
                <small>risiko</small>
              </div>
            </div>

            <div className={`ws-plinko${goyang ? " goyang" : ""}`} data-testid="plinko-papan">
              <svg viewBox={`${-W / 2} 0 ${W} ${H}`} role="img" aria-label="Papan Plinko">
                {Array.from({ length: baris }, (_, i) => Array.from({ length: i + 1 }, (_, j) => (
                  <circle key={`${i}-${j}`} cx={(j - i / 2) * dx} cy={top + i * rowH} r={Math.max(2.2, dx * 0.07) * (nyala[`${i}-${j}`] ? 1.9 : 1)} className={`ws-pasak${nyala[`${i}-${j}`] ? " nyala" : ""}`} />
                )))}
                {tabel.map((m, k) => (
                  <g key={k} transform={`translate(${(k - baris / 2) * dx},${top + baris * rowH + 12})`} className={sorot?.sel === k ? "ws-sel on" : "ws-sel"}>
                    <rect x={-dx / 2 + 2} y={0} width={dx - 4} height={34} rx={7} fill={warnaSel(m)} />
                    <text y={22} textAnchor="middle" fontSize={dx > 34 ? 13 : 10} fontWeight="900" fill="#fff">{m >= 100 ? Math.round(m) : m}</text>
                  </g>
                ))}
                {ledakan && (
                  <g key={ledakan.n} transform={`translate(${(ledakan.sel - baris / 2) * dx},${top + baris * rowH + 12})`} className="ws-ledakan" aria-hidden="true">
                    {Array.from({ length: ledakan.x >= 26 ? 14 : 8 }, (_, i) => {
                      const a = (Math.PI * (i + 0.5)) / (ledakan.x >= 26 ? 14 : 8);
                      return <circle key={i} r={4.5} cx={0} cy={0} style={{ "--dx": `${-Math.cos(a) * (40 + (i % 3) * 22)}px`, "--dy": `${-Math.sin(a) * (70 + (i % 4) * 26)}px`, animationDelay: `${(i % 4) * 30}ms` }} />;
                    })}
                  </g>
                )}
                {bola.map((b) => <Bola key={b.n} n={b.n} jalur={b.jalur} dx={dx} rowH={rowH} top={top - 14} onMendarat={mendarat} onPasak={pasakKena} cepat={turbo} />)}
              </svg>
            </div>

            <div className="ws-riwayat" aria-label="Hasil terakhir">
              {riwayat.length === 0 && <span className="ws-kosong">Hasil bola tampil di sini</span>}
              {riwayat.map((h) => <span key={h.id} className={h.untung >= 0 ? "menang" : "kalah"} style={{ background: warnaSel(h.x) }}>{fmtX(h.x)}</span>)}
            </div>

            {terakhir && bola.length === 0 && (
              <p className={`ws-hasil-baris ${terakhir.untung >= 0 ? "menang" : "kalah"}`} data-testid="plinko-hasil" role="status">
                {fmtX(terakhir.pengali)} · {terakhir.untung >= 0 ? "+" : "−"}{terakhir.mode === "demo" ? `${Math.abs(terakhir.untung).toLocaleString("id-ID")} koin` : rp(Math.abs(terakhir.untung))}
              </p>
            )}

            <PanelDompet s={s} kunci={kunci} />
            <div className="ws-aksi">
              <button className="wa-tombol utama ws-besar" onClick={jatuhkan} disabled={sibuk || auto > 0 || (info && s.dompet < bet)} data-testid="plinko-jatuh">🔮 Jatuhkan bola</button>
              {auto > 0
                ? <button className="wa-tombol bahaya" onClick={() => { autoRef.current = 0; setAuto(0); }}>Stop auto ({auto})</button>
                : <button className="wa-tombol" onClick={() => mulaiAuto(10)} disabled={sibuk || bola.length > 0}>Auto ×10</button>}
              <button className={`wa-tombol${turbo ? " utama" : ""}`} onClick={() => setTurbo((t) => !t)} aria-pressed={turbo}>⚡ Turbo</button>
            </div>
            <Pengingat mode={mode} />
          </>
        )}
      </div>
      {aturan && (
        <Lembar judul="Cara main Plinko" onTutup={() => setAturan(false)} lebar={440}>
          <ul className="wg-aturan">
            <li>Pilih taruhan, jumlah baris (8–16), dan risiko, lalu jatuhkan bola. Di tiap pasak bola memilih kiri/kanan dengan peluang sama.</li>
            <li>Bola mendarat di salah satu kotak bawah: hadiah = taruhan × angka kotak. Tepi jarang kena tapi besar; tengah sering tapi kecil.</li>
            <li>Risiko rendah: hadiah merata. Tinggi: sering kalah, sesekali sangat besar (hingga ×1000 pada 16 baris).</li>
            <li>RTP (pengembalian jangka panjang) ≈ {(RTP_TAMPIL * 100).toFixed(0)}% di semua pilihan. Hasil ditentukan server dengan acak kriptografis <i>sebelum</i> bola dianimasikan — tidak bisa dipengaruhi klien.</li>
            <li>Auto ×10 menjatuhkan 10 bola berurutan. Koin latihan tidak bernilai uang; mode saldo hanya jika admin mengaktifkannya dan ada batas rugi harian.</li>
          </ul>
        </Lembar>
      )}
    </div>
  );
}
const RTP_TAMPIL = 0.96;

// ═════════════════════════ MAHJONG SPIN 1024 ═════════════════════════
/** Angka yang menghitung naik (efek "koin berhitung" saat menang besar). */
function CacahAngka({ nilai, format }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t0 = performance.now(), dur = 1500;
    let id;
    const f = (t) => { const u = Math.min(1, (t - t0) / dur); setV(Math.round(nilai * (1 - (1 - u) ** 3))); if (u < 1) id = requestAnimationFrame(f); };
    id = requestAnimationFrame(f);
    return () => cancelAnimationFrame(id);
  }, [nilai]);
  return <em>+{format(v)}</em>;
}

const gridKosong = () => Array.from({ length: 5 }, () => Array.from({ length: 4 }, () => null));

export function LayarSlot({ onTutup }) {
  const s = useSolo();
  const wa = useWa();
  const { info, mode, bet } = s;
  const [grid, setGrid] = useState(() => Array.from({ length: 5 }, (_, c) => Array.from({ length: 4 }, (_, r) => [(c * 3 + r * 2) % 9, 0])));
  const [efek, setEfek] = useState({ menang: new Set(), hilang: new Set(), jatuh: new Set(), berubah: new Set() });
  const [putar, setPutar] = useState(false);
  const [kombo, setKombo] = useState(-1);
  const [gratis, setGratis] = useState(null); // { no, dari, tipe }
  const [total, setTotal] = useState(0); // pengali terkumpul (animasi)
  const [pesan, setPesan] = useState("");
  const [akhir, setAkhir] = useState(null);
  const [turbo, setTurbo] = useState(false);
  const [aturan, setAturan] = useState(false);
  const [bayarTabel, setBayarTabel] = useState(false);
  const [berputar, setBerputar] = useState(() => new Set()); // gulungan yang masih berputar
  const [tekan, setTekan] = useState(() => new Set()); // gulungan yang baru berhenti (efek hentak)
  const [naga, setNaga] = useState(0); // naga terbang melintas (kunci animasi)
  const [hujan, setHujan] = useState(0); // hujan koin emas (kunci animasi)
  const [banner, setBanner] = useState(null); // { teks, tingkat, nilai }
  const [goyang, setGoyang] = useState(false);
  const lewati = useRef(false);
  const hidup = useRef(true);
  useEffect(() => () => { hidup.current = false; }, []);
  useMusik("oriental");
  const jeda = (ms) => (lewati.current ? Promise.resolve() : tidur(turbo ? ms * 0.45 : ms));
  const kunci = putar;

  const kunciSel = (cs) => new Set(cs.map(([c, r]) => `${c}-${r}`));

  const acakKolom = () => Array.from({ length: 4 }, () => [Math.floor(Math.random() * 9), 0]);
  /** Gulungan berputar lalu berhenti satu per satu dari kiri (seperti mesin slot sungguhan). */
  async function gulung(awal) {
    if (lewati.current) { setGrid(awal); return; }
    bunyi("putar");
    setBerputar(new Set([0, 1, 2, 3, 4]));
    const henti = new Set();
    const iv = setInterval(() => setGrid((g) => g.map((k, c) => (henti.has(c) ? k : acakKolom()))), 85);
    try {
      for (let c = 0; c < 5 && hidup.current; c++) {
        await jeda(c === 0 ? 430 : 170);
        henti.add(c);
        setGrid((g) => g.map((k, i) => (i === c ? awal[c] : k)));
        setBerputar((x) => { const n = new Set(x); n.delete(c); return n; });
        setTekan((x) => new Set(x).add(c));
        setTimeout(() => hidup.current && setTekan((x) => { const n = new Set(x); n.delete(c); return n; }), 320);
        bunyi("berhenti", { kolom: c });
      }
    } finally { clearInterval(iv); setBerputar(new Set()); }
    setGrid(awal);
  }
  const terbangkanNaga = (suara = true) => { setNaga((n) => n + 1); if (suara) bunyi("naga"); };

  async function animasi(data) {
    const { putaran } = data.hasil;
    let nagaEmas = false;
    let kumpul = 0;
    const totalFs = putaran.length - 1;
    for (let p = 0; p < putaran.length && hidup.current; p++) {
      const pt = putaran[p];
      if (p === 0) setGratis(null);
      else setGratis({ no: p, dari: totalFs, tipe: "gratis" });
      if (p === 1) { setPesan(`🎁 PUTARAN GRATIS! ${totalFs} putaran`); bunyi("gratis"); terbangkanNaga(false); await jeda(1700); }
      setKombo(-1);
      setEfek({ menang: new Set(), hilang: new Set(), jatuh: new Set(), berubah: new Set() });
      await gulung(pt.awal);
      await jeda(p === 0 ? 350 : 300);
      if (pt.scatter >= 3 && p === 0) { setPesan(`🎁 ${pt.scatter} SCATTER — putaran gratis!`); bunyi("scatter"); await jeda(900); }
      if (pt.tahap.length === 0 && p > 0) await jeda(250);
      for (let t = 0; t < pt.tahap.length && hidup.current; t++) {
        const th = pt.tahap[t];
        const ikut = new Set();
        // Sel yang menang = sel yang hilang atau berubah jadi wild.
        [...th.hapus, ...th.emas].forEach(([c, r]) => ikut.add(`${c}-${r}`));
        setKombo(t);
        bunyi("kombo", { level: t });
        setEfek({ menang: ikut, hilang: new Set(), jatuh: new Set(), berubah: new Set() });
        kumpul += th.tambah; setTotal(kumpul);
        setPesan(`+${th.tambah.toLocaleString("id-ID", { maximumFractionDigits: 2 })}× (kombo ×${th.mult})`);
        await jeda(850);
        setEfek({ menang: ikut, hilang: kunciSel(th.hapus), jatuh: new Set(), berubah: kunciSel(th.emas) });
        bunyi("pecah");
        if (th.emas.length && !nagaEmas) { nagaEmas = true; terbangkanNaga(true); } else if (th.emas.length) bunyi("pop");
        await jeda(420);
        // Ubin emas berubah jadi wild di tempat; sel lain jatuh.
        const jatuh = new Set();
        for (let c = 0; c < 5; c++) {
          const hapusBaris = th.hapus.filter(([cc]) => cc === c).map(([, r]) => r);
          if (hapusBaris.length) { const maks = Math.max(...hapusBaris); for (let r = 0; r <= maks; r++) jatuh.add(`${c}-${r}`); }
        }
        setGrid(th.grid);
        bunyi("jatuh");
        setEfek({ menang: new Set(), hilang: new Set(), jatuh, berubah: new Set() });
        await jeda(650);
      }
      if (p === 0 && putaran.length > 1) await jeda(500);
      if (pt.tambahan) { setPesan(`🎁 +${pt.tambahan} putaran gratis!`); await jeda(1000); }
    }
    setEfek({ menang: new Set(), hilang: new Set(), jatuh: new Set(), berubah: new Set() });
    setKombo(-1);
    setGratis(null);
  }

  async function putarSekarang() {
    if (putar) return;
    setPutar(true); setAkhir(null); setPesan(""); setTotal(0); lewati.current = false;
    const r = await s.main("slot", {});
    if (!hidup.current) return;
    if (!r.ok) { wa.toast(r.error || "Gagal memutar."); setPutar(false); return; }
    const d = r.data;
    if (d.mode === "demo") s.setKoin((k) => k - d.bet); else s.setSaldo((k) => k - d.bet);
    await animasi(d);
    if (!hidup.current) return;
    setTotal(d.pengali);
    if (d.mode === "demo") s.setKoin(d.saldo); else { s.setSaldo(d.saldo); s.refreshBalance?.(); }
    setAkhir(d);
    setPesan("");
    setPutar(false);
    // Perayaan kemenangan: makin besar makin meriah.
    const tingkat = d.pengali >= 500 ? 4 : d.pengali >= 100 ? 3 : d.pengali >= 30 ? 2 : d.pengali >= 10 ? 1 : 0;
    if (tingkat > 0) {
      const teks = ["BIG WIN", "MEGA WIN", "SUPER WIN", "LEGENDARY WIN"][tingkat - 1];
      bunyi("menangBesar");
      setBanner({ teks, tingkat, nilai: d.bayar, kunci: Date.now() });
      setHujan((n) => n + 1);
      terbangkanNaga(false);
      setGoyang(true);
      setTimeout(() => hidup.current && setGoyang(false), 900);
      setTimeout(() => hidup.current && setBanner(null), 3800);
    } else if (d.bayar > 0) bunyi("menang");
  }

  const info2 = info?.slot;
  const besar = akhir && akhir.pengali >= 10;
  const koinTeks = (n) => (mode === "demo" ? `${Math.abs(n).toLocaleString("id-ID")} koin` : rp(Math.abs(n)));
  const ladder = gratis ? info2?.ladderGratis : info2?.ladderDasar;

  return (
    <div className={`wg-layar ws-layar ws-slot${goyang ? " goyang" : ""}`} role="dialog" aria-label="Mahjong Spin 1024" onClickCapture={bunyiKlik}>
      <header className="wa-kepala wg-kepala">
        <button className="wa-ikon" onClick={onTutup} aria-label="Kembali" disabled={putar}><Ik n="back" s={22} /></button>
        <div className="wg-judul"><b>🀄 Mahjong Spin 1024</b><small>Solo · RTP ≈ 96% · maks ×{info2?.maksPengali ?? 5000}</small></div>
        <TombolSuara />
        <button className="wa-ikon" onClick={() => setBayarTabel(true)} aria-label="Tabel bayar"><Ik n="info" s={22} /></button>
      </header>
      <div className="wg-isi ws-isi">
        {!info && <div className="wa-memuat"><span className="wa-spin" /> Memuat…</div>}
        {info && !info.aktif && <div className="wa-galat-blok"><span>🀄</span><p>Game solo sedang ditutup admin.</p></div>}
        {info?.aktif && (
          <>
            <div className="sl-judul" aria-hidden="true"><span className="naga">🐉</span><b><em>麻雀</em> MAHJONG WAYS</b><span className="naga kanan">🐉</span></div>
            <div className="sl-kombo" aria-label="Pengali kombo">
              {ladder?.map((m, i) => <span key={i} className={kombo >= 0 && i === Math.min(kombo, ladder.length - 1) ? "on" : ""}>×{m}</span>)}
              {gratis && <em className="sl-gratis" data-testid="slot-gratis">Gratis {gratis.no}/{gratis.dari}</em>}
            </div>

            <div className={`sl-papan${gratis ? " gratis" : ""}`} data-testid="slot-papan">
              {grid.map((kol, c) => (
                <div key={c} className={`sl-kol${berputar.has(c) ? " putar" : ""}`}>
                  {kol.map((sel, r) => {
                    const k = `${c}-${r}`;
                    const kelas = [efek.menang.has(k) ? "menang" : "", efek.hilang.has(k) ? "hilang" : "", efek.jatuh.has(k) ? "jatuh" : "", efek.berubah.has(k) ? "berubah" : "", tekan.has(c) ? "tekan" : ""].join(" ");
                    return <Ubin key={`${k}-${efek.jatuh.has(k) ? "j" : "n"}-${sel?.[0]}-${sel?.[1]}`} sel={sel} kelas={kelas} gaya={efek.jatuh.has(k) ? { animationDelay: `${c * 55}ms` } : undefined} />;
                  })}
                </div>
              ))}
            </div>

            <div className="sl-status" aria-live="polite">
              {pesan ? <b data-testid="slot-pesan">{pesan}</b> : akhir ? (
                <b data-testid="slot-hasil" className={akhir.untung >= 0 ? "menang" : "kalah"}>
                  {akhir.bayar > 0 ? `${besar ? "🎉 BIG WIN! " : "Menang "}${fmtX(akhir.pengali)} · +${koinTeks(akhir.bayar)}` : "Belum beruntung — coba lagi!"}
                  {akhir.hasil.gratis > 0 && <small> · {akhir.hasil.gratis} putaran gratis</small>}
                </b>
              ) : <span>Putar untuk mulai. Cocokkan 3+ gulungan dari kiri.</span>}
              {total > 0 && putar && <small data-testid="slot-total">Total ×{total.toLocaleString("id-ID", { maximumFractionDigits: 2 })}</small>}
            </div>
            {besar && !putar && <div className="wg-konfeti ws-konfeti" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ "--i": i }} />)}</div>}
            {hujan > 0 && <div key={hujan} className="sl-hujan" aria-hidden="true">{Array.from({ length: 26 }, (_, i) => <span key={i} style={{ "--i": i, "--x": `${(i * 37) % 100}%`, "--d": `${(i % 9) * 0.12}s` }}>🪙</span>)}</div>}
            {naga > 0 && <div key={`n${naga}`} className="sl-naga" aria-hidden="true">🐉</div>}
            {banner && (
              <div key={banner.kunci} className={`sl-banner t${banner.tingkat}`} role="status" data-testid="slot-banner" onClick={() => setBanner(null)}>
                <small>🪙 🪙 🪙</small>
                <b>{banner.teks}</b>
                <CacahAngka nilai={banner.nilai} format={koinTeks} />
              </div>
            )}

            <PanelDompet s={s} kunci={kunci} />
            <div className="ws-aksi">
              <button className="wa-tombol utama ws-besar" onClick={putarSekarang} disabled={putar || (info && s.dompet < bet)} data-testid="slot-putar">{putar ? "Berputar…" : "🀄 PUTAR"}</button>
              {putar && <button className="wa-tombol" onClick={() => { lewati.current = true; }} data-testid="slot-lewati">⏩ Lewati</button>}
              <button className={`wa-tombol${turbo ? " utama" : ""}`} onClick={() => setTurbo((t) => !t)} aria-pressed={turbo}>⚡ Turbo</button>
              <button className="wa-tombol" onClick={() => setAturan(true)}>?</button>
            </div>
            <Pengingat mode={mode} />
          </>
        )}
      </div>

      {aturan && (
        <Lembar judul="Cara main Mahjong Spin 1024" onTutup={() => setAturan(false)} lebar={460}>
          <ul className="wg-aturan">
            <li><b>1024 jalur:</b> 5 gulungan × 4 baris. Menang bila simbol yang sama muncul di 3+ gulungan berurutan dari kiri; jumlah jalur = perkalian jumlah simbol itu di tiap gulungan.</li>
            <li><b>Kaskade:</b> ubin yang menang hilang, ubin lain jatuh dan ubin baru masuk — bisa menang berantai. Pengali kombo naik: ×1 → ×2 → ×3 → ×5 (putaran gratis: ×2 → ×4 → ×6 → ×10).</li>
            <li><b>Ubin emas</b> (gulungan 2–4): bila ikut menang, berubah menjadi <b>WILD</b> di tempatnya. WILD (gulungan 2–4) menggantikan ubin biasa.</li>
            <li><b>3+ SCATTER 福</b> = {10} putaran gratis (+2 per scatter tambahan). Di putaran gratis, 3+ scatter menambah putaran. Maksimal {40} putaran gratis.</li>
            <li>Batas kemenangan {info2?.maksPengali ?? 5000}× taruhan per ronde. RTP ≈ 96%. Hasil seluruh ronde (termasuk putaran gratis) ditentukan server dengan acak kriptografis sebelum dianimasikan; “Lewati” hanya mempercepat tampilan.</li>
            <li>Koin latihan tidak bernilai uang. Mode saldo game hanya jika admin mengaktifkannya dan ada batas rugi harian. Main untuk hiburan.</li>
          </ul>
        </Lembar>
      )}
      {bayarTabel && info2 && (
        <Lembar judul="Tabel bayar" onTutup={() => setBayarTabel(false)} lebar={460}>
          <p className="wa-kosong-kecil" style={{ textAlign: "left" }}>Pengali × taruhan × jumlah jalur, untuk 3 / 4 / 5 gulungan (sebelum pengali kombo). Taruhan saat ini: {mode === "demo" ? `${bet} koin` : rp(bet)}.</p>
          <div className="sl-tabel">
            {info2.bayar.map((b, i) => (
              <div key={i} className="baris">
                <Ubin sel={[i, 0]} />
                {b.map((x, j) => <span key={j}><small>{j + 3} gulungan</small><b>{fmtX(x)}</b></span>)}
              </div>
            ))}
            <div className="baris"><Ubin sel={[WILD, 0]} /><span style={{ gridColumn: "2 / 5" }}><small>WILD menggantikan semua ubin biasa (gulungan 2–4)</small></span></div>
            <div className="baris"><Ubin sel={[SCATTER, 0]} /><span style={{ gridColumn: "2 / 5" }}><small>3+ scatter memicu putaran gratis</small></span></div>
          </div>
        </Lembar>
      )}
    </div>
  );
}

// ═════════════════════════ KARTU KATALOG (dipakai TabGame) ═════════════════════════
export function KatalogSolo({ onBuka, aktif = true }) {
  return (
    <div className="wg-katalog ws-katalog" data-testid="katalog-solo">
      {KATALOG_SOLO.map((p) => (
        <div key={p.kode} className="wg-kartu-game ws-kartu">
          <button className="wg-kartu-utama" onClick={() => onBuka(p.kode)} disabled={!aktif} data-testid={`solo-${p.kode}`}>
            <span className="ikon">{p.ikon}</span>
            <b>{p.nama}</b>
            <small>{p.ringkas}</small>
            <em className="ws-lencana">SOLO</em>
          </button>
        </div>
      ))}
    </div>
  );
}
