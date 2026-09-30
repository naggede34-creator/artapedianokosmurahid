// POIN GAME: satuan saldo game. 2 poin = Rp1.000, jadi 1 poin = Rp500.
// Di database saldo game TETAP disimpan dalam rupiah (`users.saldoGame`), supaya taruhan & hadiah game
// (pengali seperti ×0,34) tidak kehilangan ketelitian karena pembulatan poin. Poin hanya cara MENAMPILKAN
// dan satuan untuk isi/tukar/tarik — yang selalu kelipatan 1 poin (Rp500).
// Berkas ini murni (tanpa impor) supaya aman dipakai di server maupun peramban.
export const POIN_RP = 500;

export const keRupiah = (poin) => Math.round(Number(poin) * POIN_RP);
export const kePoin = (rp) => Number(rp) / POIN_RP;
export const kelipatanPoin = (rp) => Number.isFinite(Number(rp)) && Number(rp) > 0 && Number(rp) % POIN_RP === 0;

/** "24 poin", "1,36 poin" — pecahan (dari hasil game) ditampilkan sampai 2 desimal. */
export function teksPoin(rp, { satuan = true } = {}) {
  const p = kePoin(rp || 0);
  const s = Number.isInteger(p) ? p.toLocaleString("id-ID") : p.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  return satuan ? `${s} poin` : s;
}

export const teksRp = (rp) => `Rp${Number(rp || 0).toLocaleString("id-ID")}`;
/** "24 poin (Rp12.000)" */
export const teksPoinRp = (rp) => `${teksPoin(rp)} (${teksRp(rp)})`;

export const EWALLET = ["DANA", "OVO", "GoPay", "ShopeePay", "LinkAja"];
