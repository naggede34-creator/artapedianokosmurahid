// Logika inti program loyalitas.
// - Poin didapat dari transaksi OTP yang SUKSES (status "done"), dihitung dari
//   nilai transaksi itu sendiri, supaya konsisten dengan "totalSpent" yang juga
//   dipakai untuk badge — bukan dari deposit (deposit dapat cashback, bukan poin).
// - Cashback didapat langsung tiap deposit berhasil dikreditkan.
// - Badge (Bronze/Silver/Gold) dihitung dari total nominal transaksi OTP sukses
//   sepanjang waktu (field "totalSpent" di dokumen user), bukan dari saldo atau
//   dari deposit, supaya badge benar-benar mencerminkan seberapa aktif user beli.
import { usersCol } from "@/lib/db";
import { getSettings } from "@/lib/settings";

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
export async function awardDepositCashback(token, amount) {
  const settings = await getSettings();
  const cashback = calcCashback(amount, settings.loyalty.cashbackDepositPercent);
  if (cashback <= 0) return 0;
  const users = await usersCol();
  await users.updateOne({ token }, { $inc: { balance: cashback, cashbackTotal: cashback } });
  return cashback;
}
