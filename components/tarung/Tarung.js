"use client";

// Arena Pendekar — layar game tarung: hub (arkade, tarung cepat, latihan, duel vs pemain), pilih petarung dengan
// pratinjau bergerak, layar VS, arena real-time dengan tombol sentuh/keyboard, hasil, serta papan duel antar pengguna.
import { useCallback, useEffect, useRef, useState } from "react";
import { Dunia } from "@/components/tarung/dunia";
import { Sutradara } from "@/components/tarung/sutradara";
import { muatSemua, urlPotret } from "@/components/tarung/sprite";
import { KARAKTER, URUTAN_KARAKTER, ARENA, URUTAN_ARENA, BIAYA_JURUS, BIAYA_PAMUNGKAS } from "@/lib/tarung/karakter";
import { efek as bunyi, pembawaAcara, bangunkan } from "@/lib/suara";
import { TombolSuara, useMusik, bunyiKlik } from "@/components/wa/Suara";
import SeasonArena from "@/components/tarung/SeasonArena";
import "@/components/tarung/tarung.css";

const KUNCI = "artapedia_tarung_v1";
const LEVEL = ["Mudah", "Sedang", "Sulit"];
const bacaRekor = () => { try { return JSON.parse(localStorage.getItem(KUNCI) || "{}") || {}; } catch { return {}; } };
const simpanRekor = (r) => { try { localStorage.setItem(KUNCI, JSON.stringify(r)); } catch {} };
const acakDari = (xs) => xs[Math.floor(Math.random() * xs.length)];
const getar = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

// ═════════════════════════ KANVAS DUNIA ═════════════════════════
/** Kanvas yang menjalankan & menggambar dunia (ref) tiap bingkai. onTik dipanggil ±7×/detik untuk HUD DOM. */
function KanvasDunia({ dunia, className = "", onTik, label = "Arena" }) {
  const ref = useRef(null);
  const tik = useRef(onTik);
  tik.current = onTik;
  useEffect(() => {
    const c = ref.current;
    if (!c) return undefined;
    const ctx = c.getContext("2d");
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    let raf = 0, akhir = performance.now(), hidup = true, lambat = 0, jedaTik = 0;
    const ukur = () => {
      const r = c.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    };
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(ukur) : null;
    ro?.observe(c);
    ukur();
    const loop = (t) => {
      if (!hidup) return;
      const dt = Math.min(0.1, Math.max(0, (t - akhir) / 1000));
      akhir = t;
      const d = dunia.current;
      if (d && document.visibilityState === "visible") {
        d.langkah(dt);
        d.gambar(ctx, c.width, c.height);
        jedaTik -= dt;
        if (jedaTik <= 0) { jedaTik = 0.14; tik.current?.(d); }
        // HP lemah: turunkan resolusi & partikel bila bingkai lambat terus-menerus
        if (dt > 0.036) lambat++; else lambat = Math.max(0, lambat - 2);
        if (lambat > 80) { lambat = 0; if (dpr > 1) { dpr = 1; ukur(); } else { d.mutu = 0; d.ef.mutu = 0; } }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const lihat = () => { akhir = performance.now(); };
    document.addEventListener("visibilitychange", lihat);
    return () => { hidup = false; cancelAnimationFrame(raf); ro?.disconnect(); document.removeEventListener("visibilitychange", lihat); };
  }, [dunia]);
  return <canvas ref={ref} className={`tr-kanvas ${className}`} role="img" aria-label={label} />;
}

function opsiSuara(extra = {}) {
  return {
    onSuara: (nama, o) => bunyi(nama, o),
    onUmumkan: (teks) => pembawaAcara(teks),
    ...extra
  };
}

// ═════════════════════════ POTRET ═════════════════════════
function Potret({ kid, cermin = false, className = "", besar = false }) {
  const k = KARAKTER[kid];
  if (!k) return <span className={`tr-potret kosong ${className}`}>?</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`tr-potret ${besar ? "besar" : ""} ${cermin ? "cermin" : ""} ${className}`} src={urlPotret(k)} alt={k.nama} draggable={false} style={{ "--aura": k.rupa.aura }} />
  );
}

function BarNilai({ label, nilai }) {
  return (
    <div className="tr-nilai"><span>{label}</span><b>{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < nilai ? "on" : ""} />)}</b></div>
  );
}

// ═════════════════════════ PILIH PETARUNG ═════════════════════════
/** Pratinjau bergerak petarung terpilih di arenanya. */
function Pratinjau({ kid }) {
  const dunia = useRef(null);
  if (!dunia.current || dunia.current.f[0].kid !== kid) {
    dunia.current = new Dunia({ mode: "pajang", p1: kid, p2: kid === "garuda" ? "naga" : "garuda", arena: KARAKTER[kid].arena, ...opsiSuara({ onSuara: () => {}, onUmumkan: () => {} }) });
  }
  return <KanvasDunia dunia={dunia} className="tr-pratinjau" label={`Pratinjau ${KARAKTER[kid].nama}`} />;
}

