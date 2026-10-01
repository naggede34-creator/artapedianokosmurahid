// Petarung bergambar HD (render 3D) dengan animasi "cutout": badan, lengan, dan kaki dipotong dari satu gambar,
// lalu diputar/ditarik mengikuti pose kerangka (kerangka.js) RELATIF terhadap kuda-kuda siaga — saat diam, petarung
// tampil persis seperti gambar aslinya. Kaki & lengan digambar di belakang badan supaya pangkalnya tertutup bahu/sabuk.
import { hitungSendi, ukuranTubuh } from "./kerangka";
import { poseUntuk } from "./gerak";
import { RIG_SPRITE } from "./dataSprite";

const BD0 = 8; // condong badan pada kuda-kuda siaga
const D2R = Math.PI / 180;
const jepit = (v, a, b) => (v < a ? a : v > b ? b : v);

// ── matriks afine ala kanvas [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f
const kali = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const geser = (x, y) => [1, 0, 0, 1, x, y];
const putar = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
const skala = (x, y) => [x, 0, 0, y, 0, 0];
const terap = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
const sudut = (v) => Math.atan2(v[1], v[0]);
const panjang = (v) => Math.hypot(v[0], v[1]) || 1e-6;
const beda = (a, b) => [a[0] - b[0], a[1] - b[1]];

// ─────────────────────────── muat gambar ───────────────────────────
const muatan = new Map();
/** Mulai memuat atlas sprite (aman dipanggil berulang). */
export function muatSprite(nama) {
  let e = muatan.get(nama);
  if (e) return e;
  e = { siap: false, gagal: false, img: null, tint: new Map(), janji: null };
  muatan.set(nama, e);
  if (typeof Image === "undefined" || !RIG_SPRITE[nama]) { e.gagal = true; e.janji = Promise.resolve(false); return e; }
  const img = new Image();
  img.decoding = "async";
  e.janji = new Promise((res) => {
    img.onload = () => { e.img = img; e.siap = true; res(true); };
    img.onerror = () => { e.gagal = true; res(false); };
  });
  img.src = `/tarung/${nama}.webp?v=1`;
  return e;
}
/** Muat atlas semua petarung yang dipakai; selesai saat semuanya siap (atau gagal). */
export function muatSemua(daftarKarakter) {
  return Promise.all(daftarKarakter.filter((k) => k?.rupa?.sprite).map((k) => muatSprite(k.rupa.sprite).janji));
}
export const urlPotret = (k) => (k?.rupa?.sprite ? `/tarung/potret-${k.rupa.sprite}.webp?v=1` : null);

/** Atlas siluet satu warna (kilat putih, es, api, bayangan) — dibuat sekali per warna. */
function atlasTint(e, warna) {
  let c = e.tint.get(warna);
  if (c) return c;
  if (typeof document === "undefined") return null;
  c = document.createElement("canvas");
  c.width = e.img.naturalWidth || e.img.width;
  c.height = e.img.naturalHeight || e.img.height;
  const x = c.getContext("2d");
  x.drawImage(e.img, 0, 0);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = warna;
  x.fillRect(0, 0, c.width, c.height);
  e.tint.set(warna, c);
  return c;
}

