// Mesin suara game — semuanya disintesis langsung di peramban (Web Audio), tanpa berkas audio.
//
//  • Musik latar santai ala lounge kasino ("lounge") dan ala oriental untuk slot mahjong ("oriental"),
//    dibangkitkan terus-menerus (tidak berulang persis) lewat penjadwal langkah.
//  • Efek suara: klik, koin, kemenangan, kaskade, scatter, gong, raungan naga, pasak plinko, kartu, ubin, dst.
//  • Musik & efek bisa dimatikan sendiri-sendiri; pilihan diingat di perangkat.
//  • Peramban baru mengizinkan suara setelah pengguna menyentuh layar, jadi konteks audio dibuat lazily
//    pada sentuhan pertama.
const KUNCI = "artapedia_suara_v1";

let ctx = null;
let jalur = null; // { master, musik, efek, gema, tunda }
let pref = { musik: true, efek: true };
const pendengar = new Set();
let klaim = []; // tumpukan { id, tema } — klaim terakhir menang, dilepas → kembali ke sebelumnya
let temaJalan = null;
let timer = null;
let langkah = 0;
let waktuLangkah = 0;
let gestur = false;
let noise = null;

try {
  const s = JSON.parse(localStorage.getItem(KUNCI) || "null");
  if (s && typeof s === "object") pref = { musik: s.musik !== false, efek: s.efek !== false };
} catch {}

// HP lemah (RAM kecil / sedikit inti): gema & echo dimatikan agar suara tidak putus-putus.
const RINGAN = typeof navigator !== "undefined" && ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 4) <= 2);
const ada = () => typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
export const suaraDidukung = () => !!ada();
export const bacaPref = () => ({ ...pref });
export function langgananSuara(fn) { pendengar.add(fn); return () => pendengar.delete(fn); }
function kabari() { pendengar.forEach((f) => { try { f({ ...pref }); } catch {} }); }

export function aturPref(baru) {
  pref = { ...pref, ...baru };
  try { localStorage.setItem(KUNCI, JSON.stringify(pref)); } catch {}
  if (jalur && ctx) {
    jalur.musik.gain.setTargetAtTime(pref.musik ? 0.5 : 0, ctx.currentTime, 0.08);
    jalur.efek.gain.setTargetAtTime(pref.efek ? 1 : 0, ctx.currentTime, 0.03);
  }
  sinkronMusik();
  kabari();
}

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

function buatGema(c) {
  const dur = 2.4, n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2.6;
  }
  const cv = c.createConvolver();
  cv.buffer = buf;
  return cv;
}

function bukaKonteks() {
  if (ctx) return ctx;
  const A = ada();
  if (!A) return null;
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}
  try { ctx = new A({ latencyHint: "interactive" }); } catch { try { ctx = new A(); } catch { return null; } }
  // Peramban bisa menahan konteks kapan saja (tab disembunyikan, telepon masuk, mode hemat daya): bangunkan lagi.
  ctx.onstatechange = () => { if (ctx && ctx.state !== "running" && gestur && document.visibilityState === "visible") ctx.resume().catch(() => {}); else sinkronMusik(); };
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const komp = ctx.createDynamicsCompressor();
  komp.threshold.value = -14; komp.ratio.value = 5; komp.attack.value = 0.004; komp.release.value = 0.2;
  master.connect(komp); komp.connect(ctx.destination);
  const musik = ctx.createGain(); musik.gain.value = pref.musik ? 0.5 : 0; musik.connect(master);
  const efek = ctx.createGain(); efek.gain.value = pref.efek ? 1 : 0; efek.connect(master);
  const gema = buatGema(ctx);
  const gemaOut = ctx.createGain(); gemaOut.gain.value = 0.55;
  gema.connect(gemaOut); gemaOut.connect(musik);
  // Gema pendek untuk efek
  const gemaE = buatGema(ctx);
  const gemaEOut = ctx.createGain(); gemaEOut.gain.value = 0.28;
  gemaE.connect(gemaEOut); gemaEOut.connect(efek);
  // Gema berulang (echo) untuk melodi
  const tunda = ctx.createDelay(1.5); tunda.delayTime.value = 0.42;
  const umpan = ctx.createGain(); umpan.gain.value = 0.32;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
  tunda.connect(lp); lp.connect(umpan); umpan.connect(tunda); lp.connect(musik);
  jalur = { master, musik, efek, gema, gemaE, tunda };
  const n = Math.floor(ctx.sampleRate * 0.6);
  noise = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

