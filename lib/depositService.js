// Satu-satunya tempat yang boleh:
//   1. menanyakan status deposit ke provider (WarungNokos / Pakasir / RumahOTP), dan
//   2. mengkreditkan saldo user + cashback + bonus referral + notif.
// Dipakai oleh /api/deposit/status (polling browser), /api/deposit/webhook, dan cron,
// supaya ketiganya berperilaku sama persis (dulu bonus referral cuma cair lewat webhook).
import { depositsCol, usersCol } from "@/lib/db";
import {
  getTransactionStatus,
  checkTransactionV1,
  normalizePakasirTransaction,
  normalizePakasirStatus
} from "@/lib/pakasir";
import { checkDeposit } from "@/lib/rumahotp";
import { getWarungNokosDepositStatus, WARUNGNOKOS_DEPOSIT_KEY } from "@/lib/warungnokos";
import { awardDepositCashback } from "@/lib/loyalty";
import { logBalance } from "@/lib/ledger";
import { providerName } from "@/lib/paymentProviders";
import { getSettings, depositDisplay } from "@/lib/settings";
import { sendTelegramNotif, depositSuccessNotif, depositCanceledNotif } from "@/lib/telegram";
import { notifyBotUser, depositDoneText } from "@/lib/shopBot";

// Nama metode dari pengaturan admin; jatuh ke nama bawaan kalau gagal dibaca.
async function depositLabel(key) {
  try {
    return depositDisplay(await getSettings(), key).name;
  } catch {
    return providerName(key);
  }
}

const TERMINAL = ["completed", "canceled", "expired", "failed"];

function pickField(obj, names) {
  for (const n of names) {
    if (obj?.[n] !== undefined && obj[n] !== null && obj[n] !== "") return obj[n];
  }
  return null;
}

export function normalizeGenericStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (["success", "completed", "paid", "done", "settlement"].includes(s)) return "completed";
  if (["expired", "expire"].includes(s)) return "expired";
  if (["failed", "failure", "error"].includes(s)) return "failed";
  if (["cancel", "canceled", "cancelled"].includes(s)) return "canceled";
  return "pending";
}

// Tanya status terbaru ke provider. Mengembalikan status ter-normalisasi atau null
// kalau provider tidak bisa dihubungi.
export async function fetchProviderStatus(deposit) {
  try {
    if (deposit.provider === WARUNGNOKOS_DEPOSIT_KEY) {
      const data = await getWarungNokosDepositStatus(deposit.providerRef || deposit.orderId);
      return data.status;
    }
    if (deposit.provider === "rumahotp") {
      const result = await checkDeposit(process.env.RUMAHOTP_APIKEY, deposit.providerRef || deposit.orderId);
      const data = result?.data || result;
      return normalizeGenericStatus(pickField(data, ["status"]));
    }
    // Pakasir v2 mengecek status lewat txn_id. Deposit lama yang dibuat sebelum
    // migrasi tidak punya txn_id, jadi tetap dilayani endpoint v1 sampai Pakasir
    // mematikannya (20 Oktober 2026).
    if (deposit.pakasirTxnId) {
      const data = await getTransactionStatus(
        process.env.PAKASIR_PROJECT,
        process.env.PAKASIR_APIKEY,
        deposit.pakasirTxnId
      );
      return normalizePakasirStatus(data?.status);
    }

    const result = await checkTransactionV1(
      process.env.PAKASIR_PROJECT,
      process.env.PAKASIR_APIKEY,
      deposit.orderId,
      deposit.amount
    );
    return normalizeGenericStatus(normalizePakasirTransaction(result).status);
  } catch (err) {
    // Kena batas 4 detik/transaksi bukan kegagalan — jangan dicatat sebagai error.
    if (err?.rateLimited) return null;
    console.error(`[deposit] cek status ${deposit.provider} ${deposit.orderId} gagal:`, err?.message || err);
    return null;
  }
}

