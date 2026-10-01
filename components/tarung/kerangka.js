// Kerangka petarung 2D (tampak samping 3/4) — kinematika maju dari sudut-sudut pose.
// Satuan dunia: tinggi petarung ±300. Sumbu y KE ATAS (0 = lantai). Petarung menghadap kanan; dicerminkan saat menghadap kiri.
//
// Pose (derajat):
//  bd badan condong (+ maju) · kp kepala (+ menunduk)
//  ad1/ad2 lengan depan: lengan atas dari arah bawah (+ maju), tekuk siku (+ ke depan/atas)
//  ab1/ab2 lengan belakang
//  kd1/kd2 kaki depan: paha dari arah bawah (+ maju), tekuk lutut (+ betis ke belakang)
//  kb1/kb2 kaki belakang
//  rot putar seluruh tubuh di pinggul (+ terjengkang ke belakang) · tx/ty geser (satuan)
//  ud 1 = melayang: pinggul diletakkan setinggi saat berdiri (posisi y petarung = tinggi lompatan), kaki bebas
//  tg telapak (0 kepalan, 1 terbuka) · rb 1 = rebah (seluruh tubuh, bukan hanya kaki, menyentuh lantai)

export const POSE_KOSONG = { bd: 0, kp: 0, ad1: 0, ad2: 0, ab1: 0, ab2: 0, kd1: 0, kd2: 0, kb1: 0, kb2: 0, rot: 0, tx: 0, ty: 0, ud: 0, tg: 0, rb: 0 };
const KUNCI = Object.keys(POSE_KOSONG);

/** Ukuran tubuh dasar; dikali `tinggi` (panjang) dan `lebar` (tebal) tiap petarung. */
export function ukuranTubuh(rupa) {
  const t = rupa.tinggi || 1, l = rupa.lebar || 1, kk = rupa.kaki || 1; // kaki: proporsi kaki (petarung chibi lebih pendek)
  return {
    t, l,
    badan: 100 * t, leher: 15 * t, kepala: 23 * t,
    lenganAtas: 58 * t, lenganBawah: 54 * t, kepalan: 11.5 * l,
    paha: 76 * t * kk, betis: 72 * t * kk, telapak: 31 * t * kk,
    pinggul0: 155 * t * kk, // tinggi pinggul saat kuda-kuda (dipakai pose melayang)
    bahu: 30 * l, pinggang: 21 * l, pinggul: 25 * l,
    rLenganAtas: [12.5 * l, 10.5 * l], rLenganBawah: [10.5 * l, 8.5 * l],
    rPaha: [17 * l, 13 * l], rBetis: [12.5 * l, 8.5 * l]
  };
}

const rad = (d) => (d * Math.PI) / 180;
// Arah dari "bawah" diputar a derajat ke depan: (sin a, -cos a) dalam sumbu y-ke-atas.
const arah = (a) => [Math.sin(rad(a)), -Math.cos(rad(a))];

/** Campur dua pose (t 0..1). */
export function campur(a, b, t) {
  const o = {};
  for (const k of KUNCI) {
    const x = a[k] ?? 0, y = b[k] ?? 0;
    o[k] = k === "ud" || k === "rb" ? (t < 0.5 ? x : y) : x + (y - x) * t;
  }
  return o;
}
export const lengkap = (p) => ({ ...POSE_KOSONG, ...p });

/**
 * Titik-titik sendi (koordinat lokal y-ke-atas, pinggul di (0, tinggiPinggul), menghadap kanan).
 * Bila pose tidak melayang, tubuh diturunkan/dinaikkan sehingga titik terendah kaki tepat di lantai (y=0).
 */