/** Dipanggil pada sentuhan/klik pengguna: membuat & membangunkan konteks audio. */
export function bangunkan() {
  gestur = true;
  const c = bukaKonteks();
  if (!c) return false;
  if (c.state !== "running") c.resume().then(sinkronMusik).catch(() => {});
  siapkanSampel();
  sinkronMusik();
  return true;
}

if (typeof window !== "undefined") {
  const pertama = () => { bangunkan(); };
  ["pointerdown", "touchend", "keydown", "click"].forEach((e) => window.addEventListener(e, pertama, { passive: true, capture: true }));
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.visibilityState === "hidden") { ctx.suspend?.().catch(() => {}); }
    else if (gestur) ctx.resume?.().then(sinkronMusik).catch(() => {});
  });
  window.addEventListener("pageshow", () => { if (ctx && gestur) ctx.resume?.().then(sinkronMusik).catch(() => {}); });
  // Penjaga: tiap 2 detik pastikan konteks hidup & musik yang seharusnya berbunyi benar-benar berbunyi.
  setInterval(() => pantau(), 2000);
}

// ═════════════════════════ BLOK BANGUNAN ═════════════════════════
function env(g, t, a, puncak, d, akhir = 0.0001) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(puncak, t + a);
  g.gain.exponentialRampToValueAtTime(akhir, t + a + d);
}

/** Satu nada: osilator (satu atau lebih) → envelope → tujuan. */
function nada({ t, f, dur = 0.4, a = 0.005, v = 0.2, tipe = "sine", tipe2 = null, det = 0, lp = 0, ke, kirim = 0, tunda = 0, geser = 0 }) {
  const c = ctx;
  if (RINGAN) { kirim = 0; tunda = 0; tipe2 = null; }
  const g = c.createGain();
  const o = c.createOscillator();
  o.type = tipe; o.frequency.setValueAtTime(f, t);
  if (geser) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * geser), t + dur);
  let hulu = o;
  let o2 = null;
  if (tipe2) { o2 = c.createOscillator(); o2.type = tipe2; o2.frequency.setValueAtTime(f, t); o2.detune.value = det; if (geser) o2.frequency.exponentialRampToValueAtTime(Math.max(20, f * geser), t + dur); }
  o.connect(g); o2?.connect(g);
  let out = g;
  if (lp) { const fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = lp; g.connect(fl); out = fl; }
  env(g, t, a, v, dur);
  out.connect(ke);
  if (kirim && jalur.gema && ke === jalur.musik) { const k = c.createGain(); k.gain.value = kirim; out.connect(k); k.connect(jalur.gema); }
  if (tunda && ke === jalur.musik) { const k = c.createGain(); k.gain.value = tunda; out.connect(k); k.connect(jalur.tunda); }
  if (kirim && ke === jalur.efek) { const k = c.createGain(); k.gain.value = kirim; out.connect(k); k.connect(jalur.gemaE); }
  o.start(t); o2?.start(t);
  o.stop(t + dur + a + 0.1); o2?.stop(t + dur + a + 0.1);
}

function desis({ t, dur = 0.06, v = 0.1, hp = 0, bp = 0, q = 1, ke, lp = 0, mulai = 0 }) {
  const c = ctx;
  const s = c.createBufferSource();
  s.buffer = noise; s.loop = true;
  const g = c.createGain();
  let node = s;
  if (hp) { const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp; node.connect(f); node = f; }
  if (bp) { const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = bp; f.Q.value = q; node.connect(f); node = f; }
  if (lp) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; node.connect(f); node = f; }
  node.connect(g);
  env(g, t, 0.003, v, dur);
  g.connect(ke);
  s.start(t, mulai % 0.3);
  s.stop(t + dur + 0.05);
}

// ═════════════════════════ MUSIK ═════════════════════════
// Tema "lounge": piano listrik lembut + bass berjalan + sikat drum, kunci C (Dm9–G13–Cmaj9–Am9).
const LOUNGE = {
  bpm: 78, swing: 0.16,
  akor: [
    { akar: 38, n: [60, 65, 69, 72, 76] }, // Dm9
    { akar: 43, n: [59, 64, 65, 69, 74] }, // G13
    { akar: 36, n: [59, 64, 67, 71, 74] }, // Cmaj9
    { akar: 45, n: [60, 64, 67, 71, 74] } // Am9
  ],
  skala: [72, 74, 76, 79, 81, 84, 79, 76]
};
// Tema "oriental": petikan pentatonik (guzheng), drone lembut, blok kayu — kunci D.
const ORIENTAL = {
  bpm: 66,
  skala: [62, 64, 66, 69, 71, 74, 76, 78, 81],
  akar: [38, 38, 45, 43]
};

