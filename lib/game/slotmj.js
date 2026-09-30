// Mahjong Spin 1024 — slot ubin mahjong solo (5 gulungan × 4 baris = 1024 jalur).
//
//  • Kemenangan: 3+ gulungan berurutan dari kiri yang memuat simbol yang sama; jalur = perkalian jumlah
//    ubin sama (atau WILD) pada tiap gulungan. Hadiah = tabel bayar × jalur.
//  • Kaskade: ubin yang menang hilang, ubin di atasnya jatuh, ubin baru mengisi; berulang selama
//    masih ada kemenangan. Pengali kombo naik tiap kaskade (×1 ×2 ×3 ×5; putaran gratis ×2 ×4 ×6 ×10).
//  • Ubin EMAS (gulungan 2–4): bila ikut menang berubah menjadi WILD, bukan hilang.
//  • WILD (gulungan 2–4) menggantikan ubin biasa. 3+ SCATTER 福 → putaran gratis.
//
// Semua hasil dihitung di server dengan acak kriptografis SEBELUM taruhan dipotong, lalu dikirim utuh
// ke klien hanya untuk dianimasikan. Tabel bayar dikalibrasi (skrip uji) supaya RTP ≈ 96%.
export const KOLOM = 5;
export const BARIS = 4;
export const SIMBOL = 9; // 0..8 ubin biasa (0 tertinggi), WILD = 9, SCATTER = 10
export const WILD = 9;
export const SCATTER = 10;
export const RTP_TARGET = 0.96;
export const MAKS_PENGALI = 5000; // batas kemenangan per putaran (× taruhan)
export const MAKS_GRATIS = 40;
const MAKS_KASKADE = 30;

export const LADDER_DASAR = [1, 2, 3, 5];
export const LADDER_GRATIS = [2, 4, 6, 10];

// Bobot ubin biasa (isi ulang & awal), peluang WILD/SCATTER/EMAS per sel.
const BOBOT = [2, 4, 6, 8, 11, 14, 17, 20, 24];
const P_WILD = 0.022; // per sel, gulungan 2–4, hanya di layar awal
const P_SCATTER = 0.019; // per sel, layar awal
const P_EMAS = 0.085; // per sel ubin biasa, gulungan 2–4

// Bayar (× taruhan × jalur) untuk 3, 4, 5 gulungan. Dikalikan SKALA hasil kalibrasi.
const BAYAR = [
  [0.5, 1.5, 6],
  [0.3, 0.9, 3.5],
  [0.2, 0.6, 2.2],
  [0.12, 0.35, 1.2],
  [0.08, 0.22, 0.8],
  [0.06, 0.15, 0.55],
  [0.045, 0.11, 0.4],
  [0.03, 0.08, 0.3],
  [0.02, 0.06, 0.2]
];
export let SKALA = 0.36;
/** Hanya untuk kalibrasi/pengujian. */
export function aturSkala(x) { SKALA = x; }

const JUMLAH_BOBOT = BOBOT.reduce((a, b) => a + b, 0);
function acakBiasa(rng) {
  let x = rng() * JUMLAH_BOBOT;
  for (let s = 0; s < BOBOT.length; s++) { x -= BOBOT[s]; if (x < 0) return s; }
  return BOBOT.length - 1;
}
const tengahKol = (c) => c >= 1 && c <= 3;

// Putaran gratis lebih "panas": lebih banyak WILD & ubin emas (selain pengali kombo lebih tinggi).
const GRATIS = { wild: 2.1, emas: 1.9 };
function selAwal(c, rng, g) {
  if (tengahKol(c) && rng() < P_WILD * (g ? GRATIS.wild : 1)) return [WILD, 0];
  if (rng() < P_SCATTER) return [SCATTER, 0];
  const s = acakBiasa(rng);
  return [s, tengahKol(c) && rng() < P_EMAS * (g ? GRATIS.emas : 1) ? 1 : 0];
}
function selIsi(c, rng, g) {
  const s = acakBiasa(rng);
  return [s, tengahKol(c) && rng() < P_EMAS * (g ? GRATIS.emas : 1) ? 1 : 0];
}
export const bayarTabel = () => BAYAR.map((b) => b.map((x) => Math.round(x * SKALA * 10000) / 10000));