export function hitungSendi(pose, u) {
  const p = pose;
  const tB = [Math.sin(rad(p.bd)), Math.cos(rad(p.bd))]; // arah badan ke atas
  const pin = [0, 0];
  const leher = [pin[0] + tB[0] * u.badan, pin[1] + tB[1] * u.badan];
  const bahu = [pin[0] + tB[0] * (u.badan - 9 * u.t), pin[1] + tB[1] * (u.badan - 9 * u.t)];
  const aK = rad(p.bd + p.kp);
  const kepala = [leher[0] + Math.sin(aK) * (u.leher + u.kepala * 0.82), leher[1] + Math.cos(aK) * (u.leher + u.kepala * 0.82)];
  const pinggang = [pin[0] + tB[0] * u.badan * 0.38, pin[1] + tB[1] * u.badan * 0.38];

  const lengan = (a1, a2, geser) => {
    const s = [bahu[0] + geser, bahu[1]];
    const d1 = arah(a1 + p.bd), sik = [s[0] + d1[0] * u.lenganAtas, s[1] + d1[1] * u.lenganAtas];
    const d2 = arah(a1 + p.bd + a2), tan = [sik[0] + d2[0] * u.lenganBawah, sik[1] + d2[1] * u.lenganBawah];
    return { bahu: s, siku: sik, tangan: tan, sudutBawah: a1 + p.bd + a2 };
  };
  const kaki = (k1, k2, geser) => {
    const h = [pin[0] + geser, pin[1] - 4];
    const d1 = arah(k1), lut = [h[0] + d1[0] * u.paha, h[1] + d1[1] * u.paha];
    const sb = k1 - k2, d2 = arah(sb), mata = [lut[0] + d2[0] * u.betis, lut[1] + d2[1] * u.betis];
    // Telapak: tegak lurus betis menghadap depan; saat berdiri (betis ±tegak) jadi mendatar.
    const dk = arah(sb + 90), ujung = [mata[0] + dk[0] * u.telapak, mata[1] + dk[1] * u.telapak];
    return { pinggul: h, lutut: lut, mata, ujung, sudutBetis: sb };
  };
  const ld = lengan(p.ad1, p.ad2, 5 * u.l), lb = lengan(p.ab1, p.ab2, -6 * u.l);
  const kd = kaki(p.kd1, p.kd2, 7 * u.l), kb = kaki(p.kb1, p.kb2, -7 * u.l);
  const titik = { pin, leher, bahu, kepala, pinggang, ld, lb, kd, kb };

  // Putar seluruh tubuh di pinggul.
  if (p.rot) {
    const c = Math.cos(rad(p.rot)), s = Math.sin(rad(p.rot));
    // rot + = terjengkang ke belakang (berlawanan arah hadap)
    const putar = (q) => { const x = q[0], y = q[1]; q[0] = x * c - y * s; q[1] = x * s + y * c; };
    jelajah(titik, putar);
  }
  // Titik terendah tubuh (kaki; bila rebah/melayang juga kepala, badan, lengan).
  let kaki0 = Infinity, badan0 = Infinity;
  for (const k of [kd, kb]) for (const q of [k.lutut, k.mata, k.ujung]) kaki0 = Math.min(kaki0, q[1]);
  for (const q of [pin, leher, bahu, pinggang]) badan0 = Math.min(badan0, q[1] - 12 * u.l);
  badan0 = Math.min(badan0, kepala[1] - u.kepala);
  for (const l of [ld, lb]) for (const q of [l.siku, l.tangan]) badan0 = Math.min(badan0, q[1] - 8);
  // Berdiri: kaki tepat di lantai. Rebah: seluruh tubuh tergeletak. Melayang: pinggul setinggi kuda-kuda.
  const naik = p.rb ? -Math.min(kaki0, badan0) : p.ud ? u.pinggul0 : -kaki0;
  const dx = p.tx || 0, dy = (p.ty || 0) + naik;
  jelajah(titik, (q) => { q[0] += dx; q[1] += dy; });
  titik.tinggiPinggul = dy;
  titik.dasar = Math.min(kaki0, badan0) + dy; // titik terendah relatif terhadap posisi y petarung
  return titik;
}

function jelajah(o, fn) {
  for (const v of Object.values(o)) {
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === "number") fn(v);
    else if (v && typeof v === "object" && !Array.isArray(v)) jelajah(v, fn);
  }
}