function jadwalLounge(t, i) {
  const T = LOUNGE, det = 60 / T.bpm / 2, bar = Math.floor(i / 8) % 4, k = i % 8;
  const a = T.akor[bar], b = T.akor[(bar + 1) % 4];
  const ke = jalur.musik;
  // Bass berjalan pada ketukan (k genap).
  if (k % 2 === 0) {
    const ket = k / 2;
    const f = [a.akar, a.akar + 7, a.akar + (bar === 1 ? 4 : 3), b.akar + (b.akar > a.akar ? -1 : 1)][ket];
    nada({ t, f: midi(f), dur: 0.62, a: 0.012, v: 0.26, tipe: "sine", tipe2: "triangle", lp: 520, ke });
  }
  // Akor piano listrik: tahan di ketukan 1, sentakan pendek di "dan-2" dan "dan-4".
  if (k === 0 || k === 3 || k === 7) {
    const tahan = k === 0;
    a.n.forEach((m, j) => nada({ t: t + j * 0.012, f: midi(m), dur: tahan ? 1.9 : 0.5, a: 0.006, v: tahan ? 0.05 : 0.038, tipe: "sine", tipe2: "triangle", det: 5, lp: 2600, ke, kirim: 0.5 }));
  }
  // Sikat drum.
  desis({ t, dur: 0.045, v: k % 2 === 0 ? 0.05 : 0.026, hp: 6500, ke });
  if (k === 2 || k === 6) desis({ t, dur: 0.16, v: 0.055, bp: 3200, q: 0.7, ke });
  if (k === 0) nada({ t, f: 110, dur: 0.16, v: 0.16, tipe: "sine", geser: 0.5, ke });
  // Melodi jarang, pentatonik, bergema.
  if (Math.random() < (k % 2 === 1 ? 0.3 : 0.2)) {
    const m = T.skala[Math.floor(Math.random() * T.skala.length)];
    nada({ t: t + 0.01, f: midi(m), dur: 1.3, a: 0.01, v: 0.06, tipe: "triangle", tipe2: "sine", det: 3, lp: 3000, ke, kirim: 0.9, tunda: 0.55 });
  }
  return det;
}

function jadwalOriental(t, i) {
  const T = ORIENTAL, bar = Math.floor(i / 8) % 4, k = i % 8;
  const ke = jalur.musik;
  if (k === 0) {
    const f = midi(T.akar[bar]);
    nada({ t, f, dur: 3.2, a: 0.25, v: 0.13, tipe: "sine", tipe2: "triangle", lp: 480, ke, kirim: 0.4 });
    nada({ t, f: f * 2 * 1.5, dur: 3.2, a: 0.4, v: 0.03, tipe: "sine", ke, kirim: 0.6 });
  }
  // Petikan pentatonik naik-turun acak.
  if (Math.random() < 0.62) {
    const idx = Math.floor((Math.sin(i * 0.55) * 0.5 + 0.5) * (T.skala.length - 1) + (Math.random() - 0.5) * 2.4);
    const m = T.skala[Math.min(T.skala.length - 1, Math.max(0, idx))];
    nada({ t, f: midi(m), dur: 0.9, a: 0.003, v: 0.075, tipe: "sawtooth", tipe2: "triangle", det: 4, lp: 1900, ke, kirim: 0.8, tunda: 0.4 });
  }
  if (k === 4) desis({ t, dur: 0.05, v: 0.06, bp: 1400, q: 6, ke }); // blok kayu
  if (k === 0 && bar % 2 === 1) nada({ t, f: 90, dur: 0.22, v: 0.15, tipe: "sine", geser: 0.6, ke }); // tabuh
  return 60 / T.bpm / 2;
}

function putaran() {
  if (!ctx || !temaJalan || ctx.state !== "running") return;
  const batas = ctx.currentTime + 0.45;
  if (waktuLangkah < ctx.currentTime) { waktuLangkah = ctx.currentTime + 0.06; }
  while (waktuLangkah < batas) {
    let det, ayun = 0;
    if (temaJalan === "oriental") det = jadwalOriental(waktuLangkah, langkah);
    else { det = 60 / LOUNGE.bpm / 2; ayun = langkah % 2 === 1 ? LOUNGE.swing * det : 0; jadwalLounge(waktuLangkah + ayun, langkah); }
    waktuLangkah += det;
    langkah++;
  }
}

