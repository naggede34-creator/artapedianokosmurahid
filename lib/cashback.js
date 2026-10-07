// Cashback deposit — dihitung SERVER dari data di database, bukan dari angka yang dikirim halaman.
// Rumusnya ada di lib/cashbackHitung.js (murni, dipakai juga oleh halaman & pratinjau admin).
import { usersCol } from "@/lib/db";
import { getSettings, cashbackPercentFor } from "@/lib/settings";
import { hitungCashback, tingkatUser, calcCashback } from "@/lib/cashbackHitung";

export { hitungCashback, tingkatUser, calcCashback };

const dasarPersen = (settings, providerKey) => Math.max(0, cashbackPercentFor(settings, providerKey) - Math.max(0, Number(settings?.eventCashbackBonus) || 0));

/** Dipanggil tepat saat deposit pertama kali dikreditkan ke saldo. Mengembalikan jumlah rupiah cashback. */
export async function awardDepositCashback(token, amount, providerKey) {
  const settings = await getSettings();
  const users = await usersCol();
  const u = await users.findOne({ token }, { projection: { totalSpent: 1 } });
  const hasil = hitungCashback({ amount, dasar: dasarPersen(settings, providerKey), totalSpent: u?.totalSpent || 0, settings });
  if (hasil.cashback <= 0) return 0;
  await users.updateOne({ token }, { $inc: { balance: hasil.cashback, cashbackTotal: hasil.cashback } });
  return hasil.cashback;
}

/** Ringkasan untuk halaman /cashback dan profil. */
export async function infoCashbackUser(token, { amount = 0, providerKey = "qris" } = {}) {
  const settings = await getSettings();
  const users = await usersCol();
  const u = await users.findOne({ token }, { projection: { totalSpent: 1, cashbackTotal: 1 } });
  if (!u) return null;
  const totalSpent = u.totalSpent || 0;
  const t = tingkatUser(totalSpent, settings);
  const sim = amount > 0 ? hitungCashback({ amount, dasar: dasarPersen(settings, providerKey), totalSpent, settings }) : null;
  return {
    totalSpent,
    cashbackTotal: u.cashbackTotal || 0,
    tier: t.tier,
    next: t.next,
    tiers: t.daftar,
    nominal: settings.loyalty.nominal || [],
    dasarPersen: settings.loyalty.cashbackDepositPercent,
    manualPersen: cashbackPercentFor(settings, "manual"),
    event: settings.eventCashbackBonus || 0,
    eventNama: settings.eventNama || "",
    maksPersen: settings.loyalty.maksPersen,
    maksRupiah: settings.loyalty.maksRupiah,
    simulasi: sim
  };
}