// ─────────────────────────── kalibrasi rig ───────────────────────────
const CONDONG = 0.65; // kepala chibi besar: condong badan diperkecil agar tidak tampak jatuh
const kalib = new Map();
function rigUntuk(k) {
  let r = kalib.get(k.id);
  if (r) return r;
  const R = RIG_SPRITE[k.rupa.sprite];
  const u = ukuranTubuh(k.rupa);
  const kpx = (300 * (k.rupa.tinggi || 1)) / (R.lantai - R.atas); // satuan dunia per piksel gambar
  // Lengan kerangka mana yang menggerakkan potongan lengan mana (ninja: golok di tangan belakang gambar = tangan
  // depan kerangka, jadi semua pukulan/tebasan tangan depan memakai golok).
  const peta = k.rupa.tukarLengan ? { lenganD: "lb", lenganB: "ld" } : { lenganD: "ld", lenganB: "lb" };
  const s0 = hitungSendi(poseUntuk(k.id).siaga, u);
  const vec = (s, kunci) => (kunci === "ld" ? beda(s.ld.tangan, s.ld.bahu) : kunci === "lb" ? beda(s.lb.tangan, s.lb.bahu) : kunci === "kd" ? beda(s.kd.mata, s.kd.pinggul) : beda(s.kb.mata, s.kb.pinggul));
  const ref = { lenganD: vec(s0, peta.lenganD), lenganB: vec(s0, peta.lenganB), kakiD: vec(s0, "kd"), kakiB: vec(s0, "kb"), ld: vec(s0, "ld"), lb: vec(s0, "lb") };
  r = { R, u, kpx, ref, peta, vec, hip0: s0.tinggiPinggul, punyaLenganB: !!R.bagian.lenganB };
  kalib.set(k.id, r);
  return r;
}