// Musik dari berkas MP3 (Arena Pendekar): diputar berulang lewat jalur musik (ikut tombol musik).
const MUSIK_BERKAS = {
  tarung: { url: "/tarung/musik-arena.mp3", gain: 1.5 },
  tarungMenu: { url: "/tarung/musik-menu.mp3", gain: 0.75 }
};
const bufferCache = new Map();
function muatBuffer(url) {
  let j = bufferCache.get(url);
  if (!j) {
    j = fetch(url).then((r) => r.arrayBuffer()).then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej))).catch(() => { bufferCache.delete(url); return null; });
    bufferCache.set(url, j);
  }
  return j;
}
/** Batas bunyi sebenarnya (buang hening di awal/akhir MP3 agar putaran ulang mulus). */
function batasBunyi(buf) {
  const d = buf.getChannelData(0);
  let a = 0, b = d.length - 1;
  while (a < d.length && Math.abs(d[a]) < 0.003) a++;
  while (b > a && Math.abs(d[b]) < 0.003) b--;
  return [a / buf.sampleRate, (b + 1) / buf.sampleRate];
}
let sumberBerkas = null, tokenBerkas = 0, memuatBerkas = false, gagalBerkas = 0;
function jalankanBerkas(tema) {
  const m = MUSIK_BERKAS[tema];
  const token = ++tokenBerkas;
  temaJalan = tema;
  timer = timer || setInterval(() => {}, 60000); // penanda "musik berjalan"
  memuatBerkas = true;
  muatBuffer(m.url).then((buf) => {
    memuatBerkas = false;
    if (!buf) { gagalBerkas++; return; } // penjaga (pantau) mencoba lagi
    gagalBerkas = 0;
    if (token !== tokenBerkas || temaJalan !== tema || !ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const [a, b] = batasBunyi(buf);
    src.loopStart = a; src.loopEnd = b;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(m.gain, ctx.currentTime + 0.8);
    src.connect(g); g.connect(jalur.musik);
    src.start(ctx.currentTime + 0.02, a);
    sumberBerkas = { src, g };
  });
}

function jalankanMusik(tema) {
  if (temaJalan === tema && timer) return;
  hentiInternal();
  if (MUSIK_BERKAS[tema]) { jalankanBerkas(tema); return; }
  temaJalan = tema;
  langkah = 0;
  waktuLangkah = ctx ? ctx.currentTime + 0.1 : 0;
  timer = setInterval(putaran, 120);
  putaran();
}
function hentiInternal() {
  if (timer) clearInterval(timer);
  timer = null; temaJalan = null;
  tokenBerkas++;
  if (sumberBerkas && ctx) {
    const { src, g } = sumberBerkas;
    try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15); src.stop(ctx.currentTime + 0.8); } catch {}
  }
  sumberBerkas = null;
}

/** Penjaga berkala: bangunkan konteks yang tertahan & hidupkan lagi musik yang seharusnya berjalan. */
function pantau() {
  if (!ctx || !gestur || document.visibilityState !== "visible") return;
  if (ctx.state !== "running") { ctx.resume().catch(() => {}); return; }
  const tema = klaim.length ? klaim[klaim.length - 1].tema : null;
  if (!tema || !pref.musik) return;
  if (MUSIK_BERKAS[tema]) {
    if (!sumberBerkas && !memuatBerkas && gagalBerkas < 6) { hentiInternal(); jalankanMusik(tema); }
  } else if (!timer) jalankanMusik(tema);
}

function sinkronMusik() {
  const tema = klaim.length ? klaim[klaim.length - 1].tema : null;
  if (!tema || !pref.musik || !gestur || !ctx) { hentiInternal(); return; }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  jalankanMusik(tema);
}

let noKlaim = 0;
/** Meminta musik tema tertentu selama komponen hidup. Mengembalikan fungsi pelepas. */
export function klaimMusik(tema = "lounge") {
  const id = ++noKlaim;
  klaim.push({ id, tema });
  sinkronMusik();
  return () => { klaim = klaim.filter((k) => k.id !== id); sinkronMusik(); };
}
export const musikBerjalan = () => !!timer;

