// Hitungan cashback yang MURNI (tanpa database) — dipakai server, halaman Cashback, dan pratinjau di dasbor admin
// supaya semuanya menghitung dengan rumus yang persis sama.
//
// Persen akhir = dasar (per metode) + tambahan tingkat (dari total belanja nokos)
//                + tambahan nominal (deposit besar) + bonus event musiman,
// lalu dibatasi maksPersen, dan rupiahnya dibatasi maksRupiah.

export function calcCashback(amount, percent) {
  const amt = Number(amount) || 0;
  const pct = Number(percent) || 0;
  if (pct <= 0 || amt <= 0) return 0;
  return Math.floor((amt * pct) / 100);
}

/** Tingkat user berdasarkan total belanja, plus info tingkat berikutnya (null kalau sudah tertinggi). */
export function tingkatUser(totalSpent, settings) {
  const spent = Math.max(0, Number(totalSpent) || 0);
  const daftar = [...(settings?.loyalty?.tier || [])].sort((a, b) => a.minBelanja - b.minBelanja);
  if (!daftar.length) return { tier: { key: "bronze", nama: "Bronze", ikon: "🥉", minBelanja: 0, tambahan: 0 }, next: null, index: 0, daftar };
  let index = 0;
  daftar.forEach((t, i) => { if (spent >= t.minBelanja) index = i; });
  const sekarang = daftar[index];
  const lanjut = daftar[index + 1] || null;
  return {
    tier: sekarang,
    index,
    daftar,
    next: lanjut ? { ...lanjut, kurang: Math.max(0, lanjut.minBelanja - spent), persen: Math.min(100, Math.round(((spent - sekarang.minBelanja) / Math.max(1, lanjut.minBelanja - sekarang.minBelanja)) * 100)) } : null
  };
}

/**
 * Rincian cashback untuk satu deposit. Murni (tanpa database) supaya bisa dipakai untuk simulasi di halaman,
 * bot, dan pembayaran sungguhan dengan angka yang persis sama.
 */
export function hitungCashback({ amount, dasar, totalSpent, settings }) {
  const l = settings?.loyalty || {};
  const event = Math.max(0, Number(settings?.eventCashbackBonus) || 0);
  dasar = Math.max(0, Number(dasar) || 0);
  const { tier } = tingkatUser(totalSpent, settings);
  const amt = Math.max(0, Number(amount) || 0);
  const braket = [...(l.nominal || [])].filter((n) => amt >= n.min).sort((a, b) => b.min - a.min)[0];
  const rincian = [{ kunci: "dasar", label: "Cashback dasar", persen: dasar }];
  if (tier?.tambahan > 0) rincian.push({ kunci: "tier", label: `Tingkat ${tier.nama}`, persen: tier.tambahan });
  if (braket?.tambahan > 0) rincian.push({ kunci: "nominal", label: `Deposit ≥ Rp${braket.min.toLocaleString("id-ID")}`, persen: braket.tambahan });
  if (event > 0) rincian.push({ kunci: "event", label: settings?.eventNama ? `Event ${settings.eventNama}` : "Event musiman", persen: event });
  const mentah = rincian.reduce((a, r) => a + r.persen, 0);
  const maksPersen = Number(l.maksPersen) > 0 ? Number(l.maksPersen) : 100;
  const persen = Math.round(Math.min(mentah, maksPersen) * 100) / 100;
  let cashback = calcCashback(amt, persen);
  const maksRupiah = Number(l.maksRupiah) || 0;
  const terpotong = maksRupiah > 0 && cashback > maksRupiah;
  if (terpotong) cashback = maksRupiah;
  return { amount: amt, persen, persenMentah: Math.round(mentah * 100) / 100, cashback, rincian, tier, terpotong, dibatasiPersen: mentah > maksPersen };
}