// Sinkronkan satu deposit dengan provider lalu kreditkan kalau sudah dibayar.
// Aman dipanggil berulang/bersamaan: kredit diklaim atomik lewat flag `credited`.
export async function syncDeposit(deposit, { notifyCancel = false } = {}) {
  const deposits = await depositsCol();
  let status = deposit.status;

  // Deposit yang sudah selesai & terkredit tidak perlu tanya provider lagi.
  if (!(status === "completed" && deposit.credited)) {
    const remote = status === "completed" ? "completed" : await fetchProviderStatus(deposit);
    if (remote) {
      // Aturan update:
      // - "completed" dari provider SELALU menang (user bisa saja tetap bayar walau
      //   sudah menekan batal — saldonya tetap harus masuk).
      // - Status final lain hanya menggantikan "pending".
      // - "pending" dari provider tidak pernah menimpa status final lokal.
      let next = status;
      if (remote === "completed") next = "completed";
      else if (status === "pending" && TERMINAL.includes(remote)) next = remote;

      // QRIS lewat batas waktu tapi provider masih bilang pending → tandai kedaluwarsa
      // (provider tetap dicek lagi oleh cron kalau ternyata dibayar mepet).
      if (next === "pending" && deposit.expiredAt && new Date(deposit.expiredAt).getTime() + 5 * 60 * 1000 < Date.now()) {
        next = "expired";
      }

      if (next !== status) {
        await deposits.updateOne(
          { orderId: deposit.orderId },
          { $set: { status: next, ...(next === "completed" ? { paidAt: new Date() } : {}), updatedAt: new Date() } }
        );
        if (notifyCancel && next === "expired") {
          const users = await usersCol();
          const u = await users.findOne({ token: deposit.token }, { projection: { name: 1 } });
          sendTelegramNotif(
            depositCanceledNotif({
              orderId: deposit.orderId,
              provider: deposit.provider,
              amount: deposit.amount,
              token: deposit.token,
              name: u?.name,
              reason: "expired"
            })
          );
        }
        status = next;
      }
    }
  }

  let credit = null;
  if (status === "completed" && !deposit.credited) {
    credit = await creditDeposit(deposit);
  }

  return { status, credited: status === "completed" ? true : Boolean(deposit.credited), credit };
}

// Kredit saldo untuk deposit yang SUDAH dipastikan lunas.
export async function creditDeposit(deposit) {
  const deposits = await depositsCol();
  const users = await usersCol();

  const claimed = await deposits.findOneAndUpdate(
    { orderId: deposit.orderId, credited: { $ne: true } },
    { $set: { credited: true, status: "completed", creditedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!claimed) return null; // sudah dikredit oleh request lain

  const amount = Number(deposit.amount) || 0;
  const before = await users.findOne({ token: deposit.token }, { projection: { balance: 1 } });
  const updatedUser = await users.findOneAndUpdate(
    { token: deposit.token },
    { $inc: { balance: amount, depositBalance: amount, depositTotal: amount, depositCount: 1 } },
    { returnDocument: "after" }
  );
  if (!updatedUser) {
    console.error(`[deposit] user ${deposit.token} tidak ditemukan saat kredit ${deposit.orderId}`);
    return null;
  }
  await logBalance({
    token: deposit.token,
    type: "deposit",
    amount,
    balanceAfter: updatedUser.balance,
    // Nama metode mengikuti pengaturan admin supaya mutasi saldo user memakai
    // istilah yang sama dengan yang dia lihat di halaman deposit.
    title: `Deposit ${await depositLabel(deposit.provider)}`,
    ref: deposit.orderId
  });

  // Cashback loyalitas
  const cashback = await awardDepositCashback(deposit.token, amount);
  if (cashback > 0) {
    const u = await users.findOne({ token: deposit.token }, { projection: { balance: 1 } });
    await logBalance({ token: deposit.token, type: "cashback", amount: cashback, balanceAfter: u?.balance, ref: deposit.orderId });
  }

  // Bonus undang teman: sekali saja, saat user yang diundang deposit pertama kali.
  let referralBonus = 0;
  if (updatedUser.referredBy) {
    const firstTime = await users.findOneAndUpdate(
      { token: deposit.token, referralBonusGiven: { $ne: true } },
      { $set: { referralBonusGiven: true } }
    );
    if (firstTime) {
      const percent = Number(process.env.REFERRAL_BONUS_PERCENT || 0);
      referralBonus = percent > 0 ? Math.floor((amount * percent) / 100) : 0;
      const referrer = await users.findOneAndUpdate(
        { token: updatedUser.referredBy },
        { $inc: { balance: referralBonus, referralEarnings: referralBonus, referralCount: 1 } },
        { returnDocument: "after" }
      );
      if (referrer && referralBonus > 0) {
        await logBalance({
          token: referrer.token,
          type: "referral",
          amount: referralBonus,
          balanceAfter: referrer.balance,
          title: "Bonus undang teman",
          ref: deposit.orderId
        });
      }
    }
  }

  const finalUser = await users.findOne({ token: deposit.token });
  const successText = depositSuccessNotif({
    orderId: deposit.orderId,
    providerRef: deposit.providerRef,
    provider: deposit.provider,
    amount,
    fee: deposit.adminFee,
    total: deposit.totalAmount,
    token: deposit.token,
    name: finalUser?.name,
    balanceBefore: before?.balance ?? null,
    balance: finalUser?.balance ?? 0,
    cashback,
    referralBonus,
    createdAt: deposit.createdAt,
    depositCount: finalUser?.depositCount
  });
  sendTelegramNotif(successText);
  // Kalau user datang dari bot, kabari langsung di chat-nya.
  notifyBotUser(deposit.token, depositDoneText({ amount, balance: finalUser?.balance ?? 0 }));

  return { amount, cashback, referralBonus, balance: finalUser?.balance ?? 0 };
}