// ═════════════════════════ EFEK ═════════════════════════
const E = {
  klik(t, ke) { nada({ t, f: 880, dur: 0.05, v: 0.11, tipe: "triangle", geser: 0.85, ke }); },
  pilih(t, ke) { nada({ t, f: 660, dur: 0.06, v: 0.1, tipe: "sine", ke }); nada({ t: t + 0.05, f: 990, dur: 0.09, v: 0.1, tipe: "sine", ke }); },
  pop(t, ke) { nada({ t, f: 520, dur: 0.09, v: 0.16, tipe: "sine", geser: 2, ke, kirim: 0.2 }); },
  notif(t, ke) { nada({ t, f: 784, dur: 0.16, v: 0.13, tipe: "sine", ke, kirim: 0.3 }); nada({ t: t + 0.12, f: 1175, dur: 0.3, v: 0.12, tipe: "sine", ke, kirim: 0.4 }); },
  giliran(t, ke) { nada({ t, f: 587, dur: 0.14, v: 0.14, tipe: "triangle", ke, kirim: 0.3 }); nada({ t: t + 0.11, f: 880, dur: 0.3, v: 0.14, tipe: "triangle", ke, kirim: 0.4 }); },
  koin(t, ke, o = {}) {
    const p = o.nada || 1;
    nada({ t, f: 1568 * p, dur: 0.26, a: 0.002, v: 0.12, tipe: "square", lp: 5200, ke, kirim: 0.3 });
    nada({ t: t + 0.07, f: 2093 * p, dur: 0.5, a: 0.002, v: 0.1, tipe: "sine", tipe2: "triangle", ke, kirim: 0.4 });
  },
  hujanKoin(t, ke, o = {}) {
    const n = o.n || 12;
    for (let i = 0; i < n; i++) E.koin(t + i * (0.07 + Math.random() * 0.07), ke, { nada: 0.85 + Math.random() * 0.6 });
  },
  ubin(t, ke) {
    desis({ t, dur: 0.045, v: 0.22, bp: 1900, q: 1.6, ke });
    nada({ t, f: 180, dur: 0.09, v: 0.22, tipe: "sine", geser: 0.6, ke });
  },
  kartu(t, ke) { desis({ t, dur: 0.07, v: 0.16, hp: 3800, ke }); desis({ t: t + 0.05, dur: 0.05, v: 0.09, hp: 5200, ke }); },
  langkah(t, ke) { nada({ t, f: 240, dur: 0.1, v: 0.24, tipe: "triangle", geser: 0.55, ke }); desis({ t, dur: 0.03, v: 0.12, bp: 2400, q: 2, ke }); },
  putar(t, ke) {
    desis({ t, dur: 0.55, v: 0.14, bp: 700, q: 0.8, ke });
    nada({ t, f: 180, dur: 0.55, a: 0.3, v: 0.08, tipe: "sawtooth", geser: 3, lp: 900, ke });
  },
  berhenti(t, ke, o = {}) {
    const kol = o.kolom || 0;
    nada({ t, f: 140 + kol * 8, dur: 0.11, v: 0.22, tipe: "sine", geser: 0.5, ke });
    desis({ t, dur: 0.04, v: 0.16, bp: 1700 + kol * 120, q: 1.5, ke });
  },
  jatuh(t, ke) { nada({ t, f: 330, dur: 0.16, v: 0.1, tipe: "triangle", geser: 0.6, ke }); },
  pecah(t, ke) { desis({ t, dur: 0.16, v: 0.16, hp: 2500, ke }); nada({ t, f: 1200, dur: 0.12, v: 0.08, tipe: "square", geser: 0.5, lp: 3000, ke }); },
  kombo(t, ke, o = {}) {
    const s = o.level || 0, f = 523.25 * 2 ** ((s * 3) / 12);
    [0, 4, 7].forEach((st, j) => nada({ t: t + j * 0.055, f: f * 2 ** (st / 12), dur: 0.5, a: 0.004, v: 0.13, tipe: "triangle", tipe2: "sine", ke, kirim: 0.5 }));
  },
  menang(t, ke) { [0, 4, 7, 12].forEach((st, j) => nada({ t: t + j * 0.07, f: 523.25 * 2 ** (st / 12), dur: 0.35, v: 0.14, tipe: "triangle", tipe2: "sine", ke, kirim: 0.5 })); E.koin(t + 0.25, ke); },
  scatter(t, ke) { for (let j = 0; j < 9; j++) nada({ t: t + j * 0.055, f: 1046 * 2 ** ([0, 2, 4, 7, 9, 12, 14, 16, 19][j] / 12), dur: 0.5, a: 0.003, v: 0.09, tipe: "sine", ke, kirim: 0.7 }); },
  gong(t, ke) {
    [[98, 0.2], [146.8, 0.12], [197, 0.1], [261, 0.07], [391, 0.05], [522, 0.03]].forEach(([f, v]) => nada({ t, f, dur: 3.2, a: 0.006, v, tipe: "sine", geser: 0.985, ke, kirim: 0.6 }));
    desis({ t, dur: 0.25, v: 0.12, bp: 900, q: 0.6, ke });
  },
  naga(t, ke) {
    nada({ t, f: 150, dur: 1.4, a: 0.18, v: 0.2, tipe: "sawtooth", tipe2: "square", det: 9, geser: 0.32, lp: 900, ke, kirim: 0.3 });
    desis({ t, dur: 1.3, v: 0.16, bp: 380, q: 0.9, lp: 1200, ke });
    nada({ t: t + 0.08, f: 96, dur: 1.2, a: 0.2, v: 0.12, tipe: "sine", geser: 0.55, ke });
  },
  fanfare(t, ke) {
    const bar = [[0, 0.0], [4, 0.0], [7, 0.0], [12, 0.18], [7, 0.32], [12, 0.44], [16, 0.56], [19, 0.7]];
    bar.forEach(([st, dt]) => nada({ t: t + dt, f: 392 * 2 ** (st / 12), dur: 0.5, a: 0.012, v: 0.12, tipe: "sawtooth", tipe2: "square", det: 6, lp: 2400, ke, kirim: 0.5 }));
    [0, 4, 7, 12].forEach((st) => nada({ t: t + 0.85, f: 392 * 2 ** (st / 12), dur: 1.3, a: 0.02, v: 0.1, tipe: "sawtooth", tipe2: "triangle", det: 5, lp: 2200, ke, kirim: 0.6 }));
  },
  menangBesar(t, ke) { E.gong(t, ke); E.fanfare(t + 0.1, ke); E.hujanKoin(t + 0.4, ke, { n: 26 }); },
  gratis(t, ke) { E.gong(t, ke); E.scatter(t + 0.1, ke); E.fanfare(t + 0.6, ke); },
  kalah(t, ke) { nada({ t, f: 330, dur: 0.25, v: 0.13, tipe: "triangle", ke }); nada({ t: t + 0.18, f: 247, dur: 0.5, v: 0.13, tipe: "triangle", geser: 0.9, ke, kirim: 0.3 }); },
  seri(t, ke) { nada({ t, f: 440, dur: 0.2, v: 0.12, tipe: "triangle", ke }); nada({ t: t + 0.16, f: 440, dur: 0.35, v: 0.12, tipe: "triangle", ke }); },
  pasak(t, ke, o = {}) {
    const f = 620 + (o.baris || 0) * 42 + Math.random() * 60;
    nada({ t, f, dur: 0.07, a: 0.001, v: 0.11, tipe: "sine", geser: 0.7, ke });
    desis({ t, dur: 0.02, v: 0.05, hp: 4000, ke });
  },
  mendarat(t, ke, o = {}) {
    const x = o.pengali || 0;
    if (x >= 5) { E.menang(t, ke); if (x >= 26) E.gong(t + 0.05, ke); if (x >= 5) E.hujanKoin(t + 0.3, ke, { n: Math.min(18, 6 + Math.floor(x / 4)) }); }
    else if (x >= 1) { E.menang(t, ke); }
    else { nada({ t, f: 200, dur: 0.22, v: 0.16, tipe: "sine", geser: 0.6, ke }); }
  },
  // ── Arena Pendekar ──
  tDesir(t, ke, o = {}) { const k = o.kuat || 0.6; desis({ t, dur: 0.12 + k * 0.08, v: 0.09 + k * 0.08, bp: 1500 + k * 900, q: 0.9, ke }); },
  tPukul(t, ke, o = {}) {
    if (sampel(t, ke, { mulai: 0.43, lama: 0.22, laju: (o.nada || 1) * 1.15, v: 0.55 })) return;
    nada({ t, f: 150 * (o.nada || 1), dur: 0.12, v: 0.32, tipe: "sine", geser: 0.4, ke });
    desis({ t, dur: 0.06, v: 0.22, bp: 2200, q: 1, ke });
  },
  tHantam(t, ke, o = {}) {
    if (sampel(t, ke, { mulai: 0.3, lama: 0.42, laju: o.nada || 1, v: 0.85 })) return;
    nada({ t, f: 95, dur: 0.28, v: 0.42, tipe: "sine", geser: 0.35, ke, kirim: 0.2 });
    desis({ t, dur: 0.16, v: 0.3, bp: 900, q: 0.7, ke });
  },
  tTangkis(t, ke) { nada({ t, f: 1100, dur: 0.12, v: 0.12, tipe: "square", geser: 0.7, lp: 3500, ke, kirim: 0.3 }); desis({ t, dur: 0.05, v: 0.18, hp: 3000, ke }); nada({ t, f: 180, dur: 0.08, v: 0.2, tipe: "sine", ke }); },
  tSempurna(t, ke) { [0, 7, 12].forEach((st, j) => nada({ t: t + j * 0.04, f: 1318 * 2 ** (st / 12), dur: 0.35, v: 0.09, tipe: "triangle", ke, kirim: 0.6 })); },
  tLompat(t, ke) { desis({ t, dur: 0.1, v: 0.1, bp: 900, q: 0.8, ke }); },
  tMendarat(t, ke) { nada({ t, f: 110, dur: 0.1, v: 0.2, tipe: "sine", geser: 0.6, ke }); desis({ t, dur: 0.05, v: 0.1, lp: 900, ke }); },
  tJatuh(t, ke) { nada({ t, f: 80, dur: 0.3, v: 0.4, tipe: "sine", geser: 0.5, ke }); desis({ t, dur: 0.22, v: 0.22, lp: 700, ke }); },
  tRaih(t, ke) { desis({ t, dur: 0.08, v: 0.14, bp: 700, q: 1.2, ke }); },
  tBanting(t, ke, o = {}) {
    if (!sampel(t, ke, { mulai: 0.3, lama: 0.5, laju: o.gempa ? 0.75 : 0.9, v: 0.9 })) nada({ t, f: 70, dur: 0.45, v: 0.5, tipe: "sine", geser: 0.4, ke });
    nada({ t, f: o.gempa ? 45 : 60, dur: o.gempa ? 0.9 : 0.5, v: 0.45, tipe: "sine", geser: 0.6, ke, kirim: 0.3 });
    desis({ t, dur: o.gempa ? 0.7 : 0.35, v: 0.3, lp: 600, ke });
  },
  tEs(t, ke) { for (let j = 0; j < 5; j++) nada({ t: t + j * 0.03, f: 2400 + j * 300, dur: 0.18, v: 0.05, tipe: "sine", ke, kirim: 0.5 }); desis({ t, dur: 0.25, v: 0.12, hp: 5000, ke }); },
  tApi(t, ke) { desis({ t, dur: 0.45, v: 0.22, bp: 500, q: 0.6, ke }); nada({ t, f: 90, dur: 0.4, v: 0.2, tipe: "sawtooth", lp: 400, geser: 1.6, ke }); },
  tTeleport(t, ke) { nada({ t, f: 900, dur: 0.25, v: 0.1, tipe: "sine", geser: 0.25, ke, kirim: 0.5 }); desis({ t, dur: 0.2, v: 0.12, hp: 2500, ke }); },
  tJurus(t, ke) { nada({ t, f: 220, dur: 0.4, v: 0.12, tipe: "sawtooth", lp: 1400, geser: 2.2, ke, kirim: 0.4 }); desis({ t, dur: 0.3, v: 0.12, bp: 1600, q: 0.7, ke }); },
  tPamungkas(t, ke) {
    E.gong(t, ke);
    nada({ t, f: 110, dur: 1.1, a: 0.3, v: 0.2, tipe: "sawtooth", tipe2: "square", det: 12, lp: 1200, geser: 3, ke, kirim: 0.5 });
    desis({ t: t + 0.1, dur: 0.9, v: 0.16, bp: 800, q: 0.5, ke });
  },
  tLedak(t, ke) { nada({ t, f: 60, dur: 0.8, v: 0.5, tipe: "sine", geser: 0.4, ke, kirim: 0.4 }); desis({ t, dur: 0.7, v: 0.35, lp: 1500, ke }); },
  tArmor(t, ke) { nada({ t, f: 520, dur: 0.3, v: 0.14, tipe: "square", lp: 2000, geser: 0.8, ke, kirim: 0.5 }); },
  tKo(t, ke) {
    if (!sampel(t, ke, { mulai: 0.25, lama: 1.2, laju: 0.8, v: 1 })) E.tHantam(t, ke);
    E.gong(t + 0.05, ke);
    nada({ t: t + 0.1, f: 55, dur: 1.6, v: 0.4, tipe: "sine", geser: 0.7, ke, kirim: 0.5 });
  },
  tRonde(t, ke) { E.gong(t, ke); [0, 0.18].forEach((d) => nada({ t: t + d, f: 98, dur: 0.25, v: 0.35, tipe: "sine", geser: 0.6, ke })); },
  tTarung(t, ke) {
    if (sampel(t, ke, { mulai: 0, lama: 1.6, laju: 1, v: 1 })) return;
    E.fanfare(t, ke);
  },
  tik(t, ke) { nada({ t, f: 1500 + Math.random() * 200, dur: 0.03, a: 0.001, v: 0.09, tipe: "square", lp: 4000, ke }); },
  teriak(t, ke) { nada({ t, f: 700, dur: 0.12, v: 0.12, tipe: "square", geser: 1.5, lp: 2800, ke }); }
};

