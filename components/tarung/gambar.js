// Penggambar Arena Pendekar (kanvas 2D): petarung bergradasi & bergaris tegas, 5 arena berlapis paralaks, partikel & efek.
// Koordinat dunia: y ke atas, lantai y=0. Transformasi kamera disiapkan oleh pemanggil (aturKamera).
import { hitungSendi, ukuranTubuh } from "./kerangka";
import { KARAKTER } from "@/lib/tarung/karakter";

// ─────────────────────────── warna ───────────────────────────
const cache = new Map();
function rgb(hex) {
  let c = cache.get(hex);
  if (!c) { const h = hex.replace("#", ""); c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; cache.set(hex, c); }
  return c;
}
const hx = (r, g, b) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
export function campurWarna(a, b, t) { const x = rgb(a), y = rgb(b); return hx(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }
export const terang = (a, t) => campurWarna(a, "#ffffff", t);
export const gelap = (a, t) => campurWarna(a, "#000000", t);
function rgba(hex, a) { const c = rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

/** Palet aktif petarung: diwarnai kilat (putih), beku (biru es), bakar (jingga), atau bayangan (ungu). */
function palet(f) {
  const r = f.k.rupa;
  const ubah = (c) => {
    if (!c) return c;
    let o = c;
    if (f.tintBeku > 0) o = campurWarna(o, "#bfefff", 0.45 * f.tintBeku);
    if (f.tintBakar > 0) o = campurWarna(o, "#ff7a2a", 0.22 * f.tintBakar);
    if (f.tintBayang > 0) o = campurWarna(o, "#3b1d6e", f.tintBayang);
    if (f.kilau > 0) o = campurWarna(o, "#ffffff", Math.min(1, f.kilau));
    return o;
  };
  const o = {};
  for (const [k, v] of Object.entries(r)) o[k] = typeof v === "string" && v.startsWith("#") ? ubah(v) : v;
  o.garis = f.kilau > 0.5 ? "#ffffff" : "#0b0a10";
  return o;
}
// campurWarna menerima hex; hasil rgb() string — konversi balik agar bisa dicampur lagi.
function keHex(c) {
  if (!c || c.startsWith("#")) return c;
  const m = c.match(/\d+/g); if (!m) return "#000000";
  return "#" + m.slice(0, 3).map((x) => Number(x).toString(16).padStart(2, "0")).join("");
}

// ─────────────────────────── bentuk dasar ───────────────────────────
function jalurKapsul(ctx, ax, ay, bx, by, ra, rb) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 0.001;
  const nx = -dy / L, ny = dx / L, tn = Math.atan2(ny, nx);
  ctx.beginPath();
  ctx.moveTo(ax + nx * ra, ay + ny * ra);
  ctx.lineTo(bx + nx * rb, by + ny * rb);
  ctx.arc(bx, by, rb, tn, tn - Math.PI, true);
  ctx.lineTo(ax - nx * ra, ay - ny * ra);
  ctx.arc(ax, ay, ra, tn + Math.PI, tn, true);
  ctx.closePath();
}
/** Isi kapsul dengan gradasi melintang (sisi atas lebih terang) + garis tepi. */
function kapsul(ctx, a, b, ra, rb, warna, opsi = {}) {
  const [ax, ay] = a, [bx, by] = b;
  jalurKapsul(ctx, ax, ay, bx, by, ra, rb);
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 0.001;
  let nx = -dy / L, ny = dx / L;
  if (ny < 0) { nx = -nx; ny = -ny; }
  const mx = (ax + bx) / 2, my = (ay + by) / 2, rm = Math.max(ra, rb);
  const g = ctx.createLinearGradient(mx + nx * rm, my + ny * rm, mx - nx * rm, my - ny * rm);
  const w = keHex(warna);
  g.addColorStop(0, terang(w, opsi.kilap ?? 0.28));
  g.addColorStop(0.42, w);
  g.addColorStop(1, gelap(w, opsi.bayang ?? 0.42));
  ctx.fillStyle = g;
  ctx.fill();
  if (opsi.garis !== false) { ctx.lineWidth = opsi.tebal ?? 2.4; ctx.strokeStyle = opsi.garisWarna || "#0b0a10"; ctx.stroke(); }
}
function bulat(ctx, x, y, r, warna, opsi = {}) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  const w = keHex(warna);
  const g = ctx.createRadialGradient(x - r * 0.35, y + r * 0.4, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, terang(w, 0.35));
  g.addColorStop(0.55, w);
  g.addColorStop(1, gelap(w, 0.45));
  ctx.fillStyle = g;
  ctx.fill();
  if (opsi.garis !== false) { ctx.lineWidth = opsi.tebal ?? 2.4; ctx.strokeStyle = opsi.garisWarna || "#0b0a10"; ctx.stroke(); }
}
const tambah = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s];
const kurang = (a, b) => [a[0] - b[0], a[1] - b[1]];
const pjg = (v) => Math.hypot(v[0], v[1]) || 0.001;
const satu = (v) => { const l = pjg(v); return [v[0] / l, v[1] / l]; };
const tegak = (v) => [-v[1], v[0]];

// ─────────────────────────── petarung ───────────────────────────
/**
 * Menggambar satu petarung. f: { k, pose, x, y, hadap, alpha, kilau, tintBeku, tintBakar, tintBayang, aura, t }
 * Mengembalikan sendi dunia (untuk posisi percikan pukulan, jangkar syal, dll).
 */