/** Menilai layar: daftar kemenangan (tanpa pengali kombo) dan sel yang ikut. */
export function nilai(grid) {
  const menang = [];
  const ikut = Array.from({ length: KOLOM }, () => Array(BARIS).fill(false));
  for (let s = 0; s < SIMBOL; s++) {
    const cacah = [];
    for (let c = 0; c < KOLOM; c++) {
      let n = 0;
      for (let r = 0; r < BARIS; r++) { const v = grid[c][r][0]; if (v === s || v === WILD) n++; }
      cacah.push(n);
    }
    let L = 0;
    while (L < KOLOM && cacah[L] > 0) L++;
    if (L < 3) continue;
    let jalur = 1;
    for (let c = 0; c < L; c++) jalur *= cacah[c];
    menang.push({ s, panjang: L, jalur, bayar: BAYAR[s][L - 3] * SKALA * jalur });
    for (let c = 0; c < L; c++) for (let r = 0; r < BARIS; r++) { const v = grid[c][r][0]; if (v === s || v === WILD) ikut[c][r] = true; }
  }
  return { menang, ikut };
}

const salin = (g) => g.map((k) => k.map((x) => [x[0], x[1]]));

/** Satu putaran (dasar atau gratis) lengkap dengan kaskade. */
function putarSatu(rng, gratis) {
  const ladder = gratis ? LADDER_GRATIS : LADDER_DASAR;
  let grid = Array.from({ length: KOLOM }, (_, c) => Array.from({ length: BARIS }, () => selAwal(c, rng, gratis)));
  const awal = salin(grid);
  let scatter = 0;
  for (const k of grid) for (const x of k) if (x[0] === SCATTER) scatter++;
  const tahap = [];
  let total = 0;
  for (let langkah = 0; langkah < MAKS_KASKADE; langkah++) {
    const { menang, ikut } = nilai(grid);
    if (!menang.length) break;
    const mult = ladder[Math.min(langkah, ladder.length - 1)];
    const dasar = menang.reduce((a, m) => a + m.bayar, 0);
    total += dasar * mult;
    const hapus = [], emas = [];
    const baru = grid.map((kol, c) => {
      const sisa = [];
      kol.forEach((sel, r) => {
        if (!ikut[c][r]) { sisa.push(sel); return; }
        if (sel[0] < SIMBOL && sel[1]) { sisa.push([WILD, 0]); emas.push([c, r]); return; } // emas → wild, tetap di tempat
        hapus.push([c, r]);
      });
      // jatuh: sel sisa turun ke bawah, isi baru di atas
      const isi = Array.from({ length: BARIS - sisa.length }, () => selIsi(c, rng, gratis));
      return [...isi, ...sisa];
    });
    grid = baru;
    tahap.push({
      menang: menang.map((m) => ({ s: m.s, panjang: m.panjang, jalur: m.jalur, bayar: Math.round(m.bayar * 10000) / 10000 })),
      mult, tambah: Math.round(dasar * mult * 10000) / 10000, hapus, emas, grid: salin(grid)
    });
  }
  return { tipe: gratis ? "gratis" : "dasar", awal, scatter, tahap, total };
}

const HADIAH_GRATIS = (n) => 10 + 2 * (n - 3);

/** Satu ronde penuh: putaran dasar + (bila terpicu) seluruh putaran gratis. `rng()` ∈ [0,1). */
export function putar(rng) {
  const putaran = [];
  let pengali = 0;
  const dasar = putarSatu(rng, false);
  putaran.push(dasar);
  pengali += dasar.total;
  let sisa = 0, dipakai = 0, terpicu = 0;
  if (dasar.scatter >= 3) { sisa = HADIAH_GRATIS(dasar.scatter); terpicu = sisa; }
  while (sisa > 0 && dipakai < MAKS_GRATIS) {
    sisa--; dipakai++;
    const g = putarSatu(rng, true);
    putaran.push(g);
    pengali += g.total;
    if (g.scatter >= 3 && terpicu < MAKS_GRATIS) { const t = Math.min(5 + (g.scatter - 3) * 2, MAKS_GRATIS - terpicu); sisa += t; terpicu += t; g.tambahan = t; }
    if (pengali >= MAKS_PENGALI) break;
  }
  const kena = pengali >= MAKS_PENGALI;
  return { putaran, pengali: Math.min(pengali, MAKS_PENGALI), gratis: dipakai, kenaBatas: kena };
}

export const info = { kode: "slot", nama: "Mahjong Spin 1024", ikon: "🀄", ringkas: "1024 jalur, kaskade & putaran gratis" };