// Sampel efek pukulan MP3 (dipotong per bagian; nada diacak sedikit agar tidak monoton).
let sampelBuf = null, sampelMuat = false;
function siapkanSampel() {
  if (sampelMuat || !ctx) return;
  sampelMuat = true;
  muatBuffer("/tarung/sfx-hantam.mp3").then((b) => { sampelBuf = b; if (!b) sampelMuat = false; });
}
function sampel(t, ke, { mulai = 0, lama = 0.4, laju = 1, v = 1 }) {
  if (!sampelBuf) siapkanSampel();
  if (!sampelBuf) return false;
  try {
    const s = ctx.createBufferSource();
    s.buffer = sampelBuf;
    s.playbackRate.value = laju;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.setTargetAtTime(0.0001, t + lama * 0.8, 0.05);
    s.connect(g); g.connect(ke);
    s.start(t, mulai, lama + 0.2);
    return true;
  } catch { return false; }
}

/** Suara pembawa acara (mesin ucap peramban) — "Ronde satu", "Tarung!", "K.O." — ikut tombol efek suara. */
let suaraAcara = null;
function muatSuaraAcara() {
  try { const v = window.speechSynthesis.getVoices(); suaraAcara = v.find((x) => /^id/i.test(x.lang)) || v.find((x) => /^en/i.test(x.lang)) || null; } catch {}
}
if (typeof window !== "undefined" && window.speechSynthesis) {
  muatSuaraAcara();
  try { window.speechSynthesis.addEventListener("voiceschanged", muatSuaraAcara); } catch {}
}
export function pembawaAcara(teks) {
  if (!pref.efek || !gestur || typeof window === "undefined" || !window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined") return;
  try {
    const ss = window.speechSynthesis;
    const sibuk = ss.speaking || ss.pending;
    if (sibuk) ss.cancel();
    if (ss.paused) ss.resume();
    const u = new SpeechSynthesisUtterance(teks);
    if (!suaraAcara) muatSuaraAcara();
    if (suaraAcara) { u.voice = suaraAcara; u.lang = suaraAcara.lang; } else u.lang = "id-ID";
    u.rate = 0.92; u.pitch = 0.55; u.volume = 1;
    // Chrome sering membisukan speak() yang dipanggil sesaat setelah cancel(): beri jeda singkat.
    setTimeout(() => { try { ss.speak(u); } catch {} }, sibuk ? 90 : 0);
  } catch {}
}

const kunciTahan = new Map();
/** Memainkan efek. `opsi` ikut ke pembangkit (mis. { level }, { baris }, { pengali }). */
export function efek(nama, opsi = {}) {
  if (!pref.efek || !gestur) return;
  const c = bukaKonteks();
  if (!c) return;
  const f = E[nama];
  if (!f) return;
  // Batasi efek beruntun yang sama (mis. pasak plinko) agar tidak menumpuk.
  const kini = performance.now();
  const rapat = nama === "pasak" ? 28 : nama === "klik" ? 40 : nama === "tik" ? 35 : nama === "tDesir" ? 45 : nama === "tPukul" || nama === "tHantam" ? 30 : 0;
  if (rapat && kini - (kunciTahan.get(nama) || 0) < rapat) return;
  kunciTahan.set(nama, kini);
  const main = () => { try { f(c.currentTime + (opsi.tunda || 0) + 0.005, jalur.efek, opsi); } catch {} };
  if (c.state === "running") { main(); return; }
  // Konteks tertahan (tab disembunyikan, iOS, hemat daya): bangunkan lalu mainkan selama efeknya masih segar.
  c.resume().then(() => { if (c.state === "running" && performance.now() - kini < 900) main(); }).catch(() => {});
}