// Urutan gambar: anggota di belakang badan dulu (pangkalnya tertutup bahu/sabuk), lalu badan, lalu varian depan
// (lengan depan selalu; kaki depan saat diangkat menendang) dengan pangkal yang dilembutkan.
const URUT = ["kakiB", "kakiD", "lenganB"];
const lembut = (x, a, b) => { const t = jepit((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function matriksAnggota(B, Mb, th, d, r, kpx) {
  const Q = terap(Mb, B.pivot); // sendi menempel pada badan (ikut condong & penyet)
  const phi = Math.atan2(B.ujung[1] - B.pivot[1], B.ujung[0] - B.pivot[0]);
  return kali(kali(kali(kali(kali(kali(geser(Q[0], Q[1]), putar(th + d)), skala(kpx, -kpx)), putar(phi)), skala(r, 1)), putar(-phi)), geser(-B.pivot[0], -B.pivot[1]));
}

/**
 * Hitung matriks tiap potongan untuk pose `p` (ruang lokal: y ke atas, menghadap kanan, kaki di y=0).
 * Mengembalikan { belakang: [...], badan, depan: [...], geserY } — tiap potongan { nama, M, B, alpha }.
 */
export function susunSprite(k, p) {
  const rr = rigUntuk(k);
  const { R, u, kpx, peta, vec } = rr;
  const s = hitungSendi(p, u);
  const th = ((p.rot || 0) - CONDONG * ((p.bd || 0) - BD0)) * D2R;
  // Jongkok/merunduk: badan dipenyet sedikit (kartun) karena kaki gambar tidak bisa ditekuk.
  let sq = 1;
  if (!p.ud && !p.rb) sq = jepit(1 - 0.55 * (1 - s.tinggiPinggul / rr.hip0), 0.74, 1.04);
  const sx = 1 + (1 - sq) * 0.45;
  const P0 = R.pinggul;
  const Mb = kali(kali(kali(geser(s.pin[0], s.pin[1]), putar(th)), skala(kpx * sx, -kpx * sq)), geser(-P0[0], -P0[1]));
  // Vektor tiap anggota dalam kerangka badan yang digambar — dibandingkan dengan kuda-kuda siaga, sehingga arah
  // dunia anggota tubuh tetap sama dengan kerangka walau condong badan sprite diperkecil.
  const balik = putar(-th);
  const keBadan = (v) => terap(balik, v);
  const vektor = { kakiD: keBadan(vec(s, "kd")), kakiB: keBadan(vec(s, "kb")), lenganD: keBadan(vec(s, peta.lenganD)), lenganB: keBadan(vec(s, peta.lenganB)) };
  const refBadan = { ...rr.ref };
  // Tanpa potongan lengan belakang: lengan depan memakai lengan yang lebih menjulur (pukulan tangan belakang ikut tampil).
  if (!rr.punyaLenganB) {
    const vD = keBadan(vec(s, "ld")), vB = keBadan(vec(s, "lb"));
    const w = lembut((vB[0] - vD[0]) / 40, -0.5, 0.5);
    if (w > 0) vektor.lenganD = [vD[0] + (vB[0] - vD[0]) * w, vD[1] + (vB[1] - vD[1]) * w];
  }
  const ubah = (nama) => {
    const v = vektor[nama], v0 = refBadan[nama];
    let d = sudut(v) - sudut(v0);
    if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2;
    const kaki = nama[0] === "k";
    const r = jepit(panjang(v) / panjang(v0), kaki ? 0.62 : 0.8, kaki ? 1.12 : 1.22);
    return { d, r };
  };
  const belakang = [], depan = [];
  const dKaki = {};
  for (const nama of URUT) {
    const B = R.bagian[nama];
    if (!B) continue;
    const { d, r } = ubah(nama);
    dKaki[nama] = d;
    belakang.push({ nama, M: matriksAnggota(B, Mb, th, d, r, kpx), B, alpha: 1 });
  }
  // Lengan depan selalu di depan badan (varian pangkal lembut bila ada).
  const BlD = R.bagian.lenganDDp || R.bagian.lenganD;
  if (BlD) { const { d, r } = ubah("lenganD"); depan.push({ nama: "lenganD", M: matriksAnggota(BlD, Mb, th, d, r, kpx), B: BlD, alpha: 1 }); }
  // Lengan belakang (golok ninja) pindah ke depan badan saat diayun ke depan.
  const BlB = R.bagian.lenganBDp;
  if (BlB && dKaki.lenganB !== undefined) {
    const a = lembut(Math.abs(dKaki.lenganB), 1.05, 1.6);
    if (a > 0.01) { const x = belakang.find((b) => b.nama === "lenganB"); depan.unshift({ nama: "lenganBDp", M: x.M, B: BlB, alpha: a }); }
  }
  // Kaki depan muncul di depan badan saat diangkat (tendangan) supaya tidak tertutup kepala besar.
  const BkD = R.bagian.kakiDDp;
  if (BkD && dKaki.kakiD !== undefined) {
    const a = lembut(dKaki.kakiD, 0.38, 0.75);
    if (a > 0.01) { const x = belakang.find((b) => b.nama === "kakiD"); depan.unshift({ nama: "kakiDDp", M: x.M, B: BkD, alpha: a }); }
  }
  const badan = { nama: "badan", M: Mb, B: R.bagian.badan, alpha: 1 };
  // Tempel ke lantai: titik terendah lambung semua potongan = 0 (kecuali melayang).
  let geserY = 0;
  if (!p.ud) {
    let min = Infinity;
    for (const x of [badan, ...belakang, ...depan]) for (const q of x.B.lambung) { const y = terap(x.M, q)[1]; if (y < min) min = y; }
    if (Number.isFinite(min)) geserY = -min;
  }
  return { belakang, badan, depan, geserY, rr, sendi: s };
}

/** Titik-titik penting (koordinat lokal) dari susunan sprite: tangan, kaki, kepala, dll. */
function titikPenting(z) {
  const { R, peta } = z.rr;
  const semua = [...z.belakang, ...z.depan];
  const cari = (n) => semua.find((b) => b.nama === n);
  const pD = cari("lenganD"), pB = cari("lenganB");
  const ld = peta.lenganD === "ld" ? pD : pB || pD, lb = peta.lenganD === "lb" ? pD : pB || pD;
  const kd = cari("kakiD"), kb = cari("kakiB");
  const g = (m, q) => { const t = terap(m, q); return [t[0], t[1] + z.geserY]; };
  const kepala = g(z.badan.M, R.kepala);
  const pin = g(z.badan.M, R.pinggul);
  return {
    kepala, pin,
    leher: [kepala[0] * 0.5 + pin[0] * 0.5, kepala[1] * 0.45 + pin[1] * 0.55],
    pinggang: [pin[0], pin[1] + (kepala[1] - pin[1]) * 0.3],
    tanganDepan: ld ? g(ld.M, ld.B.ujung) : kepala,
    tanganBelakang: lb ? g(lb.M, lb.B.ujung) : ld ? g(ld.M, ld.B.ujung) : kepala,
    kakiDepan: kd ? g(kd.M, kd.B.ujung) : pin,
    kakiBelakang: kb ? g(kb.M, kb.B.ujung) : pin,
    lututDepan: kd ? g(kd.M, [(kd.B.pivot[0] + kd.B.ujung[0]) / 2, (kd.B.pivot[1] + kd.B.ujung[1]) / 2]) : pin,
    bahu: ld ? g(ld.M, ld.B.pivot) : kepala
  };
}

function gambarPotong(ctx, img, x, skalaAtlas) {
  const [ax, ay, aw, ah] = x.B.atlas;
  const [ox, oy, ow, oh] = x.B.asal;
  ctx.save();
  ctx.transform(x.M[0], x.M[1], x.M[2], x.M[3], x.M[4], x.M[5]);
  ctx.drawImage(img, ax, ay, aw, ah, ox, oy, ow, oh);
  ctx.restore();
  void skalaAtlas;
}

/**
 * Menggambar petarung sprite di ruang dunia (y ke atas; kamera disiapkan pemanggil).
 * f: { k, pose, x, y, hadap, alpha, kilau, tintBeku, tintBakar, tintBayang, aura, t }
 * Mengembalikan sendi dunia (posisi tangan/kaki/kepala) seperti gambarPetarung, atau null bila gambar belum siap.
 */
export function gambarSprite(ctx, f) {
  const e = muatSprite(f.k.rupa.sprite);
  if (!e.siap) return null;
  const z = susunSprite(f.k, f.pose);
  const urutan = [...z.belakang, z.badan, ...z.depan];
  ctx.save();
  ctx.translate(f.x, f.y + z.geserY);
  ctx.scale(f.hadap, 1);
  const a0 = f.alpha ?? 1;
  ctx.globalAlpha = a0;
  if (f.tintBayang > 0.98) {
    // siluet bayangan penuh (klon jurus)
    const c = atlasTint(e, "#2a1250");
    for (const x of urutan) { ctx.globalAlpha = a0 * x.alpha; gambarPotong(ctx, c || e.img, x); }
  } else {
    for (const x of urutan) { ctx.globalAlpha = a0 * x.alpha; gambarPotong(ctx, e.img, x); }
    const lapisan = [];
    if (f.tintBeku > 0) lapisan.push(["#bfeeff", 0.5 * f.tintBeku]);
    if (f.tintBakar > 0) lapisan.push(["#ff6a1a", 0.32 * f.tintBakar]);
    if (f.tintBayang > 0) lapisan.push(["#2a1250", 0.85 * f.tintBayang]);
    if (f.kilau > 0) lapisan.push(["#ffffff", Math.min(0.75, f.kilau * 0.8)]);
    for (const [w, a] of lapisan) {
      const c = atlasTint(e, w);
      if (!c) continue;
      for (const x of urutan) { ctx.globalAlpha = a0 * a * x.alpha; gambarPotong(ctx, c, x); }
    }
  }
  ctx.restore();
  const t = titikPenting(z);
  const dunia = (q) => [f.x + q[0] * f.hadap, f.y + q[1]];
  const o = {};
  for (const [nm, q] of Object.entries(t)) o[nm] = dunia(q);
  return o;
}

/** Lebar & tinggi kasar sprite (satuan dunia) — untuk bayangan lantai dan kamera. */
export function ukuranSprite(k) {
  const R = RIG_SPRITE[k?.rupa?.sprite];
  if (!R) return null;
  const kpx = (300 * (k.rupa.tinggi || 1)) / (R.lantai - R.atas);
  return { lebar: R.potret[2] * kpx, tinggi: (R.lantai - R.atas) * kpx };
}