export function PilihPetarung({ judul = "PILIH PETARUNG", tombol = "PILIH", awal = "garuda", onPilih, onKembali, kunci = false, catatan = null }) {
  const [kid, setKid] = useState(awal);
  const k = KARAKTER[kid];
  return (
    <div className="tr-pilih" data-testid="tr-pilih">
      <div className="tr-pilih-atas">
        {onKembali && <button className="tr-bulat" onClick={onKembali} aria-label="Kembali">‹</button>}
        <h2>{judul}</h2>
      </div>
      <div className="tr-pilih-isi">
        <div className="tr-panggung">
          <Pratinjau kid={kid} />
          <div className="tr-nama-besar"><b>{k.nama}</b><small>{k.gelar} · {k.gaya}</small></div>
        </div>
        <div className="tr-detail">
          <p className="tr-cerita">{k.cerita}</p>
          <div className="tr-nilai-daftar">
            <BarNilai label="Nyawa" nilai={k.nilai.nyawa} /><BarNilai label="Kekuatan" nilai={k.nilai.kekuatan} />
            <BarNilai label="Kecepatan" nilai={k.nilai.kecepatan} /><BarNilai label="Pertahanan" nilai={k.nilai.pertahanan} />
            <BarNilai label="Teknik" nilai={k.nilai.teknik} />
          </div>
          <div className="tr-jurus"><b>{k.jurus.ikon} {k.jurus.nama}</b><small>Jurus · {BIAYA_JURUS} energi</small><p>{k.jurus.ket}</p></div>
          <div className="tr-jurus pamungkas"><b>⚡ {k.pamungkas.nama}</b><small>Pamungkas · energi penuh</small><p>{k.pamungkas.ket}</p></div>
        </div>
      </div>
      <div className="tr-roster" role="listbox" aria-label="Daftar petarung">
        {URUTAN_KARAKTER.map((id) => (
          <button key={id} role="option" aria-selected={id === kid} className={`tr-ubin${id === kid ? " aktif" : ""}`} style={{ "--aura": KARAKTER[id].rupa.aura }} onClick={() => { setKid(id); bunyi("pilih"); }} data-testid={`tr-ubin-${id}`} disabled={kunci}>
            <Potret kid={id} /><span>{KARAKTER[id].nama}</span>
          </button>
        ))}
      </div>
      {catatan}
      <button className="tr-tombol utama besar" onClick={() => { bunyi("tJurus"); onPilih(kid); }} disabled={kunci} data-testid="tr-pilih-ok">{tombol}</button>
    </div>
  );
}

// ═════════════════════════ LAYAR VS ═════════════════════════
function LayarVs({ p1, p2, arena, sub, onLanjut }) {
  useEffect(() => {
    bunyi("tRonde");
    pembawaAcara(`${KARAKTER[p1].nama} melawan ${KARAKTER[p2].nama}`);
    const t = setTimeout(onLanjut, 2600);
    return () => clearTimeout(t);
  }, [p1, p2, onLanjut]);
  return (
    <div className="tr-vs" onClick={onLanjut} data-testid="tr-vs">
      <div className="tr-vs-sisi kiri" style={{ "--aura": KARAKTER[p1].rupa.aura }}><Potret kid={p1} besar /><b>{KARAKTER[p1].nama}</b><small>{KARAKTER[p1].gelar}</small></div>
      <div className="tr-vs-teks">VS</div>
      <div className="tr-vs-sisi kanan" style={{ "--aura": KARAKTER[p2].rupa.aura }}><Potret kid={p2} besar cermin /><b>{KARAKTER[p2].nama}</b><small>{KARAKTER[p2].gelar}</small></div>
      <div className="tr-vs-bawah">{sub && <em>{sub}</em>}<span>Arena: {ARENA[arena]?.nama}</span></div>
    </div>
  );
}

// ═════════════════════════ KONTROL SENTUH ═════════════════════════
const AKSI_TOMBOL = [
  { id: "pukul", ikon: "👊", label: "PUKUL", kelas: "a1" },
  { id: "tendang", ikon: "🦵", label: "TENDANG", kelas: "a2" },
  { id: "tangkis", ikon: "🛡️", label: "TANGKIS", kelas: "a3", tahan: true },
  { id: "banting", ikon: "🤼", label: "BANTING", kelas: "a4" },
  { id: "jurus", ikon: "✨", label: "JURUS", kelas: "a5", biaya: BIAYA_JURUS },
  { id: "pamungkas", ikon: "⚡", label: "PAMUNGKAS", kelas: "a6", biaya: BIAYA_PAMUNGKAS }
];

