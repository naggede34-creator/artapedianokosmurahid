// Plinko solo. Bola jatuh melewati `baris` deret pasak; tiap pasak memilih kiri/kanan
// dengan peluang sama (binomial), sehingga sel tujuan k ∈ [0, baris] berpeluang
// C(baris,k)/2^baris. Pengali tiap sel dihitung dari bentuk kurva risiko lalu
// DIKALIBRASI supaya nilai harapan (RTP) tepat ≈ RTP_TARGET — jadi peluang & hadiah
// yang ditampilkan ke pemain sama persis dengan yang dipakai server.
export const BARIS = [8, 10, 12, 14, 16];
export const RISIKO = ["rendah", "sedang", "tinggi"];
export const RTP_TARGET = 0.96;

// Pengali di tepi (sel paling jarang) per risiko & jumlah baris, mengikuti kebiasaan plinko umum.
const TEPI = {
  rendah: { 8: 5.6, 10: 8.9, 12: 10, 14: 15, 16: 16 },
  sedang: { 8: 13, 10: 22, 12: 33, 14: 58, 16: 110 },
  tinggi: { 8: 29, 10: 76, 12: 170, 14: 420, 16: 1000 }
};
const TENGAH = { rendah: 0.5, sedang: 0.3, tinggi: 0.2 }; // pengali sel paling sering

function peluang(n) {
  const c = [1];
  for (let k = 1; k <= n; k++) c.push((c[k - 1] * (n - k + 1)) / k);
  return c.map((x) => x / 2 ** n);
}

function bentuk(n, tepi, tengah, g) {
  return Array.from({ length: n + 1 }, (_, k) => {
    const d = Math.abs(k - n / 2) / (n / 2);
    return tengah + (tepi - tengah) * d ** g;
  });
}

function kalibrasi(n, risiko) {
  const p = peluang(n);
  const tepi = TEPI[risiko][n];
  const tengah = TENGAH[risiko];
  const ev = (g) => bentuk(n, tepi, tengah, g).reduce((s, m, k) => s + m * p[k], 0);
  let lo = 0.05, hi = 40; // ev turun terhadap g
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (ev(mid) > RTP_TARGET) lo = mid; else hi = mid;
  }
  // Pembulatan 2 desimal sedikit menggeser RTP; sel tengah dikoreksi agar tetap pas.
  const m = bentuk(n, tepi, tengah, (lo + hi) / 2).map((x) => Math.round(x * 100) / 100);
  let sisa = RTP_TARGET - m.reduce((s, x, k) => s + x * p[k], 0);
  const c = n / 2;
  m[c] = Math.max(0.1, Math.round((m[c] + sisa / p[c]) * 100) / 100);
  return m;
}

const TABEL = {};
for (const r of RISIKO) { TABEL[r] = {}; for (const n of BARIS) TABEL[r][n] = kalibrasi(n, r); }

export const tabel = (baris, risiko) => TABEL[risiko]?.[baris] || null;
export const rtp = (baris, risiko) => {
  const p = peluang(baris);
  return tabel(baris, risiko).reduce((s, m, k) => s + m * p[k], 0);
};
export const peluangSel = (baris) => peluang(baris);

/** Menjatuhkan satu bola. `rng()` ∈ [0,1). Mengembalikan jalur (0 = kiri, 1 = kanan) & sel akhir. */
export function jatuh(baris, risiko, rng) {
  if (!BARIS.includes(baris) || !RISIKO.includes(risiko)) return null;
  const jalur = [];
  let k = 0;
  for (let i = 0; i < baris; i++) { const b = rng() < 0.5 ? 0 : 1; jalur.push(b); k += b; }
  return { jalur, sel: k, pengali: tabel(baris, risiko)[k] };
}

export const info = { kode: "plinko", nama: "Plinko", ikon: "🔮", ringkas: "jatuhkan bola, pilih risiko" };
