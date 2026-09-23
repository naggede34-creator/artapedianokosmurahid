// Logika inti program loyalitas.
// - Poin didapat dari transaksi OTP yang SUKSES (status "done"), dihitung dari
//   nilai transaksi itu sendiri, supaya konsisten dengan "totalSpent" yang juga
//   dipakai untuk badge — bukan dari deposit (deposit dapat cashback, bukan poin).
// - Cashback didapat langsung tiap deposit berhasil dikreditkan.
// - Badge (Bronze/Silver/Gold) dihitung dari total nominal transaksi OTP sukses
//   sepanjang waktu (field "totalSpent" di dokumen user), bukan dari saldo atau
//   dari deposit, supaya badge benar-benar mencerminkan seberapa aktif user beli.
import { usersCol } from "@/lib/db";
import { getSettings, cashbackPercentFor } from "@/lib/settings";
import { ambilPet, petCashbackBonus } from "@/lib/pet";

export function resolveBadge(totalSpent, thresholds) {
  const spent = Number(totalSpent) || 0;
  const t = thresholds || {};
  if (t.gold && spent >= t.gold) return { key: "gold", name: "Gold", icon: "🥇" };
  if (t.silver && spent >= t.silver) return { key: "silver", name: "Silver", icon: "🥈" };
  return { key: "bronze", name: "Bronze", icon: "🥉" };
}

// Info progres ke badge berikutnya, atau null kalau sudah di badge tertinggi.
export function nextBadgeInfo(totalSpent, thresholds) {
  const spent = Number(totalSpent) || 0;
  const t = thresholds || {};
  if (t.silver && spent < t.silver) {
    return { name: "Silver", icon: "🥈", target: t.silver, remaining: Math.max(0, t.silver - spent) };
  }
  if (t.gold && spent < t.gold) {
    return { name: "Gold", icon: "🥇", target: t.gold, remaining: Math.max(0, t.gold - spent) };
  }
  return null;
}

export function calcPoints(amount, pointsPerRupiah) {
  const amt = Number(amount) || 0;
  const rate = Number(pointsPerRupiah) || 0;
  return Math.floor((amt / 1000) * rate);
}

export function calcCashback(amount, percent) {
  const amt = Number(amount) || 0;
  const pct = Number(percent) || 0;
  if (pct <= 0) return 0;
  return Math.floor((amt * pct) / 100);
}

// Dipanggil sekali per pesanan OTP, tepat saat pertama kali statusnya jadi "done".
// Pemanggil bertanggung jawab memastikan ini tidak dipanggil dobel (lihat flag
// "pointsAwarded" di otp_orders yang diklaim atomik sebelum fungsi ini dipanggil).
export async function awardTransactionPoints(token, amount) {
  const settings = await getSettings();
  const points = calcPoints(amount, settings.loyalty.pointsPerRupiah);
  if (points <= 0) return { points: 0 };
  const users = await usersCol();
  await users.updateOne({ token }, { $inc: { points, totalSpent: Number(amount) || 0 } });
  return { points };
}

// Dipanggil tepat saat deposit pertama kali dikreditkan ke saldo (credited: false -> true).
//
// providerKey menentukan persennya: deposit manual boleh punya cashback sendiri
// yang lebih besar, sebagai ganti kerepotan menunggu dicek admin.
export async function awardDepositCashback(token, amount, providerKey) {
  const settings = await getSettings();

  // Level pet menambah persen cashback. Dihitung dari data pet di database,
  // bukan dari angka yang dikirim halaman — halaman pet menampilkan bonusnya,
  // tapi yang menentukan berapa yang dibayar selalu server.
  //
  // Batas maksimumnya ada di petCashbackBonus. Kalau suatu saat ada kesalahan
  // isi di pengaturan, yang terjadi adalah bonus mentok di batas itu, bukan
  // cashback puluhan persen yang baru ketahuan setelah uangnya keluar.
  let bonusPet = 0;
  try {
    const pet = await ambilPet(token, settings);
    bonusPet = petCashbackBonus(pet, settings);
  } catch (err) {
    // Pet gagal dibaca bukan alasan untuk menggagalkan cashback pokoknya.
    console.error("[loyalty] gagal membaca pet:", err?.message || err);
  }

  const persen = cashbackPercentFor(settings, providerKey) + bonusPet;
  const cashback = calcCashback(amount, persen);
  if (cashback <= 0) return 0;
  const users = await usersCol();
  await users.updateOne({ token }, { $inc: { balance: cashback, cashbackTotal: cashback } });
  return cashback;
}

// Poin sempat ditulis ke DUA tempat berbeda: `points` (dipakai beli nokos,
// check-in, roda, gosok kartu, dan semua pembacaan) dan `loyalty.points`
// (dipakai Misi dan Mystery Box). Akibatnya poin dari Misi dan Mystery Box
// masuk ke field yang tidak pernah dibaca siapa pun — user "sudah dapat poin"
// tapi angkanya tidak pernah bertambah.
//
// Penulisnya sudah disatukan ke `points`. Fungsi ini memindahkan sisa poin
// yang terlanjur tersimpan di tempat lama, supaya tidak ada yang kehilangan
// apa yang sudah dia kumpulkan.
//
// Dijalankan sebagai satu update atomik, bukan baca-lalu-tulis: dua permintaan
// yang datang bersamaan tidak boleh menjumlahkan poin yang sama dua kali.
export async function mergeLegacyPoints(token) {
  if (!token) return;
  try {
    const users = await usersCol();
    await users.updateOne(
      { token, "loyalty.points": { $gt: 0 } },
      [
        { $set: { points: { $add: [{ $ifNull: ["$points", 0] }, { $ifNull: ["$loyalty.points", 0] }] } } },
        { $unset: "loyalty.points" }
      ]
    );
  } catch (err) {
    // Gagal memindahkan tidak boleh menggagalkan halamannya — poinnya tetap
    // ada di tempat lama dan bisa dipindahkan lagi di kunjungan berikutnya.
    console.error("[loyalty] gagal memindahkan poin lama:", err?.message || err);
  }
}
