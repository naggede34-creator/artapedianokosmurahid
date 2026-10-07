// Satu-satunya tempat yang boleh:
//   1. menanyakan status deposit ke provider (WarungNokos / Pakasir / RumahOTP /
//      Atlantic; deposit manual tidak punya provider dan diputuskan admin), dan
//   2. mengkreditkan saldo user + cashback + bonus referral + notif.
// Dipakai oleh /api/deposit/status (polling browser), /api/deposit/webhook, dan cron,
// supaya ketiganya berperilaku sama persis (dulu bonus referral cuma cair lewat webhook).
import { depositsCol, usersCol } from "@/lib/db";
import { kabariPemilikBot, botResellerSekarang } from "@/lib/kirimReseller";
import { resellerDepositNotif } from "@/lib/resellerNotif";
import {
  getTransactionStatus,
  checkTransactionV1,
  normalizePakasirTransaction,
  normalizePakasirStatus
} from "@/lib/pakasir";
import { checkDeposit } from "@/lib/rumahotp";
import { getWarungNokosDepositStatus, WARUNGNOKOS_DEPOSIT_KEY } from "@/lib/warungnokos";
import { getAtlanticDepositStatus, normalizeAtlanticStatus } from "@/lib/atlantic";
import { cekDepositAustin, normalisasiStatusAustin } from "@/lib/austinpay";
import { awardDepositCashback } from "@/lib/cashback";
import { logBalance, logBalanceOnce, setLedgerBalanceAfter } from "@/lib/ledger";
import { providerName, MANUAL_DEPOSIT_KEY } from "@/lib/paymentProviders";
import { getSettings, depositDisplay } from "@/lib/settings";
import {
  depositSuccessNotif,
  depositSuccessPublicNotif,
  depositCanceledNotif,
  depositCanceledPublicNotif,
  referralDitahanNotif
} from "@/lib/telegram";
import { umumkan } from "@/lib/notifyHub";
import { notifyBotUser, depositDoneText } from "@/lib/shopBot";
import { cfg } from "@/lib/config";
import { kirimPushCepat } from "@/lib/webPush";
import { nilaiBonus, tahanBonus, cairkanBonusReferral, cairkanBonusJaringan } from "@/lib/referralGuard";

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
    // Deposit manual tidak punya provider untuk ditanya — yang memutuskan lunas
    // atau tidak adalah admin, lewat /api/admin/deposits. Statusnya sendiri
    // yang dikembalikan supaya aturan kedaluwarsa di syncDeposit tetap jalan
    // untuk yang belum dibayar, tanpa pernah menimpa yang sedang dicek admin.
    if (deposit.provider === MANUAL_DEPOSIT_KEY) return deposit.status || "pending";
    if (deposit.provider === "qrisfast") {
      const d = await cekDepositAustin(deposit.providerRef || deposit.orderId);
      return normalisasiStatusAustin(d.status);
    }
    if (deposit.provider === "atlantic") {
      const data = await getAtlanticDepositStatus(deposit.providerRef || deposit.orderId);
      return normalizeAtlanticStatus(data.status);
    }
    if (deposit.provider === WARUNGNOKOS_DEPOSIT_KEY) {
      const data = await getWarungNokosDepositStatus(deposit.providerRef || deposit.orderId);
      return data.status;
    }
    if (deposit.provider === "rumahotp") {
      const result = await checkDeposit((await cfg("RUMAHOTP_APIKEY")), deposit.providerRef || deposit.orderId);
      const data = result?.data || result;
      return normalizeGenericStatus(pickField(data, ["status"]));
    }
    // Pakasir v2 mengecek status lewat txn_id. Deposit lama yang dibuat sebelum
    // migrasi tidak punya txn_id, jadi tetap dilayani endpoint v1 sampai Pakasir
    // mematikannya (20 Oktober 2026).
    if (deposit.pakasirTxnId) {
      const data = await getTransactionStatus(
        (await cfg("PAKASIR_PROJECT")),
        (await cfg("PAKASIR_APIKEY")),
        deposit.pakasirTxnId
      );
      return normalizePakasirStatus(data?.status);
    }

    const result = await checkTransactionV1(
      (await cfg("PAKASIR_PROJECT")),
      (await cfg("PAKASIR_APIKEY")),
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
          umumkan({
            jenis: "deposit_batal",
            admin: depositCanceledNotif({
              orderId: deposit.orderId,
              provider: deposit.provider,
              amount: deposit.amount,
              token: deposit.token,
              name: u?.name,
              reason: "expired"
            }),
            publik: depositCanceledPublicNotif({
              provider: deposit.provider,
              amount: deposit.amount,
              reason: "expired"
            })
          });
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

  // Mutasi dicatat DULU, saldo ditambah SESUDAHNYA.
  //
  // Urutan ini yang membuat indeks unik di balance_logs berguna sebagai
  // pencegah, bukan cuma pendeteksi: percobaan kredit kedua untuk transaksi
  // yang sama ditolak database di baris ini, dan berhenti sebelum menyentuh
  // saldo. Kalau urutannya dibalik — saldo dulu, catat kemudian — saldonya
  // sudah terlanjur berlipat saat duplikatnya ketahuan.
  const catatan = await logBalanceOnce({
    token: deposit.token,
    type: "deposit",
    amount,
    // Nama metode mengikuti pengaturan admin supaya mutasi saldo user memakai
    // istilah yang sama dengan yang dia lihat di halaman deposit.
    title: `Deposit ${await depositLabel(deposit.provider)}`,
    ref: deposit.orderId
  });
  if (!catatan.ok) {
    if (catatan.duplikat) {
      console.error(`[deposit] ${deposit.orderId} sudah pernah dikreditkan — kredit kedua dibatalkan.`);
    }
    return null;
  }

  const updatedUser = await users.findOneAndUpdate(
    { token: deposit.token },
    { $inc: { balance: amount, depositBalance: amount, depositTotal: amount, depositCount: 1 } },
    { returnDocument: "after" }
  );
  if (!updatedUser) {
    console.error(`[deposit] user ${deposit.token} tidak ditemukan saat kredit ${deposit.orderId}`);
    return null;
  }
  await setLedgerBalanceAfter(catatan.id, updatedUser.balance);

  // Cashback loyalitas
  const cashback = await awardDepositCashback(deposit.token, amount, deposit.provider);
  if (cashback > 0) {
    const u = await users.findOne({ token: deposit.token }, { projection: { balance: 1 } });
    await logBalance({ token: deposit.token, type: "cashback", amount: cashback, balanceAfter: u?.balance, ref: deposit.orderId });
  }

  // Bonus undang teman: sekali saja, saat user yang diundang deposit pertama kali
  // yang cukup besar. Lewat penjaga anti-farming (lib/referralGuard.js): yang
  // mencurigakan ditahan untuk ditinjau admin, bukan dicairkan otomatis.
  let referralBonus = 0;
  if (updatedUser.referredBy && !updatedUser.referralBonusGiven) {
    const pengundang = await users.findOne({ token: updatedUser.referredBy });
    const putusan = pengundang
      ? await nilaiBonus({ invited: updatedUser, referrer: pengundang, amount })
      : { aksi: "tidak", bonus: 0, alasan: ["pengundang tidak ditemukan"] };
    if (putusan.aksi !== "tidak") {
      // Klaim "deposit pertama" HANYA setelah diputuskan bonusnya berlaku:
      // deposit kecil tidak menghabiskan jatah.
      const firstTime = await users.findOneAndUpdate(
        { token: deposit.token, referralBonusGiven: { $ne: true } },
        { $set: { referralBonusGiven: true } }
      );
      if (firstTime) {
        if (putusan.aksi === "tahan") {
          const tercatat = await tahanBonus({
            invited: updatedUser,
            referrer: pengundang,
            amount,
            bonus: putusan.bonus,
            alasan: putusan.alasan,
            depositOrderId: deposit.orderId
          });
          if (tercatat) {
            umumkan({
              admin: referralDitahanNotif({
                referrerToken: pengundang.token,
                invitedToken: deposit.token,
                bonus: putusan.bonus,
                amount,
                alasan: putusan.alasan
              })
            }).catch(() => {});
          }
        } else {
          referralBonus = putusan.aksi === "cair" ? putusan.bonus : 0;
          await cairkanBonusReferral({
            referrerToken: pengundang.token,
            invitedToken: deposit.token,
            bonus: referralBonus,
            amount,
            ref: deposit.orderId
          });
          // Level 2 (opsional, REFERRAL_L2_PERSEN): pengundang dari pengundang ikut kecipratan.
          if (referralBonus > 0) await cairkanBonusJaringan({ referrer: pengundang, invitedToken: deposit.token, bonusL1: referralBonus, ref: deposit.orderId });
        }
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
  // Salinan ringkas ke channel, lalu dipin. Versi ini tidak memuat rincian
  // saldo maupun nama — yang berguna untuk dibaca publik cuma bahwa transaksi
  // berhasil dan berapa lama prosesnya.
  umumkan({
    jenis: "deposit_sukses",
    admin: successText,
    publik: depositSuccessPublicNotif({
      provider: deposit.provider,
      amount,
      token: deposit.token,
      createdAt: deposit.createdAt,
      depositCount: finalUser?.depositCount
    })
  });

  // Deposit yang datang dari bot reseller: pemilik botnya ikut dikabari.
  // Berjalan dari webhook pembayaran, di luar konteks bot mana pun, jadi
  // botnya dicari dari resellerBotId yang tersimpan saat depositnya dibuat.
  if (deposit.resellerBotId) {
    await (async () => {
      try {
        const dok = await botResellerSekarang({ jenis: "reseller", botId: deposit.resellerBotId });
        if (!dok) return;
        await kabariPemilikBot(
          dok,
          resellerDepositNotif({
            botUsername: dok.username,
            botNama: dok.nama,
            ownerUsername: dok.ownerUsername,
            status: "sukses",
            amount,
            metode: deposit.provider,
            chatId: deposit.token,
            username: null
          })
        );
      } catch (e) {
        console.error("[reseller] notif deposit gagal:", e?.message || e);
      }
    })();
  }

  // Kalau user datang dari bot, kabari langsung di chat-nya.
  // Dikirim dan DITUNGGU: balasan serverless yang keburu selesai membuat notif bot hilang.
  await Promise.allSettled([notifyBotUser(deposit.token, depositDoneText({ amount, balance: finalUser?.balance ?? 0 }))]);
  await kirimPushCepat(deposit.token, {
    judul: "Deposit berhasil 💰",
    isi: `Saldo +Rp${Number(amount).toLocaleString("id-ID")} sudah masuk. Saldo kamu Rp${Number(finalUser?.balance ?? 0).toLocaleString("id-ID")}.`,
    url: "/otp",
    tag: `dep-${deposit.orderId}`
  });

  return { amount, cashback, referralBonus, balance: finalUser?.balance ?? 0 };
}

// ─────────────────────────── SAPUAN DEPOSIT TERTUNDA ───────────────────────────
// Webhook provider bisa gagal sampai (belum didaftarkan, salah URL, server sedang mati) dan cron Vercel
// Hobby hanya sehari sekali, sehingga deposit yang dibayar lewat BOT (tanpa halaman web yang membuka
// polling) bisa menggantung "tidak masuk" padahal uangnya sudah diterima. Sapuan ini menanyakan status
// ke provider untuk deposit yang masih menggantung lalu mengkreditkannya lewat syncDeposit (aman dipanggil
// berulang). Dipanggil dari cron /api/cron/tick, dari aktivitas bot, dan dari lalu lintas web biasa.
let sapuBerjalan = false;
const sapuTerakhir = new Map(); // kunci → waktu, untuk membatasi sapuan yang sama berturut-turut

/**
 * @param token   hanya deposit milik token ini (sapuan ringan saat user aktif)
 * @param jeda    jarak minimal (ms) antar sapuan dengan kunci yang sama pada instance ini
 */
export async function sapuDepositTertunda({ maks = 20, umurMs = 3 * 60 * 60 * 1000, token = null, jeda = 0, anggaranMs = 25000 } = {}) {
  const kunci = token || "*";
  const kini = Date.now();
  if (jeda && kini - (sapuTerakhir.get(kunci) || 0) < jeda) return { dilewati: true };
  if (!token && sapuBerjalan) return { dilewati: true };
  sapuTerakhir.set(kunci, kini);
  if (!token) sapuBerjalan = true;
  const hasil = { dicek: 0, masuk: 0, galat: 0 };
  try {
    const deposits = await depositsCol();
    const q = {
      status: { $in: ["pending", "expired", "canceled"] },
      credited: { $ne: true },
      provider: { $ne: MANUAL_DEPOSIT_KEY },
      createdAt: { $gte: new Date(kini - umurMs) }
    };
    if (token) q.token = token;
    const daftar = await deposits.find(q).sort({ createdAt: -1 }).limit(maks).toArray();
    const mulai = Date.now();
    for (const d of daftar) {
      if (Date.now() - mulai > anggaranMs) break;
      try {
        const r = await syncDeposit(d);
        hasil.dicek++;
        if (r?.credit) hasil.masuk++;
      } catch (e) {
        hasil.galat++;
        console.error("[sapu deposit]", d.orderId, e?.message || e);
      }
    }
  } catch (e) {
    hasil.galat++;
    console.error("[sapu deposit] query:", e?.message || e);
  } finally {
    if (!token) sapuBerjalan = false;
  }
  return hasil;
}
