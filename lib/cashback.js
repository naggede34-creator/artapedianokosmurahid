// Cashback deposit: persen mengikuti pengaturan admin per metode (deposit manual boleh lebih besar).
// Dipanggil tepat saat deposit pertama kali dikreditkan ke saldo.
import { usersCol } from "@/lib/db";
import { getSettings, cashbackPercentFor } from "@/lib/settings";

export function calcCashback(amount, percent) {
  const amt = Number(amount) || 0;
  const pct = Number(percent) || 0;
  if (pct <= 0) return 0;
  return Math.floor((amt * pct) / 100);
}

export async function awardDepositCashback(token, amount, providerKey) {
  const settings = await getSettings();
  const cashback = calcCashback(amount, cashbackPercentFor(settings, providerKey));
  if (cashback <= 0) return 0;
  const users = await usersCol();
  await users.updateOne({ token }, { $inc: { balance: cashback, cashbackTotal: cashback } });
  return cashback;
}
