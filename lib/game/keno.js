// Keno Hoki — pilih 1–10 angka dari 1–40; server mengundi 10 angka tanpa pengembalian. Bayaran menurut jumlah tebakan benar.
//
// Peluang tiap jumlah kena k mengikuti sebaran hipergeometrik: P(k) = C(n,k)·C(40−n,10−k) / C(40,10).
// Tabel bayar dihitung (bukan ditebak): bentuknya ∝ P(k)^−0,85 untuk k ≥ ambang, lalu diskalakan dengan pencarian biner
// agar RTP ≈ 96% PER JUMLAH PILIHAN, dengan batas ×1000. Jadi tampilan tabel = yang dipakai server.
export const RTP_TARGET = 0.96;
export const TOTAL = 40;
export const UNDI = 10;
export const MAKS_PILIH = 10;
export const MAKS_PENGALI = 1000;

export const info = { kode: "keno", nama: "Keno Hoki", ikon: "🎱", ringkas: "pilih angka, 10 angka diundi, hingga ×1000" };

const C = (n, k) => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
};
const peluang = (n, k) => (C(n, k) * C(TOTAL - n, UNDI - k)) / C(TOTAL, UNDI);
const ambang = (n) => (n <= 2 ? n : Math.ceil(n / 2));

function bikinTabel(n) {
  const p = Array.from({ length: n + 1 }, (_, k) => peluang(n, k));
  const k0 = ambang(n);
  const bobot = p.map((x, k) => (k >= k0 && x > 0 ? x ** -0.85 : 0));
  const rtp = (c) => bobot.reduce((s, w, k) => s + p[k] * Math.min(MAKS_PENGALI, c * w), 0);
  let lo = 0, hi = 1e12;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (rtp(mid) > RTP_TARGET) hi = mid; else lo = mid; }
  const c = (lo + hi) / 2;
  const m = bobot.map((w) => (w ? Math.round(Math.min(MAKS_PENGALI, c * w) * 100) / 100 : 0));
  // Pembulatan 2 desimal menggeser RTP sedikit: koreksi pada jumlah kena berbayar yang paling sering (bukan yang dibatasi ×1000).
  let ks = -1;
  m.forEach((x, k) => { if (x > 0 && x < MAKS_PENGALI && (ks < 0 || p[k] > p[ks])) ks = k; });
  if (ks >= 0) {
    const sisa = RTP_TARGET - m.reduce((s, x, k) => s + x * p[k], 0);
    m[ks] = Math.max(0.1, Math.round((m[ks] + sisa / p[ks]) * 100) / 100);
  }
  return { p, m, k0 };
}

const TABEL = {};
for (let n = 1; n <= MAKS_PILIH; n++) TABEL[n] = bikinTabel(n);

/** Pengali per jumlah kena (indeks = k) untuk n angka dipilih. */
export const tabel = (n) => TABEL[n]?.m || null;
export const rtp = (n) => TABEL[n].p.reduce((s, x, k) => s + x * TABEL[n].m[k], 0);
export const peluangKena = (n) => TABEL[n]?.p || null;
export const semuaTabel = () => Object.fromEntries(Object.keys(TABEL).map((n) => [n, { pengali: TABEL[n].m, peluang: TABEL[n].p }]));

/** Memeriksa pilihan pemain: larik bilangan bulat unik 1..40, 1..10 butir. Mengembalikan larik terurut atau null. */
export function sahPilihan(pilih) {
  if (!Array.isArray(pilih) || pilih.length < 1 || pilih.length > MAKS_PILIH) return null;
  const a = pilih.map(Number);
  if (a.some((x) => !Number.isInteger(x) || x < 1 || x > TOTAL)) return null;
  if (new Set(a).size !== a.length) return null;
  return a.sort((x, y) => x - y);
}

/** Satu undian. `rng()` ∈ [0,1). Mengembalikan angka keluar (urut undian), yang kena, dan pengali. */
export function undi(pilih, rng) {
  const p = sahPilihan(pilih);
  if (!p) return null;
  const papan = Array.from({ length: TOTAL }, (_, i) => i + 1);
  for (let i = papan.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [papan[i], papan[j]] = [papan[j], papan[i]]; }
  const keluar = papan.slice(0, UNDI);
  const set = new Set(keluar);
  const kena = p.filter((x) => set.has(x));
  return { pilih: p, keluar, kena, k: kena.length, pengali: TABEL[p.length].m[kena.length] || 0 };
}