export function gambarPetarung(ctx, f) {
  const u = f.ukuran || (f.ukuran = ukuranTubuh(f.k.rupa));
  const s = hitungSendi(f.pose, u);
  const w = palet(f);
  const r = f.k.rupa;
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(f.hadap, 1);
  ctx.globalAlpha = f.alpha ?? 1;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // aura energi
  if (f.aura > 0) {
    const pusat = s.pinggang;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const rr = 170 * u.t * (1 + 0.06 * Math.sin(f.t * 9));
    const g = ctx.createRadialGradient(pusat[0], pusat[1] + 30, 10, pusat[0], pusat[1] + 30, rr);
    g.addColorStop(0, rgba(keHex(r.aura), 0.32 * f.aura));
    g.addColorStop(0.55, rgba(keHex(r.aura), 0.12 * f.aura));
    g.addColorStop(1, rgba(keHex(r.aura), 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(pusat[0], pusat[1] + 30, rr, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  const gl = (c, t = 0.3) => (c ? gelap(keHex(c), t) : c);
  // ── lengan & kaki belakang (lebih gelap)
  gambarKaki(ctx, s.kb, u, w, r, true);
  gambarLengan(ctx, s.lb, u, w, r, true, f.pose.tg);
  // ── badan
  gambarBadan(ctx, s, u, w, r);
  // ── kepala
  gambarKepala(ctx, s, u, w, r, f);
  // ── kaki & lengan depan
  gambarKaki(ctx, s.kd, u, w, r, false);
  gambarLengan(ctx, s.ld, u, w, r, false, f.pose.tg);
  void gl;
  ctx.restore();

  // sendi dunia (untuk efek)
  const keDunia = (q) => [f.x + q[0] * f.hadap, f.y + q[1]];
  return {
    kepala: keDunia(s.kepala), leher: keDunia(s.leher), pinggang: keDunia(s.pinggang), pin: keDunia(s.pin),
    tanganDepan: keDunia(s.ld.tangan), tanganBelakang: keDunia(s.lb.tangan), kakiDepan: keDunia(s.kd.ujung), kakiBelakang: keDunia(s.kb.ujung),
    lututDepan: keDunia(s.kd.lutut), bahu: keDunia(s.bahu)
  };
}

function gambarLengan(ctx, L, u, w, r, belakang, tg) {
  const g = (c) => (belakang ? gelap(keHex(c), 0.28) : c);
  const kulit = g(w.kulit);
  const lengan = r.ciri === "jenggot" ? kulit : w.baju ? g(w.baju) : kulit;
  const lenganBawah = r.ciri === "jenggot" || r.ciri === "rambutApi" ? kulit : w.baju ? g(w.bajuTerang ? w.baju : w.baju) : kulit;
  kapsul(ctx, L.bahu, L.siku, u.rLenganAtas[0], u.rLenganAtas[1], lengan);
  // tato / gelang lengan atas
  if (r.ciri === "jenggot") {
    const m = tambah(L.bahu, kurang(L.siku, L.bahu), 0.5), d = satu(kurang(L.siku, L.bahu)), n = tegak(d);
    ctx.strokeStyle = belakang ? "rgba(20,10,5,.55)" : "rgba(20,10,5,.75)"; ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(m[0] + n[0] * 9 + d[0] * i * 8, m[1] + n[1] * 9 + d[1] * i * 8); ctx.quadraticCurveTo(m[0] + d[0] * (i * 8 + 4), m[1] + d[1] * (i * 8 + 4), m[0] - n[0] * 9 + d[0] * i * 8, m[1] - n[1] * 9 + d[1] * i * 8); ctx.stroke(); }
  }
  if (r.ciri === "rambutApi") {
    const m = tambah(L.bahu, kurang(L.siku, L.bahu), 0.55);
    kapsul(ctx, tambah(m, satu(kurang(L.siku, L.bahu)), -4), tambah(m, satu(kurang(L.siku, L.bahu)), 4), u.rLenganAtas[1] + 2, u.rLenganAtas[1] + 2, g(w.emas), { tebal: 1.6 });
  }
  kapsul(ctx, L.siku, L.tangan, u.rLenganBawah[0], u.rLenganBawah[1], lenganBawah);
  // balutan / sarung tangan
  const d = satu(kurang(L.tangan, L.siku));
  const pergelangan = tambah(L.tangan, d, -9);
  const balut = r.ciri === "syal" ? g(w.aksen) : r.ciri === "cepol" ? g(w.aksen) : r.ciri === "jenggot" ? g("#e9e2d0") : r.ciri === "rambutApi" ? g(w.emas) : g(w.aksen);
  kapsul(ctx, tambah(pergelangan, d, -6), pergelangan, u.rLenganBawah[1] + 1.5, u.rLenganBawah[1] + 1.5, balut, { tebal: 1.8 });
  // kepalan / telapak
  const tangan = tambah(L.tangan, d, 3);
  if (tg > 0.5) {
    const n = tegak(d);
    kapsul(ctx, tambah(tangan, n, 3), tambah(tambah(tangan, d, 12), n, 2), u.kepalan * 0.72, u.kepalan * 0.55, kulit, { tebal: 2 });
  } else {
    bulat(ctx, tangan[0], tangan[1], u.kepalan, r.ciri === "syal" ? g(w.baju) : kulit, { tebal: 2.2 });
    // buku jari
    ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(tangan[0], tangan[1], u.kepalan * 0.55, Math.atan2(d[1], d[0]) - 0.8, Math.atan2(d[1], d[0]) + 0.8); ctx.stroke();
  }
}

function gambarKaki(ctx, K, u, w, r, belakang) {
  const g = (c) => (belakang ? gelap(keHex(c), 0.3) : c);
  const celana = g(w.celana);
  // celana gombrang: paha lebih lebar, betis tertutup kain sampai pergelangan
  kapsul(ctx, K.pinggul, K.lutut, u.rPaha[0] + 3, u.rPaha[1] + 4, celana);
  kapsul(ctx, K.lutut, K.mata, u.rBetis[0] + 4, u.rBetis[1] + 3, celana);
  // garis lipatan kain
  ctx.strokeStyle = "rgba(0,0,0,.28)"; ctx.lineWidth = 1.6;
  const d = satu(kurang(K.mata, K.lutut));
  ctx.beginPath(); ctx.moveTo(K.lutut[0] + d[0] * 10, K.lutut[1] + d[1] * 10); ctx.lineTo(K.mata[0] - d[0] * 14 + 3, K.mata[1] - d[1] * 14); ctx.stroke();
  // balutan pergelangan & telapak
  const ikat = r.ciri === "jenggot" ? g("#1a120c") : r.ciri === "syal" ? g(w.aksen) : g(w.sarung || w.aksen);
  kapsul(ctx, tambah(K.mata, d, -10), K.mata, u.rBetis[1] + 3.5, u.rBetis[1] + 2.5, ikat, { tebal: 1.8 });
  const sepatu = r.ciri === "jenggot" ? g("#24170e") : r.ciri === "cepol" ? g("#141414") : r.ciri === "syal" ? g("#101016") : g(w.kulit);
  kapsul(ctx, K.mata, K.ujung, 9.5 * u.l, 7.5 * u.l, sepatu, { tebal: 2.2 });
}

function gambarBadan(ctx, s, u, w, r) {
  const a = satu(kurang(s.leher, s.pin)); // sumbu badan (ke atas)
  const n = [a[1], -a[0]]; // arah depan (menghadap kanan saat tegak)
  const titik = (t, sisi) => tambah(tambah(s.pin, a, u.badan * t), n, sisi);
  const L = u.l;
  const depan = [[0, 20 * L], [0.36, 15 * L], [0.68, 25 * L], [0.9, 20 * L], [1, 10 * L]];
  const blk = [[0, -24 * L], [0.38, -15 * L], [0.7, -19 * L], [0.92, -19 * L], [1, -11 * L]];
  ctx.beginPath();
  let p0 = titik(depan[0][0], depan[0][1]);
  ctx.moveTo(p0[0], p0[1]);
  for (let i = 1; i < depan.length; i++) {
    const q = titik(depan[i][0], depan[i][1]), m = titik((depan[i - 1][0] + depan[i][0]) / 2, (depan[i - 1][1] + depan[i][1]) / 2 * 1.04);
    ctx.quadraticCurveTo(m[0], m[1], q[0], q[1]);
  }
  for (let i = blk.length - 1; i >= 0; i--) {
    const q = titik(blk[i][0], blk[i][1]);
    if (i === blk.length - 1) ctx.lineTo(q[0], q[1]);
    else { const m = titik((blk[i + 1][0] + blk[i][0]) / 2, (blk[i + 1][1] + blk[i][1]) / 2 * 1.04); ctx.quadraticCurveTo(m[0], m[1], q[0], q[1]); }
  }
  ctx.closePath();
  const atas = titik(1, 0), bawah = titik(0, 0);
  const isi = w.baju || w.kulit;
  const gr = ctx.createLinearGradient(...titik(0.6, 26 * L), ...titik(0.6, -24 * L));
  gr.addColorStop(0, terang(keHex(isi), 0.25));
  gr.addColorStop(0.45, keHex(isi));
  gr.addColorStop(1, gelap(keHex(isi), 0.45));
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.lineWidth = 2.6; ctx.strokeStyle = w.garis; ctx.stroke();
  void atas; void bawah;
  // detail baju per petarung
  ctx.save();
  ctx.clip();
  if (r.ciri === "jenggot") {
    // otot dada & perut
    ctx.strokeStyle = "rgba(40,18,6,.55)"; ctx.lineWidth = 2.2;
    const d1 = titik(0.74, 22 * L), d2 = titik(0.64, 4 * L);
    ctx.beginPath(); ctx.moveTo(...titik(0.86, 18 * L)); ctx.quadraticCurveTo(d1[0], d1[1], ...d2); ctx.stroke();
    for (const t of [0.3, 0.42, 0.54]) { ctx.beginPath(); ctx.moveTo(...titik(t, 6 * L)); ctx.lineTo(...titik(t, 15 * L)); ctx.stroke(); }
    ctx.strokeStyle = "rgba(255,230,200,.25)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(...titik(0.8, 12 * L)); ctx.lineTo(...titik(0.66, 16 * L)); ctx.stroke();
  } else if (r.ciri === "ikat") {
    // kerah V & lis emas
    ctx.strokeStyle = keHex(w.emas); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(...titik(1, 6 * L)); ctx.lineTo(...titik(0.55, 22 * L)); ctx.stroke();
    ctx.fillStyle = keHex(w.kulit);
    ctx.beginPath(); ctx.moveTo(...titik(1.02, 8 * L)); ctx.lineTo(...titik(0.78, 20 * L)); ctx.lineTo(...titik(1.02, 18 * L)); ctx.closePath(); ctx.fill();
  } else if (r.ciri === "cepol") {
    // kerah putih & kancing kodok
    ctx.fillStyle = "#e9f2ff";
    ctx.beginPath(); ctx.moveTo(...titik(1.02, 0)); ctx.lineTo(...titik(0.88, 14 * L)); ctx.lineTo(...titik(1.02, 18 * L)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#e9f2ff"; ctx.lineWidth = 2.4;
    for (const t of [0.78, 0.64, 0.5]) { ctx.beginPath(); ctx.moveTo(...titik(t, 10 * L)); ctx.lineTo(...titik(t, 22 * L)); ctx.stroke(); }
  } else if (r.ciri === "syal") {
    ctx.strokeStyle = keHex(w.aksen); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(...titik(0.95, 18 * L)); ctx.lineTo(...titik(0.45, -16 * L)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(...titik(0.95, -16 * L)); ctx.lineTo(...titik(0.45, 18 * L)); ctx.stroke();
  } else if (r.ciri === "rambutApi") {
    // pelindung dada emas berpola api
    ctx.fillStyle = keHex(w.emas);
    ctx.beginPath(); ctx.moveTo(...titik(0.92, 18 * L)); ctx.quadraticCurveTo(...titik(0.7, 30 * L), ...titik(0.56, 12 * L)); ctx.lineTo(...titik(0.66, 4 * L)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(120,30,0,.6)"; ctx.lineWidth = 1.6; ctx.stroke();
  }
  ctx.restore();
  // sabuk / selempang
  const sab = r.ciri === "jenggot" ? w.emas : w.sarung;
  const b1 = titik(0.12, 22 * L), b2 = titik(0.12, -25 * L);
  kapsul(ctx, b1, b2, 7 * L, 7 * L, sab, { tebal: 2 });
  if (r.ciri === "jenggot") bulat(ctx, ...titik(0.12, 18 * L), 8 * L, w.emas, { tebal: 1.8 });
  // syal Kaito di leher
  if (r.ciri === "syal") kapsul(ctx, titik(0.98, 14 * L), titik(0.98, -14 * L), 9 * L, 9 * L, w.ikat, { tebal: 2 });
}

function gambarKepala(ctx, s, u, w, r, f) {
  const [x, y] = s.kepala;
  const R = u.kepala;
  const a = Math.atan2(s.kepala[0] - s.leher[0], s.kepala[1] - s.leher[1]); // condong kepala
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-a);
  // leher
  kapsul(ctx, [0, -R * 0.4], [0, -R * 1.25], R * 0.42, R * 0.46, r.ciri === "syal" ? w.baju : w.kulit, { tebal: 2 });
  // rambut belakang (panjang)
  if (r.rambutGaya === "panjang") {
    const sway = Math.sin((f.t || 0) * 3) * 4;
    ctx.beginPath();
    ctx.moveTo(-R * 0.3, R * 0.85);
    ctx.quadraticCurveTo(-R * 1.6, R * 0.6, -R * 1.5 + sway, -R * 1.9);
    ctx.quadraticCurveTo(-R * 1.0 + sway, -R * 1.3, -R * 0.2, -R * 0.4);
    ctx.closePath();
    const gr = ctx.createLinearGradient(-R, R, -R, -R * 2);
    gr.addColorStop(0, keHex(w.rambut)); gr.addColorStop(0.75, "#7a1a08"); gr.addColorStop(1, "#ff8a1f");
    ctx.fillStyle = gr; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = w.garis; ctx.stroke();
  }
  // tengkorak + rahang (tampak samping menghadap kanan)
  ctx.beginPath();
  ctx.moveTo(-R * 0.95, R * 0.1);
  ctx.bezierCurveTo(-R * 1.0, R * 1.15, R * 0.95, R * 1.2, R * 0.98, R * 0.15);
  ctx.lineTo(R * 1.14, -R * 0.12); // hidung
  ctx.lineTo(R * 0.95, -R * 0.28);
  ctx.quadraticCurveTo(R * 0.95, -R * 0.82, R * 0.42, -R * 0.98); // dagu
  ctx.quadraticCurveTo(-R * 0.2, -R * 1.05, -R * 0.55, -R * 0.62);
  ctx.quadraticCurveTo(-R * 1.0, -R * 0.35, -R * 0.95, R * 0.1);
  ctx.closePath();
  const gk = ctx.createRadialGradient(R * 0.3, R * 0.4, R * 0.2, 0, 0, R * 1.4);
  gk.addColorStop(0, terang(keHex(w.kulit), 0.25)); gk.addColorStop(0.6, keHex(w.kulit)); gk.addColorStop(1, gelap(keHex(w.kulit), 0.35));
  ctx.fillStyle = gk; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = w.garis; ctx.stroke();
  // telinga
  ctx.beginPath(); ctx.ellipse(-R * 0.22, R * 0.02, R * 0.17, R * 0.24, 0, 0, Math.PI * 2); ctx.fillStyle = gelap(keHex(w.kulit), 0.12); ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke();
  // jenggot Bima
  if (r.ciri === "jenggot") {
    ctx.beginPath();
    ctx.moveTo(-R * 0.3, -R * 0.2); ctx.quadraticCurveTo(R * 0.1, -R * 1.45, R * 0.85, -R * 0.55); ctx.lineTo(R * 0.92, -R * 0.2); ctx.quadraticCurveTo(R * 0.3, -R * 0.55, -R * 0.1, -R * 0.05); ctx.closePath();
    ctx.fillStyle = keHex(w.rambut); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
  }
  // topeng Kaito
  if (r.rambutGaya === "topeng") {
    ctx.beginPath();
    ctx.moveTo(-R * 1.0, R * 0.05); ctx.lineTo(R * 1.12, R * 0.0); ctx.lineTo(R * 1.0, -R * 0.75); ctx.quadraticCurveTo(R * 0.2, -R * 1.15, -R * 0.6, -R * 0.65); ctx.closePath();
    ctx.fillStyle = keHex(w.baju); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = keHex(w.aksen); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-R * 0.9, -R * 0.2); ctx.lineTo(R * 1.0, -R * 0.25); ctx.stroke();
  }
  // mata & alis
  const marah = f.marah ? 1 : 0;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.ellipse(R * 0.62, R * 0.28, R * 0.16, R * 0.11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = r.ciri === "cepol" ? "#3aa0d0" : r.ciri === "rambutApi" ? "#ff7a1a" : r.ciri === "syal" ? "#b06bff" : "#2a1508";
  ctx.beginPath(); ctx.arc(R * 0.7, R * 0.27, R * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = keHex(w.rambut === "#0e0e14" ? "#222" : w.rambut); ctx.lineWidth = R * 0.13;
  ctx.beginPath(); ctx.moveTo(R * 0.4, R * (0.55 + 0.05 * marah)); ctx.lineTo(R * 0.86, R * (0.44 - 0.08 * marah)); ctx.stroke();
  if (r.rambutGaya !== "topeng" && r.ciri !== "jenggot") { ctx.strokeStyle = "rgba(60,20,10,.7)"; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(R * 0.62, -R * 0.52); ctx.lineTo(R * 0.86, -R * 0.48); ctx.stroke(); }
  // rambut atas
  if (r.rambutGaya === "pendek") {
    ctx.beginPath();
    ctx.moveTo(-R * 0.98, R * 0.25);
    for (let i = 0; i <= 6; i++) { const ang = Math.PI * (0.92 - i * 0.13); const rr = i % 2 ? R * 1.05 : R * 1.32; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr + R * 0.1); }
    ctx.lineTo(R * 0.7, R * 0.62); ctx.quadraticCurveTo(0, R * 0.55, -R * 0.98, R * 0.25); ctx.closePath();
    ctx.fillStyle = keHex(w.rambut); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = w.garis; ctx.stroke();
  } else if (r.rambutGaya === "cepol" || r.rambutGaya === "panjang") {
    ctx.beginPath();
    ctx.moveTo(-R * 0.98, R * 0.1); ctx.bezierCurveTo(-R * 1.05, R * 1.3, R * 0.85, R * 1.35, R * 0.98, R * 0.45); ctx.quadraticCurveTo(R * 0.4, R * 0.7, -R * 0.2, R * 0.55); ctx.quadraticCurveTo(-R * 0.6, R * 0.35, -R * 0.98, R * 0.1); ctx.closePath();
    ctx.fillStyle = keHex(w.rambut); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = w.garis; ctx.stroke();
    if (r.rambutGaya === "cepol") { bulat(ctx, -R * 0.55, R * 1.05, R * 0.42, w.rambut, { tebal: 2 }); bulat(ctx, R * 0.05, R * 1.25, R * 0.38, w.rambut, { tebal: 2 }); }
  } else if (r.rambutGaya === "botak") {
    ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.beginPath(); ctx.ellipse(R * 0.1, R * 0.75, R * 0.45, R * 0.16, -0.3, 0, Math.PI * 2); ctx.fill();
  } else if (r.rambutGaya === "topeng") {
    ctx.beginPath(); ctx.moveTo(-R * 1.02, R * 0.05); ctx.bezierCurveTo(-R * 1.1, R * 1.35, R * 0.9, R * 1.35, R * 1.0, R * 0.42); ctx.lineTo(R * 0.4, R * 0.5); ctx.quadraticCurveTo(-R * 0.4, R * 0.35, -R * 1.02, R * 0.05); ctx.closePath();
    ctx.fillStyle = keHex(w.baju); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = w.garis; ctx.stroke();
  }
  // ikat kepala Raka
  if (r.ciri === "ikat") {
    ctx.beginPath(); ctx.moveTo(-R * 1.0, R * 0.32); ctx.quadraticCurveTo(0, R * 0.62, R * 0.98, R * 0.5); ctx.lineTo(R * 0.96, R * 0.3); ctx.quadraticCurveTo(0, R * 0.38, -R * 0.98, R * 0.08); ctx.closePath();
    ctx.fillStyle = keHex(w.ikat); ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = w.garis; ctx.stroke();
    ctx.fillStyle = keHex(w.emas); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-R * 0.6 + i * R * 0.45, R * 0.36 + i * 0.6, 1.8, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

/** Tali (ikat kepala, syal, pita, ujung rambut) — rantai titik dunia yang diperbarui fisika. Digambar di ruang dunia. */
export function gambarTali(ctx, tali, warna, lebar = 7) {
  if (!tali || tali.length < 2) return;
  ctx.save();
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  for (let i = 0; i < tali.length - 1; i++) {
    const a = tali[i], b = tali[i + 1];
    const t = 1 - i / (tali.length - 1);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = "#0b0a10"; ctx.lineWidth = lebar * t + 3; ctx.stroke();
  }
  for (let i = 0; i < tali.length - 1; i++) {
    const a = tali[i], b = tali[i + 1];
    const t = 1 - i / (tali.length - 1);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = warna; ctx.lineWidth = lebar * t + 0.6; ctx.stroke();
  }
  ctx.restore();
}

export function gambarBayanganLantai(ctx, x, lebar, tinggiLompat) {
  const s = Math.max(0.35, 1 - tinggiLompat / 500);
  ctx.save();
  const g = ctx.createRadialGradient(x, 0, 4, x, 0, lebar * s);
  g.addColorStop(0, "rgba(0,0,0,.5)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, 2, lebar * s, 16 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ─────────────────────────── arena (ruang layar) ───────────────────────────
/** Menggambar latar arena. kam: { x, z } (z = piksel per satuan), lantaiY: y layar lantai. t: waktu (detik). */
export function gambarArena(ctx, id, W, H, kam, lantaiY, t, mutu = 1) {
  const A = ARENA_GAMBAR[id] || ARENA_GAMBAR.candi;
  A(ctx, W, H, kam, lantaiY, t, mutu);
}
const seed = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
function lapis(ctx, W, kam, f, lebarPola, gambarSatu) {
  // Mengulang pola selebar `lebarPola` (satuan dunia) dengan paralaks f.
  const z = kam.z;
  const geser = -kam.x * f * z;
  const lp = lebarPola * z;
  const mulai = Math.floor((-W / 2 - geser) / lp) - 1, akhir = Math.ceil((W / 2 - geser) / lp) + 1;
  for (let i = mulai; i <= akhir; i++) gambarSatu(W / 2 + geser + i * lp, lp, i);
}
function langit(ctx, W, H, warna) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  warna.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function lantai(ctx, W, H, lantaiY, kam, atas, bawah, garis, kilau) {
  const g = ctx.createLinearGradient(0, lantaiY, 0, H);
  g.addColorStop(0, atas); g.addColorStop(1, bawah);
  ctx.fillStyle = g; ctx.fillRect(0, lantaiY, W, H - lantaiY);
  // ubin perspektif
  ctx.strokeStyle = garis; ctx.lineWidth = 1;
  const z = kam.z, titikHilang = W / 2 - kam.x * z * 0.02;
  const jarak = 140 * z;
  const awal = ((-kam.x * z) % jarak) - jarak;
  for (let x = awal - W; x < W * 2; x += jarak) { ctx.beginPath(); ctx.moveTo(titikHilang + (x - titikHilang) * 0.35, lantaiY); ctx.lineTo(x + (x - W / 2) * 0.9, H); ctx.stroke(); }
  for (let i = 1; i < 5; i++) { const yy = lantaiY + (H - lantaiY) * (i * i) / 25; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
  if (kilau) { const k = ctx.createLinearGradient(0, lantaiY, 0, lantaiY + 40); k.addColorStop(0, kilau); k.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = k; ctx.fillRect(0, lantaiY, W, 40); }
}
function api(ctx, x, y, s, t, i = 0) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let k = 0; k < 3; k++) {
    const h = s * (1.4 + 0.35 * Math.sin(t * 13 + i + k * 2.1)), w = s * (0.55 - k * 0.12);
    const g = ctx.createRadialGradient(x, y - h * 0.3, 1, x, y - h * 0.3, h);
    g.addColorStop(0, k === 0 ? "rgba(255,240,180,.9)" : "rgba(255,170,60,.6)");
    g.addColorStop(0.5, "rgba(255,90,20,.45)"); g.addColorStop(1, "rgba(255,60,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x + Math.sin(t * 9 + k) * s * 0.08, y - h * 0.35, w, h * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

const ARENA_GAMBAR = {
  candi(ctx, W, H, kam, ly, t, mutu) {
    langit(ctx, W, ly, [[0, "#22163f"], [0.42, "#7a2f5c"], [0.78, "#f08a4b"], [1, "#ffd27a"]]);
    // matahari
    const mx = W * 0.5 - kam.x * kam.z * 0.04, my = ly - 150 * kam.z;
    const gm = ctx.createRadialGradient(mx, my, 10, mx, my, 260 * kam.z);
    gm.addColorStop(0, "rgba(255,240,190,1)"); gm.addColorStop(0.18, "rgba(255,200,120,.9)"); gm.addColorStop(0.45, "rgba(255,140,80,.25)"); gm.addColorStop(1, "rgba(255,120,60,0)");
    ctx.fillStyle = gm; ctx.fillRect(0, 0, W, ly);
    // gunung jauh
    lapis(ctx, W, kam, 0.08, 1400, (x0, lp, i) => {
      ctx.fillStyle = "#4a2747"; ctx.beginPath(); ctx.moveTo(x0, ly);
      for (let k = 0; k <= 8; k++) ctx.lineTo(x0 + (lp * k) / 8, ly - (110 + 90 * seed(i * 9 + k)) * kam.z * 0.9);
      ctx.lineTo(x0 + lp, ly); ctx.closePath(); ctx.fill();
    });
    // candi bertingkat
    lapis(ctx, W, kam, 0.25, 1900, (x0, lp) => {
      const cx = x0 + lp * 0.5, z = kam.z, dasar = ly;
      ctx.fillStyle = "#2f1833";
      for (let k = 0; k < 6; k++) { const w2 = (520 - k * 78) * z, h2 = 34 * z; ctx.fillRect(cx - w2 / 2, dasar - (k + 1) * h2, w2, h2 + 1); }
      ctx.beginPath(); ctx.moveTo(cx - 40 * z, dasar - 204 * z); ctx.quadraticCurveTo(cx, dasar - 290 * z, cx + 40 * z, dasar - 204 * z); ctx.closePath(); ctx.fill();
      ctx.fillRect(cx - 4 * z, dasar - 320 * z, 8 * z, 60 * z);
      for (let k = 0; k < 5; k++) for (let j = 0; j < 6 - k; j++) { const bx = cx - ((5 - k) * 40 * z) + j * 80 * z; ctx.beginPath(); ctx.arc(bx, dasar - (k + 1) * 34 * z - 6 * z, 9 * z, Math.PI, 0); ctx.fill(); }
    });
    lantai(ctx, W, H, ly, kam, "#7a5440", "#2e1f18", "rgba(0,0,0,.18)", "rgba(255,190,120,.35)");
    // pilar & obor dekat
    lapis(ctx, W, kam, 0.9, 1500, (x0, lp, i) => {
      const z = kam.z, px = x0 + lp * 0.15;
      ctx.fillStyle = "#3a2420"; ctx.fillRect(px - 26 * z, ly - 330 * z, 52 * z, 330 * z);
      ctx.fillStyle = "#58362c"; ctx.fillRect(px - 26 * z, ly - 330 * z, 12 * z, 330 * z);
      ctx.fillStyle = "#2a1a16"; ctx.fillRect(px - 38 * z, ly - 352 * z, 76 * z, 26 * z);
      api(ctx, px, ly - 352 * z, 34 * z, t, i);
    });
    if (mutu > 0) partikelLatar(ctx, W, ly, t, "bara", kam);
  },
  salju(ctx, W, H, kam, ly, t, mutu) {
    langit(ctx, W, ly, [[0, "#0b1736"], [0.5, "#27477e"], [1, "#a7c8ec"]]);
    const bx = W * 0.72 - kam.x * kam.z * 0.03, by = ly - 330 * kam.z;
    ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.arc(bx, by, 34 * kam.z, 0, Math.PI * 2); ctx.fill();
    lapis(ctx, W, kam, 0.06, 1200, (x0, lp, i) => {
      ctx.fillStyle = "#3d5f93"; ctx.beginPath(); ctx.moveTo(x0, ly);
      const puncak = x0 + lp * (0.3 + 0.4 * seed(i)), tinggi = (260 + 80 * seed(i + 3)) * kam.z;
      ctx.lineTo(puncak, ly - tinggi); ctx.lineTo(x0 + lp, ly); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#e8f2ff"; ctx.beginPath(); ctx.moveTo(puncak, ly - tinggi); ctx.lineTo(puncak - 60 * kam.z, ly - tinggi + 70 * kam.z); ctx.lineTo(puncak - 20 * kam.z, ly - tinggi + 60 * kam.z); ctx.lineTo(puncak + 10 * kam.z, ly - tinggi + 80 * kam.z); ctx.lineTo(puncak + 55 * kam.z, ly - tinggi + 66 * kam.z); ctx.closePath(); ctx.fill();
    });
    // pagoda
    lapis(ctx, W, kam, 0.28, 1700, (x0, lp) => {
      const cx = x0 + lp * 0.55, z = kam.z;
      ctx.fillStyle = "#14254a";
      for (let k = 0; k < 4; k++) {
        const w2 = (230 - k * 42) * z, y2 = ly - k * 78 * z;
        ctx.fillRect(cx - w2 * 0.35, y2 - 70 * z, w2 * 0.7, 70 * z);
        ctx.beginPath(); ctx.moveTo(cx - w2 * 0.62, y2 - 64 * z); ctx.quadraticCurveTo(cx, y2 - 100 * z, cx + w2 * 0.62, y2 - 64 * z); ctx.lineTo(cx + w2 * 0.4, y2 - 76 * z); ctx.lineTo(cx - w2 * 0.4, y2 - 76 * z); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#dff0ff"; ctx.fillRect(cx - w2 * 0.6, y2 - 70 * z, w2 * 1.2, 4 * z); ctx.fillStyle = "#14254a";
      }
      for (const dx of [-90, 90]) { const lx = cx + dx * z, lyy = ly - 120 * z; const g = ctx.createRadialGradient(lx, lyy, 2, lx, lyy, 40 * z); g.addColorStop(0, "rgba(255,120,80,.9)"); g.addColorStop(1, "rgba(255,80,40,0)"); ctx.fillStyle = g; ctx.fillRect(lx - 40 * z, lyy - 40 * z, 80 * z, 80 * z); ctx.fillStyle = "#c81d25"; ctx.fillRect(lx - 7 * z, lyy - 10 * z, 14 * z, 20 * z); ctx.fillStyle = "#14254a"; }
    });
    lantai(ctx, W, H, ly, kam, "#b9d6f2", "#4b6d99", "rgba(40,70,110,.22)", "rgba(255,255,255,.45)");
    lapis(ctx, W, kam, 0.9, 1300, (x0, lp) => {
      const z = kam.z, px = x0 + lp * 0.1;
      for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? "#123a2e" : "#0f2f26"; ctx.beginPath(); ctx.moveTo(px - (90 - k * 18) * z, ly - k * 80 * z); ctx.lineTo(px, ly - (k * 80 + 130) * z); ctx.lineTo(px + (90 - k * 18) * z, ly - k * 80 * z); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#eef6ff"; ctx.fillRect(px - (70 - k * 18) * z, ly - k * 80 * z - 8 * z, (140 - k * 36) * z, 6 * z); }
    });
    if (mutu > 0) partikelLatar(ctx, W, H, t, "salju", kam);
  },
  tambang(ctx, W, H, kam, ly, t, mutu) {
    langit(ctx, W, ly, [[0, "#c46a2e"], [0.6, "#eba760"], [1, "#f7d79a"]]);
    lapis(ctx, W, kam, 0.07, 1000, (x0, lp, i) => {
      ctx.fillStyle = "#9a5530"; ctx.beginPath(); ctx.moveTo(x0, ly);
      for (let k = 0; k <= 6; k++) { const yy = ly - (180 + 120 * seed(i * 7 + k)) * kam.z; ctx.lineTo(x0 + (lp * k) / 6, yy); ctx.lineTo(x0 + (lp * (k + 0.5)) / 6, yy); }
      ctx.lineTo(x0 + lp, ly); ctx.closePath(); ctx.fill();
    });
    lapis(ctx, W, kam, 0.3, 1600, (x0, lp) => {
      const z = kam.z, cx = x0 + lp * 0.4;
      ctx.strokeStyle = "#4a2614"; ctx.lineWidth = 8 * z;
      ctx.beginPath(); ctx.moveTo(cx, ly); ctx.lineTo(cx + 60 * z, ly - 300 * z); ctx.lineTo(cx + 120 * z, ly); ctx.moveTo(cx + 18 * z, ly - 90 * z); ctx.lineTo(cx + 102 * z, ly - 90 * z); ctx.moveTo(cx + 36 * z, ly - 180 * z); ctx.lineTo(cx + 84 * z, ly - 180 * z); ctx.stroke();
      ctx.lineWidth = 5 * z; ctx.beginPath(); ctx.moveTo(cx + 60 * z, ly - 300 * z); ctx.lineTo(cx + 330 * z, ly - 300 * z); ctx.lineTo(cx + 330 * z, ly - 220 * z); ctx.stroke();
      const g = ctx.createRadialGradient(cx + 330 * z, ly - 210 * z, 2, cx + 330 * z, ly - 210 * z, 60 * z); g.addColorStop(0, "rgba(255,220,140,.9)"); g.addColorStop(1, "rgba(255,200,100,0)"); ctx.fillStyle = g; ctx.fillRect(cx + 270 * z, ly - 270 * z, 120 * z, 120 * z);
    });
    lantai(ctx, W, H, ly, kam, "#8a5634", "#3a2010", "rgba(40,20,8,.25)", "rgba(255,210,150,.25)");
    lapis(ctx, W, kam, 0.92, 1100, (x0, lp, i) => {
      const z = kam.z, px = x0 + lp * 0.2;
      ctx.fillStyle = "#4a2a18"; ctx.beginPath(); ctx.moveTo(px - 110 * z, ly); ctx.lineTo(px - 70 * z, ly - (90 + 30 * seed(i)) * z); ctx.lineTo(px + 20 * z, ly - 120 * z); ctx.lineTo(px + 100 * z, ly); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#6a3c20"; ctx.beginPath(); ctx.moveTo(px - 70 * z, ly - 90 * z); ctx.lineTo(px + 20 * z, ly - 120 * z); ctx.lineTo(px - 10 * z, ly - 60 * z); ctx.closePath(); ctx.fill();
    });
    if (mutu > 0) partikelLatar(ctx, W, H, t, "debu", kam);
  },
  neon(ctx, W, H, kam, ly, t, mutu) {
    langit(ctx, W, ly, [[0, "#04040d"], [0.6, "#160a2e"], [1, "#3a1550"]]);
    ctx.fillStyle = "rgba(230,230,255,.85)"; ctx.beginPath(); ctx.arc(W * 0.2 - kam.x * kam.z * 0.02, ly - 360 * kam.z, 26 * kam.z, 0, Math.PI * 2); ctx.fill();
    lapis(ctx, W, kam, 0.1, 900, (x0, lp, i) => {
      for (let k = 0; k < 7; k++) {
        const bw = (90 + 60 * seed(i * 13 + k)) * kam.z, bh = (220 + 260 * seed(i * 7 + k * 3)) * kam.z, bx = x0 + (k * lp) / 7;
        ctx.fillStyle = "#0d0a1e"; ctx.fillRect(bx, ly - bh, bw, bh);
        for (let r2 = 0; r2 < bh / (18 * kam.z) - 1; r2++) for (let c = 0; c < bw / (16 * kam.z) - 1; c++) if (seed(i * 101 + k * 17 + r2 * 7 + c) > 0.72) { ctx.fillStyle = seed(r2 + c + k) > 0.5 ? "rgba(255,210,120,.55)" : "rgba(120,220,255,.45)"; ctx.fillRect(bx + c * 16 * kam.z + 5 * kam.z, ly - bh + r2 * 18 * kam.z + 6 * kam.z, 6 * kam.z, 8 * kam.z); }
      }
    });
    lapis(ctx, W, kam, 0.35, 1500, (x0, lp, i) => {
      const z = kam.z, cx = x0 + lp * 0.3, kedip = (Math.sin(t * 7 + i) > -0.85) ? 1 : 0.35;
      for (const [dx, warna, teks] of [[0, "#ff2e88", "夜"], [260, "#29e6ff", "忍"]]) {
        ctx.save(); ctx.shadowColor = warna; ctx.shadowBlur = 24 * z * kedip;
        ctx.strokeStyle = warna; ctx.globalAlpha = kedip; ctx.lineWidth = 5 * z; ctx.strokeRect(cx + dx * z, ly - 330 * z, 90 * z, 120 * z);
        ctx.fillStyle = warna; ctx.font = `900 ${70 * z}px "Noto Sans CJK SC","Noto Sans JP",sans-serif`; ctx.textAlign = "center"; ctx.fillText(teks, cx + (dx + 45) * z, ly - 245 * z);
        ctx.restore();
      }
      ctx.fillStyle = "#18142a"; ctx.fillRect(cx + 450 * z, ly - 200 * z, 110 * z, 200 * z); ctx.fillRect(cx + 470 * z, ly - 240 * z, 70 * z, 40 * z);
    });
    lantai(ctx, W, H, ly, kam, "#1d1830", "#07060d", "rgba(120,80,200,.18)", "rgba(255,60,160,.22)");
    // pantulan neon basah
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    lapis(ctx, W, kam, 0.35, 1500, (x0, lp) => { for (const [dx, warna] of [[45, "rgba(255,46,136,.18)"], [305, "rgba(41,230,255,.16)"]]) { ctx.fillStyle = warna; ctx.fillRect(x0 + lp * 0.3 + (dx - 20) * kam.z, ly + 6, 40 * kam.z, (H - ly) * 0.9); } });
    ctx.restore();
    lapis(ctx, W, kam, 0.95, 1000, (x0, lp) => { const z = kam.z; ctx.strokeStyle = "#2a2440"; ctx.lineWidth = 6 * z; ctx.beginPath(); ctx.moveTo(x0, ly - 70 * z); ctx.lineTo(x0 + lp, ly - 70 * z); ctx.stroke(); for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.moveTo(x0 + (k * lp) / 8, ly - 70 * z); ctx.lineTo(x0 + (k * lp) / 8, ly); ctx.stroke(); } });
    if (mutu > 0) partikelLatar(ctx, W, H, t, "hujan", kam);
  },
  kawah(ctx, W, H, kam, ly, t, mutu) {
    langit(ctx, W, ly, [[0, "#140303"], [0.55, "#4a0f06"], [1, "#b8360c"]]);
    lapis(ctx, W, kam, 0.05, 2400, (x0, lp) => {
      const cx = x0 + lp * 0.5, z = kam.z;
      ctx.fillStyle = "#2a0b06"; ctx.beginPath(); ctx.moveTo(cx - 600 * z, ly); ctx.lineTo(cx - 90 * z, ly - 380 * z); ctx.lineTo(cx + 90 * z, ly - 380 * z); ctx.lineTo(cx + 600 * z, ly); ctx.closePath(); ctx.fill();
      const g = ctx.createRadialGradient(cx, ly - 390 * z, 4, cx, ly - 390 * z, 220 * z); g.addColorStop(0, "rgba(255,190,80,.95)"); g.addColorStop(0.3, "rgba(255,90,20,.55)"); g.addColorStop(1, "rgba(255,40,0,0)"); ctx.fillStyle = g; ctx.fillRect(cx - 220 * z, ly - 610 * z, 440 * z, 440 * z);
      ctx.strokeStyle = "rgba(255,110,30,.9)"; ctx.lineWidth = 5 * z; ctx.beginPath(); ctx.moveTo(cx - 20 * z, ly - 380 * z); ctx.quadraticCurveTo(cx - 60 * z, ly - 250 * z, cx - 140 * z, ly - 120 * z); ctx.stroke();
      for (let k = 0; k < 4; k++) { const a = (t * 0.2 + k * 0.25) % 1; ctx.fillStyle = `rgba(60,40,40,${0.35 * (1 - a)})`; ctx.beginPath(); ctx.arc(cx + Math.sin(k * 2) * 30 * z, ly - (400 + a * 260) * z, (50 + a * 90) * z, 0, Math.PI * 2); ctx.fill(); }
    });
    lapis(ctx, W, kam, 0.3, 1400, (x0, lp, i) => {
      const z = kam.z;
      ctx.fillStyle = "#1e0805"; ctx.beginPath(); ctx.moveTo(x0, ly);
      for (let k = 0; k <= 7; k++) ctx.lineTo(x0 + (lp * k) / 7, ly - (60 + 70 * seed(i * 5 + k)) * z);
      ctx.lineTo(x0 + lp, ly); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(255,${120 + 40 * Math.sin(t * 2 + i)},40,.8)`; ctx.lineWidth = 4 * z; ctx.beginPath(); ctx.moveTo(x0 + lp * 0.1, ly - 20 * z); ctx.bezierCurveTo(x0 + lp * 0.3, ly - 60 * z, x0 + lp * 0.5, ly - 10 * z, x0 + lp * 0.8, ly - 40 * z); ctx.stroke();
    });
    lantai(ctx, W, H, ly, kam, "#3a1610", "#0d0403", "rgba(255,90,20,.12)", "rgba(255,120,40,.35)");
    // retakan menyala
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    lapis(ctx, W, kam, 1, 700, (x0, lp, i) => { ctx.strokeStyle = `rgba(255,${90 + 50 * Math.sin(t * 3 + i)},20,.55)`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 + lp * 0.2, ly + 14); ctx.lineTo(x0 + lp * 0.32, ly + 34); ctx.lineTo(x0 + lp * 0.28, ly + 58); ctx.lineTo(x0 + lp * 0.4, ly + 90); ctx.stroke(); });
    ctx.restore();
    if (mutu > 0) partikelLatar(ctx, W, H, t, "bara", kam);
  }
};

/** Partikel latar ringan (dihitung dari waktu — tanpa status). */
function partikelLatar(ctx, W, H, t, jenis, kam) {
  ctx.save();
  const n = jenis === "hujan" ? 70 : 42;
  for (let i = 0; i < n; i++) {
    const a = seed(i * 3.1), b = seed(i * 7.7);
    if (jenis === "salju") {
      const y = ((t * (30 + 40 * b) + a * H) % H), x = ((a * W * 1.3 + Math.sin(t + i) * 30 - kam.x * kam.z * 0.5) % W + W) % W;
      ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * b})`; ctx.beginPath(); ctx.arc(x, y, 1.5 + 2.5 * b, 0, Math.PI * 2); ctx.fill();
    } else if (jenis === "hujan") {
      const y = ((t * (700 + 300 * b) + a * H) % H), x = ((a * W * 1.2 - kam.x * kam.z * 0.6) % W + W) % W;
      ctx.strokeStyle = "rgba(170,190,255,.35)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 22); ctx.stroke();
    } else if (jenis === "bara") {
      const y = H - ((t * (25 + 45 * b) + a * H) % H), x = ((a * W + Math.sin(t * 1.5 + i) * 40 - kam.x * kam.z * 0.4) % W + W) % W;
      ctx.fillStyle = `rgba(255,${140 + 80 * b},60,${0.4 + 0.5 * b})`; ctx.beginPath(); ctx.arc(x, y, 1.2 + 2 * b, 0, Math.PI * 2); ctx.fill();
    } else {
      const y = ((a * H * 0.9 + Math.sin(t * 0.7 + i) * 20)), x = ((a * W + t * 12 * (b + 0.3) - kam.x * kam.z * 0.4) % W + W) % W;
      ctx.fillStyle = `rgba(255,230,190,${0.15 + 0.25 * b})`; ctx.beginPath(); ctx.arc(x, y, 1 + 2 * b, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// ─────────────────────────── potret (pilih karakter, HUD) ───────────────────────────
const potretCache = new Map();
/** Kanvas potret petarung (setengah badan) — dibuat sekali, dipakai ulang. */
export function potret(id, ukuran = 160, posePilihan = null) {
  const kunci = `${id}:${ukuran}:${posePilihan ? JSON.stringify(posePilihan).length : 0}`;
  if (potretCache.has(kunci)) return potretCache.get(kunci);
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = ukuran;
  const ctx = c.getContext("2d");
  const k = KARAKTER[id];
  const g = ctx.createRadialGradient(ukuran / 2, ukuran * 0.4, 4, ukuran / 2, ukuran / 2, ukuran * 0.75);
  g.addColorStop(0, terang(k.rupa.aura, 0.15)); g.addColorStop(1, gelap(k.rupa.aura, 0.75));
  ctx.fillStyle = g; ctx.fillRect(0, 0, ukuran, ukuran);
  const z = ukuran / 170;
  ctx.setTransform(z, 0, 0, -z, ukuran * 0.46, ukuran + 175 * z);
  gambarPetarung(ctx, { k, pose: posePilihan || POSE_POTRET, x: 0, y: 0, hadap: 1, t: 0.4, kilau: 0, aura: 0 });
  potretCache.set(kunci, c);
  return c;
}
const POSE_POTRET = { bd: 6, kp: -6, ad1: 34, ad2: 120, ab1: 18, ab2: 130, kd1: 20, kd2: 20, kb1: -16, kb2: 8, rot: 0, tx: 0, ty: 0, ud: 0, tg: 0, rb: 0 };
