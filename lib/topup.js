// Nominal top-up yang disarankan ketika saldo kurang untuk membeli sesuatu.
//
// Dibulatkan ke atas ke Rp1.000 supaya angkanya rapi, tidak pernah di bawah
// minimum deposit, dan dijepit ke maksimum. Nol berarti "tidak ada saran"
// (selisih tidak valid).
export function hitungNominalTopup(kurang, min = 2000, max = 1000000) {
  const k = Math.ceil(Number(kurang) || 0);
  if (k <= 0) return 0;
  const bulat = Math.ceil(k / 1000) * 1000;
  return Math.min(Math.max(bulat, Number(min) || 0), Number(max) || bulat);
}
