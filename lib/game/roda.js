// Roda Hoki — putar roda, hadiah menurut irisan tempat jarum berhenti. Tiga tingkat risiko.
//
// Tiap irisan berpeluang sama (1/jumlah irisan). Komposisi irisan tetap sehingga RTP tepat 96,0% (bukan perkiraan):
//   rendah (20 irisan): 6×0, 8×1,2, 4×1,5, 2×1,8                        → Σ = 19,2  → 19,2/20 = 0,96
//   sedang (30 irisan): 15×0, 8×1,5, 4×2, 2×3, 1×2,8                    → Σ = 28,8  → 28,8/30 = 0,96
//   tinggi (40 irisan): 30×0, 4×1,5, 2×2, 2×3, 1×5, 1×17,4              → Σ = 38,4  → 38,4/40 = 0,96
export const RTP_TARGET = 0.96;
export const RISIKO = ["rendah", "sedang", "tinggi"];

export const info = { kode: "roda", nama: "Roda Hoki", ikon: "🎡", ringkas: "putar roda, hingga ×17,4" };

const KOMPOSISI = {
  rendah: [[0, 6], [1.2, 8], [1.5, 4], [1.8, 2]],
  sedang: [[0, 15], [1.5, 8], [2, 4], [3, 2], [2.8, 1]],
  tinggi: [[0, 30], [1.5, 4], [2, 2], [3, 2], [5, 1], [17.4, 1]]
};

/** Urutan irisan di roda: zero dan hadiah disebar rata dengan langkah yang saling prima dengan jumlah irisan. */
function susun(komposisi) {
  const daftar = [];
  for (const [m, n] of komposisi) for (let i = 0; i < n; i++) daftar.push(m);
  const N = daftar.length;
  // urutkan: nol di tengah, hadiah besar dipisahkan; lalu sebar dengan langkah ko-prima
  const urut = [...daftar].sort((a, b) => b - a);
  let langkah = Math.round(N * 0.382) | 1;
  const fpb = (a, b) => (b ? fpb(b, a % b) : a);
  while (fpb(langkah, N) !== 1) langkah += 2;
  const hasil = new Array(N);
  for (let i = 0; i < N; i++) hasil[(i * langkah) % N] = urut[i];
  return hasil;
}

const RODA = Object.fromEntries(RISIKO.map((r) => [r, susun(KOMPOSISI[r])]));

export const irisan = (risiko) => RODA[risiko] || null;
export const rtp = (risiko) => RODA[risiko].reduce((s, m) => s + m, 0) / RODA[risiko].length;
export const semuaRoda = () => RODA;

/** Satu putaran. `rng()` ∈ [0,1). */
export function putar(risiko, rng) {
  const r = RODA[risiko];
  if (!r) return null;
  const idx = Math.floor(rng() * r.length);
  return { risiko, idx, pengali: r[idx] };
}