function Kontrol({ dunia, energi, kid }) {
  const tahan = (nama, nyala) => dunia.current?.arah(0, nama, nyala);
  const tombolTahan = (nama, isi, kelas, label) => (
    <button
      type="button" className={`tr-k ${kelas}`} aria-label={label} data-testid={`tr-k-${nama}`} data-senyap="1"
      onPointerDown={(e) => { e.preventDefault(); bangunkan(); e.currentTarget.setPointerCapture?.(e.pointerId); tahan(nama, true); getar(6); }}
      onPointerUp={() => tahan(nama, false)} onPointerCancel={() => tahan(nama, false)} onLostPointerCapture={() => tahan(nama, false)}
      onContextMenu={(e) => e.preventDefault()}
    >{isi}</button>
  );
  const ketuk = (aksi) => (e) => { e.preventDefault(); bangunkan(); dunia.current?.tekan(0, aksi); getar(10); };
  return (
    <div className="tr-kontrol" onContextMenu={(e) => e.preventDefault()}>
      <div className="tr-dpad">
        <button type="button" className="tr-k atas" aria-label="Lompat" data-testid="tr-k-lompat" data-senyap="1" onPointerDown={ketuk("lompat")}>▲</button>
        {tombolTahan("kiri", "◀", "kiri", "Kiri")}
        {tombolTahan("kanan", "▶", "kanan", "Kanan")}
        {tombolTahan("bawah", "▼", "bawah", "Jongkok")}
      </div>
      <div className="tr-aksi">
        {AKSI_TOMBOL.map((a) => {
          const kurang = a.biaya && energi < a.biaya;
          if (a.tahan) return <span key={a.id} className="tr-slot">{tombolTahan("tangkis", <><i>{a.ikon}</i><small>{a.label}</small></>, `aksi ${a.kelas}`, "Tangkis (tahan)")}</span>;
          return (
            <span key={a.id} className="tr-slot">
              <button type="button" className={`tr-k aksi ${a.kelas}${kurang ? " redup" : ""}${a.id === "pamungkas" && !kurang ? " siap" : ""}`} aria-label={a.label} data-testid={`tr-k-${a.id}`} data-senyap="1" onPointerDown={ketuk(a.id)} title={a.id === "jurus" ? KARAKTER[kid]?.jurus.nama : a.id === "pamungkas" ? KARAKTER[kid]?.pamungkas.nama : a.label}>
                <i>{a.ikon}</i><small>{a.label}</small>
                {a.biaya && <em className="tr-biaya">{Math.min(100, Math.floor((energi / a.biaya) * 100))}%</em>}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function useKeyboard(dunia, onJeda) {
  useEffect(() => {
    const tahan = { ArrowLeft: "kiri", a: "kiri", A: "kiri", ArrowRight: "kanan", d: "kanan", D: "kanan", ArrowDown: "bawah", s: "bawah", S: "bawah", l: "tangkis", L: "tangkis" };
    const tekan = { ArrowUp: "lompat", w: "lompat", W: "lompat", " ": "lompat", j: "pukul", J: "pukul", k: "tendang", K: "tendang", u: "banting", U: "banting", i: "jurus", I: "jurus", o: "pamungkas", O: "pamungkas" };
    const turun = (e) => {
      if (e.target?.closest?.("input,textarea")) return;
      if (e.key === "Escape" || e.key === "p" || e.key === "P") { onJeda(); return; }
      const d = dunia.current; if (!d) return;
      if (tahan[e.key]) { d.arah(0, tahan[e.key], true); e.preventDefault(); }
      else if (tekan[e.key] && !e.repeat) { d.tekan(0, tekan[e.key]); e.preventDefault(); }
    };
    const naik = (e) => { const d = dunia.current; if (d && tahan[e.key]) d.arah(0, tahan[e.key], false); };
    const lepas = () => dunia.current?.lepasSemua(0);
    window.addEventListener("keydown", turun);
    window.addEventListener("keyup", naik);
    window.addEventListener("blur", lepas);
    return () => { window.removeEventListener("keydown", turun); window.removeEventListener("keyup", naik); window.removeEventListener("blur", lepas); };
  }, [dunia, onJeda]);
}

// ═════════════════════════ ARENA SOLO ═════════════════════════
function ArenaSolo({ laga, onSelesai, onKeluar, onUlang, onGanti, onLanjut, panduan }) {
  const dunia = useRef(null);
  const [energi, setEnergi] = useState(0);
  const [jeda, setJeda] = useState(false);
  const [hasil, setHasil] = useState(null);
  const [boneka, setBoneka] = useState(laga.boneka || "diam");
  const wadah = useRef(null);
  useMusik("tarung");
  const kunciLaga = `${laga.p1}-${laga.p2}-${laga.level}-${laga.mode}-${boneka}-${laga.nomor || 0}`;
  const kunciRef = useRef("");
  if (kunciRef.current !== kunciLaga) {
    kunciRef.current = kunciLaga;
    dunia.current = new Dunia({
      mode: laga.mode === "latihan" ? "latihan" : "solo", p1: laga.p1, p2: laga.p2, level: laga.level, arena: laga.arena,
      boneka, energiPenuh: laga.mode === "latihan",
      ...opsiSuara({ onAcara: (nama, data) => { if (nama === "selesai") setTimeout(() => setHasil(data), 2600); } })
    });
  }
  useEffect(() => { setHasil(null); }, [kunciLaga]);
  useEffect(() => { if (dunia.current) dunia.current.jeda = jeda || !!hasil; }, [jeda, hasil]);
  useEffect(() => { if (hasil) onSelesai?.(hasil); }, [hasil, onSelesai]);
  const bukaJeda = useCallback(() => setJeda((j) => !j), []);
  useKeyboard(dunia, bukaJeda);
  const onTik = useCallback((d) => {
    setEnergi(Math.floor(d.f[0].energi));
    const w = wadah.current;
    if (w) { w.dataset.fase = d.fase; w.dataset.hp1 = Math.round(d.f[0].hp); w.dataset.hp2 = Math.round(d.f[1].hp); w.dataset.ronde = d.ronde; w.dataset.menang = d.menang.join("-"); }
  }, []);
  const menang = hasil?.pemenang === 0, seri = hasil && hasil.pemenang == null;
  const st = hasil?.statistik?.[0];
  return (
    <div className="tr-arena" ref={wadah} data-testid="tr-arena">
      <div className="tr-layar-tarung">
        <KanvasDunia dunia={dunia} onTik={onTik} label="Arena tarung" />
        <div className="tr-atas-arena">
          <button className="tr-bulat" onClick={() => setJeda(true)} aria-label="Jeda" data-testid="tr-jeda">II</button>
          <TombolSuara className="tr-suara" />
        </div>
        {laga.mode === "latihan" && (
          <div className="tr-boneka" role="group" aria-label="Perilaku lawan latihan">
            {[["diam", "Diam"], ["jaga", "Menangkis"], ["lawan", "Melawan"]].map(([id, nm]) => <button key={id} className={boneka === id ? "on" : ""} onClick={() => setBoneka(id)}>{nm}</button>)}
          </div>
        )}
      </div>
      <Kontrol dunia={dunia} energi={energi} kid={laga.p1} />
      {jeda && !hasil && (
        <div className="tr-jeda-layar" role="dialog" aria-label="Jeda">
          <h3>JEDA</h3>
          <button className="tr-tombol utama" onClick={() => setJeda(false)}>▶ Lanjut</button>
          {laga.mode !== "latihan" && <button className="tr-tombol" onClick={() => { setJeda(false); onUlang(); }}>↺ Ulangi laga</button>}
          <button className="tr-tombol" onClick={() => panduan(true)}>📖 Daftar jurus & kontrol</button>
          <button className="tr-tombol bahaya" onClick={onKeluar}>✕ Keluar arena</button>
        </div>
      )}
      {hasil && (
        <div className={`tr-hasil ${menang ? "menang" : seri ? "seri" : "kalah"}`} role="status" data-testid="tr-hasil">
          <h3>{menang ? "🏆 KAMU MENANG!" : seri ? "🤝 IMBANG" : "💀 KAMU KALAH"}</h3>
          <p>{KARAKTER[laga.p1].nama} {hasil.menang[0]}–{hasil.menang[1]} {KARAKTER[laga.p2].nama}{laga.mode === "arkade" ? ` · Penantang ${laga.tahap + 1}/4` : laga.level != null ? ` · ${LEVEL[laga.level]}` : ""}</p>
          {st && <div className="tr-statistik"><span><b>{st.comboMaks}</b>combo</span><span><b>{Math.round(st.damage)}</b>damage</span><span><b>{st.jurus}</b>jurus</span><span><b>{st.pamungkas}</b>pamungkas</span><span><b>{st.sempurna}</b>tangkis sempurna</span></div>}
          <div className="tr-hasil-tombol">
            {menang && onLanjut && <button className="tr-tombol utama" onClick={onLanjut} data-testid="tr-lanjut">{laga.mode === "arkade" && laga.tahap >= 3 ? "🏆 Lihat gelar" : "➜ Lawan berikutnya"}</button>}
            <button className={`tr-tombol${!menang || !onLanjut ? " utama" : ""}`} onClick={onUlang} data-testid="tr-ulang">{menang ? "↺ Main lagi" : "↺ Coba lagi"}</button>
            <button className="tr-tombol" onClick={onGanti}>👤 Ganti petarung</button>
            <button className="tr-tombol" onClick={onKeluar}>✕ Keluar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════ PANDUAN ═════════════════════════
export function PanduanTarung({ onTutup }) {
  return (
    <div className="tr-panduan" role="dialog" aria-label="Cara main Arena Pendekar">
      <div className="tr-panduan-isi">
        <div className="tr-pilih-atas"><button className="tr-bulat" onClick={onTutup} aria-label="Tutup">✕</button><h2>CARA MAIN</h2></div>
        <h4>Kontrol</h4>
        <ul>
          <li><b>◀ ▶</b> maju/mundur · <b>▲</b> lompat · <b>▼</b> jongkok (menghindari pukulan atas)</li>
          <li><b>👊 Pukul</b> — cepat; tekan 2× untuk rangkaian 1-2. Saat jongkok = pukulan rendah.</li>
          <li><b>🦵 Tendang</b> — tendangan kapak dari atas (menembus tangkis bawah). Saat jongkok = <b>sapuan</b> yang menjatuhkan.</li>
          <li><b>🛡️ Tangkis</b> (tahan) — tahan + ▼ untuk tangkis bawah. Tangkis tepat sebelum kena = <b>TANGKIS SEMPURNA</b> (lawan terhuyung).</li>
          <li><b>🤼 Banting</b> — dari dekat; tidak bisa ditangkis.</li>
          <li><b>✨ Jurus</b> — jurus khas (35 energi). <b>⚡ Pamungkas</b> — sinema jurus terkuat (energi penuh).</li>
          <li>Combo: pukul → pukul → tendang → jurus/pamungkas (sambung saat serangan kena). Di udara: pukul/tendang udara.</li>
          <li>Keyboard: panah/WASD, J pukul, K tendang, L tangkis, U banting, I jurus, O pamungkas, P jeda.</li>
        </ul>
        <h4>Petarung</h4>
        {URUTAN_KARAKTER.map((id) => {
          const k = KARAKTER[id];
          return (
            <div key={id} className="tr-panduan-k" style={{ "--aura": k.rupa.aura }}>
              <Potret kid={id} />
              <div><b>{k.nama} · {k.gelar}</b><small>{k.gaya}</small><p><b>{k.jurus.ikon} {k.jurus.nama}:</b> {k.jurus.ket}</p><p><b>⚡ {k.pamungkas.nama}:</b> {k.pamungkas.ket}</p></div>
            </div>
          );
        })}
        <h4>Duel vs pemain</h4>
        <p>Tiap giliran kedua pemain memilih aksi secara rahasia; server menyelesaikan bentrokan lalu kedua layar memutar animasinya. Pukulan mengalahkan tendangan & bantingan, tendangan kapak mengalahkan sapuan & tangkis bawah, sapuan mengalahkan pukulan & tangkis atas, bantingan mengalahkan kedua tangkisan. Dua ronde menang = juara. Taruhan poin opsional; hasil dijaga server.</p>
      </div>
    </div>
  );
}

// ═════════════════════════ HUB ═════════════════════════
export function LayarTarung({ onTutup, onDuel }) {
  const [layar, setLayar] = useState("hub");
  const [mode, setMode] = useState("cepat");
  const [p1, setP1] = useState(null);
  const [laga, setLaga] = useState(null);
  const [panduan, setPanduan] = useState(false);
  const [season, setSeason] = useState(false);
  const [rekor, setRekor] = useState({});
  const [pilihLawan, setPilihLawan] = useState({ p2: "acak", level: 1, arena: "lawan" });
  useEffect(() => { setRekor(bacaRekor()); muatSemua(URUTAN_KARAKTER.map((k) => KARAKTER[k])); }, []);
  useMusik("tarungMenu", layar !== "main");

  const buatLaga = useCallback((m, kid, x = {}) => {
    if (m === "arkade") {
      const tangga = x.tangga || URUTAN_KARAKTER.filter((k) => k !== kid).sort(() => Math.random() - 0.5);
      const tahap = x.tahap ?? 0;
      const p2 = tangga[tahap];
      return { mode: m, p1: kid, p2, level: [0, 1, 1, 2][tahap], arena: KARAKTER[p2].arena, tangga, tahap, nomor: Date.now() };
    }
    if (m === "latihan") { const p2 = acakDari(URUTAN_KARAKTER.filter((k) => k !== kid)); return { mode: m, p1: kid, p2, level: 0, arena: KARAKTER[kid].arena, boneka: "diam", nomor: Date.now() }; }
    const p2 = x.p2 === "acak" || !x.p2 ? acakDari(URUTAN_KARAKTER.filter((k) => k !== kid)) : x.p2;
    const arena = x.arena === "lawan" || !x.arena ? KARAKTER[p2].arena : x.arena === "acak" ? acakDari(URUTAN_ARENA) : x.arena;
    return { mode: m, p1: kid, p2, level: x.level ?? 1, arena, nomor: Date.now() };
  }, []);

  const mulaiMode = (m) => { setMode(m); setLayar("pilih"); bunyi("pilih"); };
  const sudahPilih = (kid) => {
    setP1(kid);
    const r = { ...bacaRekor(), terakhir: kid }; simpanRekor(r); setRekor(r);
    if (mode === "cepat") { setLayar("lawan"); return; }
    setLaga(buatLaga(mode, kid)); setLayar(mode === "latihan" ? "main" : "vs");
  };
  const catatHasil = useCallback((h) => {
    const r = bacaRekor();
    r.main = (r.main || 0) + 1;
    if (h.pemenang === 0) r.menang = (r.menang || 0) + 1;
    simpanRekor(r); setRekor(r);
  }, []);
  const lanjutArkade = () => {
    if (laga.tahap >= 3) {
      const r = bacaRekor(); r.tamat = (r.tamat || 0) + 1; r.juara = { ...(r.juara || {}), [laga.p1]: true }; simpanRekor(r); setRekor(r);
      setLayar("tamat"); bunyi("menangBesar"); pembawaAcara("Juara Arena Pendekar!");
      return;
    }
    setLaga(buatLaga("arkade", laga.p1, { tangga: laga.tangga, tahap: laga.tahap + 1 }));
    setLayar("vs");
  };
  const ulang = () => setLaga((l) => ({ ...l, nomor: Date.now() }));

  return (
    <div className="wg-layar tr-layar" role="dialog" aria-label="Arena Pendekar" onClickCapture={bunyiKlik} data-testid="tr-layar">
      {layar === "hub" && (
        <div className="tr-hub">
          <div className="tr-pilih-atas">
            <button className="tr-bulat" onClick={onTutup} aria-label="Tutup arena" data-testid="tr-tutup">✕</button>
            <span className="tr-spasi" />
            <TombolSuara className="tr-suara" />
          </div>
          <div className="tr-judul"><small>ARTAPEDIA FIGHTING</small><h1>ARENA PENDEKAR</h1><p>Pertarungan arkade 1 lawan 1 · 5 petarung · jurus & pamungkas</p></div>
          <div className="tr-poster">
            {URUTAN_KARAKTER.map((id, i) => <span key={id} className="tr-poster-k" style={{ "--i": i, "--aura": KARAKTER[id].rupa.aura }}><Potret kid={id} /></span>)}
          </div>
          <div className="tr-menu">
            <button className="tr-menu-b arkade" onClick={() => mulaiMode("arkade")} data-testid="tr-mode-arkade"><i>🏆</i><b>Mode Arkade</b><small>Kalahkan 4 penantang berturut-turut</small></button>
            <button className="tr-menu-b cepat" onClick={() => mulaiMode("cepat")} data-testid="tr-mode-cepat"><i>⚔️</i><b>Tarung Cepat</b><small>Lawan CPU · pilih lawan & kesulitan</small></button>
            <button className="tr-menu-b duel" onClick={onDuel} data-testid="tr-mode-duel"><i>👥</i><b>Duel vs Pemain</b><small>Tarung lawan pengguna lain · bisa taruhan poin</small></button>
            <button className="tr-menu-b season" onClick={() => setSeason(true)} data-testid="tr-mode-season"><i>👑</i><b>Season & Turnamen</b><small>Peringkat musim, turnamen mingguan, hadiah</small></button>
            <button className="tr-menu-b latihan" onClick={() => mulaiMode("latihan")} data-testid="tr-mode-latihan"><i>🎯</i><b>Latihan</b><small>Coba semua jurus tanpa batas</small></button>
            <button className="tr-menu-b panduan" onClick={() => setPanduan(true)}><i>📖</i><b>Cara Main & Jurus</b><small>Kontrol, combo, daftar jurus</small></button>
          </div>
          <p className="tr-rekor">Main {rekor.main || 0} · Menang {rekor.menang || 0} · Tamat arkade {rekor.tamat || 0}× · Mode solo gratis (tanpa poin)</p>
        </div>
      )}
      {layar === "pilih" && <PilihPetarung judul={mode === "arkade" ? "ARKADE · PILIH PETARUNG" : mode === "latihan" ? "LATIHAN · PILIH PETARUNG" : "PILIH PETARUNGMU"} awal={rekor.terakhir && KARAKTER[rekor.terakhir] ? rekor.terakhir : "garuda"} onKembali={() => setLayar("hub")} onPilih={sudahPilih} />}
      {layar === "lawan" && (
        <div className="tr-lawan" data-testid="tr-lawan">
          <div className="tr-pilih-atas"><button className="tr-bulat" onClick={() => setLayar("pilih")} aria-label="Kembali">‹</button><h2>PILIH LAWAN</h2></div>
          <div className="tr-roster lawan">
            <button className={`tr-ubin${pilihLawan.p2 === "acak" ? " aktif" : ""}`} onClick={() => setPilihLawan((x) => ({ ...x, p2: "acak" }))}><span className="tr-potret kosong">?</span><span>Acak</span></button>
            {URUTAN_KARAKTER.map((id) => (
              <button key={id} className={`tr-ubin${pilihLawan.p2 === id ? " aktif" : ""}`} style={{ "--aura": KARAKTER[id].rupa.aura }} onClick={() => setPilihLawan((x) => ({ ...x, p2: id }))} data-testid={`tr-lawan-${id}`}><Potret kid={id} cermin /><span>{KARAKTER[id].nama}</span></button>
            ))}
          </div>
          <h4>Tingkat kesulitan</h4>
          <div className="tr-segmen">{LEVEL.map((nm, i) => <button key={nm} className={pilihLawan.level === i ? "on" : ""} onClick={() => setPilihLawan((x) => ({ ...x, level: i }))} data-testid={`tr-level-${i}`}>{nm}</button>)}</div>
          <h4>Arena</h4>
          <div className="tr-segmen arena">
            {[["lawan", "Kandang lawan"], ["acak", "Acak"], ...URUTAN_ARENA.map((a) => [a, ARENA[a].nama])].map(([id, nm]) => <button key={id} className={pilihLawan.arena === id ? "on" : ""} onClick={() => setPilihLawan((x) => ({ ...x, arena: id }))}>{nm}</button>)}
          </div>
          <button className="tr-tombol utama besar" onClick={() => { setLaga(buatLaga("cepat", p1, pilihLawan)); setLayar("vs"); }} data-testid="tr-mulai">TARUNG!</button>
        </div>
      )}
      {layar === "vs" && laga && <LayarVs key={laga.nomor} p1={laga.p1} p2={laga.p2} arena={laga.arena} sub={laga.mode === "arkade" ? `Penantang ${laga.tahap + 1} dari 4 · ${LEVEL[laga.level]}` : LEVEL[laga.level]} onLanjut={() => setLayar("main")} />}
      {layar === "main" && laga && (
        <ArenaSolo
          laga={laga} panduan={setPanduan} onSelesai={catatHasil}
          onKeluar={() => setLayar("hub")} onGanti={() => setLayar("pilih")}
          onUlang={ulang} onLanjut={laga.mode === "arkade" ? lanjutArkade : laga.mode === "cepat" ? () => { setLaga(buatLaga("cepat", laga.p1, { ...pilihLawan, p2: "acak" })); setLayar("vs"); } : null}
        />
      )}
      {layar === "tamat" && laga && (
        <div className="tr-tamat" data-testid="tr-tamat">
          <div className="tr-konfeti" aria-hidden>{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ "--i": i }} />)}</div>
          <Potret kid={laga.p1} besar />
          <h2>JUARA ARENA PENDEKAR</h2>
          <p>{KARAKTER[laga.p1].nama} {KARAKTER[laga.p1].gelar} mengalahkan keempat penantang!</p>
          <button className="tr-tombol utama besar" onClick={() => setLayar("hub")}>Kembali ke arena</button>
        </div>
      )}
      {panduan && <PanduanTarung onTutup={() => setPanduan(false)} />}
      {season && <SeasonArena onTutup={() => setSeason(false)} />}
    </div>
  );
}

// ═════════════════════════ PAPAN DUEL (antar pengguna) ═════════════════════════
const KET_SINGKAT = { pukul: "cepat", tendang: "dari atas", sapu: "bawah", banting: "tak tertangkis", tangkis: "tahan atas", rendah: "tahan bawah", jurus: "jurus khas", pamungkas: "terkuat" };

export function PapanTarung({ papan, onAksi, sibuk, sisa = null }) {
  const dunia = useRef(null);
  const sut = useRef(null);
  const [panduan, setPanduan] = useState(false);
  const [kirim, setKirim] = useState(null);
  const [animasi, setAnimasi] = useState(false);
  useMusik("tarung", papan.fase !== "pilih");
  const siap = papan.fase !== "pilih" && papan.saya.karakter && papan.lawan.karakter;
  const kunciDunia = siap ? `${papan.saya.karakter}-${papan.lawan.karakter}-${papan.arena}` : "";
  const kunciRef = useRef("");
  if (siap && kunciRef.current !== kunciDunia) {
    kunciRef.current = kunciDunia;
    dunia.current = new Dunia({ mode: "duel", p1: papan.saya.karakter, p2: papan.lawan.karakter, nama1: papan.saya.nama, nama2: papan.lawan.nama, arena: papan.arena, angkaDamage: true, ...opsiSuara() });
    sut.current = new Sutradara(dunia.current, papan.saya.pid, papan.lawan.pid);
    sut.current.selesaiCb = () => setAnimasi(false);
    const sudahJalan = (papan.riwayat || []).some((r) => r.tipe !== "mulai") || papan.langkah > 0 || papan.ronde > 1;
    if (sudahJalan) { sut.current.lewati(papan.riwayat); sut.current.sinkron(papan); for (const f of dunia.current.f) f.ke("siaga"); }
  }
  useEffect(() => {
    if (!sut.current || !siap) return;
    const baru = (papan.riwayat || []).some((r) => !sut.current.diputar.has(r.ke));
    if (baru) { setAnimasi(true); sut.current.terima(papan.riwayat, papan); }
    else if (!sut.current.sibuk) sut.current.sinkron(papan);
  }, [papan, siap]);
  useEffect(() => { setKirim(null); }, [papan.ke]);
  useEffect(() => {
    const d = dunia.current;
    if (!d) return;
    d.hudWaktu = papan.selesai ? "—" : sisa;
    d.hudInfo = papan.fase === "tarung" ? `GILIRAN ${Math.min(papan.maksLangkah, papan.langkah + 1)}/${papan.maksLangkah}` : null;
  });

  const pilih = (id) => { if (sibuk || kirim) return; setKirim(id); bunyi("pilih"); onAksi({ tipe: "gerak", gerak: id, ke: papan.ke }); };

  if (papan.fase === "pilih") {
    if (!papan.saya.sudahPilih) {
      return (
        <div className="tr-duel-pilih">
          <PilihPetarung judul="PILIH PETARUNG DUEL" tombol="🔒 KUNCI PETARUNG" awal={(() => { const r = bacaRekor().terakhir; return r && KARAKTER[r] ? r : "garuda"; })()} kunci={sibuk}
            catatan={<p className="tr-catatan">Pilihanmu dirahasiakan sampai lawan juga memilih.{sisa != null ? ` Sisa ${sisa} dtk — lewat batas dipilihkan acak.` : ""} {papan.lawan.sudahPilih ? "✅ Lawan sudah memilih." : "⏳ Lawan sedang memilih…"}</p>}
            onPilih={(kid) => onAksi({ tipe: "karakter", id: kid })} />
        </div>
      );
    }
    return (
      <div className="tr-duel-tunggu" data-testid="tr-duel-tunggu">
        <Potret kid={papan.saya.karakter} besar />
        <b>{KARAKTER[papan.saya.karakter]?.nama} siap bertarung!</b>
        <p>{papan.lawan.sudahPilih ? "Lawan sudah memilih — memulai…" : `Menunggu ${papan.lawan.nama} memilih petarung…`}{sisa != null ? ` (${sisa} dtk)` : ""}</p>
      </div>
    );
  }

  const aksi = papan.aksi || [];
  const terkunci = papan.saya.pilihan || kirim;
  const bolehPilih = papan.giliranSaya && !papan.selesai && !terkunci;
  return (
    <div className="tr-duel" data-testid="tr-duel" data-ke={papan.ke} data-hp1={papan.saya.hp} data-hp2={papan.lawan.hp}>
      <div className="tr-layar-tarung duel">
        {dunia.current && <KanvasDunia dunia={dunia} label="Arena duel" />}
        <div className="tr-atas-arena"><button className="tr-bulat" onClick={() => setPanduan(true)} aria-label="Cara main">?</button><TombolSuara className="tr-suara" /></div>
      </div>
      {!papan.selesai && (
        <div className="tr-giliran">
          <div className="tr-status">
            {terkunci ? <span className="kunci">🔒 {aksi.find((a) => a.id === terkunci)?.nama || "Terkunci"} — {papan.lawan.siap ? "memutar…" : "menunggu lawan"}</span>
              : animasi ? <span>🎬 Memutar hasil… kamu sudah bisa memilih</span>
                : <span>Pilih aksi rahasia{sisa != null ? ` · ${sisa} dtk` : ""}</span>}
            <span className={`lawan ${papan.lawan.siap ? "siap" : ""}`}>{papan.lawan.siap ? "✅ Lawan sudah mengunci" : "⏳ Lawan memilih…"}</span>
          </div>
          <div className="tr-pilihan">
            {aksi.map((a) => (
              <button key={a.id} className={`tr-p ${a.id}${terkunci === a.id ? " kunci" : ""}${!a.bisa ? " redup" : ""}`} disabled={!bolehPilih || !a.bisa || sibuk} onClick={() => pilih(a.id)} title={a.ket} data-testid={`tr-p-${a.id}`}>
                <i>{a.ikon}</i><b>{a.nama}</b><small>{a.biaya ? `${a.biaya} energi` : KET_SINGKAT[a.id]}</small>
              </button>
            ))}
          </div>
          <p className="tr-catatan">Pukulan › tendangan & bantingan · tendangan › sapuan & tangkis bawah · sapuan › pukulan & tangkis atas · bantingan › tangkisan. Diam 3 giliran = kalah.</p>
        </div>
      )}
      {panduan && <PanduanTarung onTutup={() => setPanduan(false)} />}
    </div>
  );
}

export default LayarTarung;
