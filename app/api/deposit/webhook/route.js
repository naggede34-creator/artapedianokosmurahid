import { NextResponse } from "next/server";
import { depositsCol, usersCol } from "@/lib/db";
import { checkTransaction } from "@/lib/pakasir";
import { checkDeposit } from "@/lib/rumahotp";
import { sendTelegramNotif, depositSuccessNotif } from "@/lib/telegram";
import { awardDepositCashback } from "@/lib/loyalty";

function pickField(obj, names) {
  for (const n of names) {
    if (obj?.[n] !== undefined && obj[n] !== null && obj[n] !== "") return obj[n];
  }
  return null;
}

function normalizeRumahOtpStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (["success", "completed", "paid", "done"].includes(s)) return "completed";
  if (["cancel", "canceled", "cancelled", "expired", "expire", "failed"].includes(s)) return "canceled";
  return "pending";
}

// Set URL callback ini di dua tempat kalau kedua provider dipakai:
// - Dashboard Pakasir (Project -> Callback URL)
// - Dashboard RumahOTP (Deposit -> Callback URL) — field JSON body webhook mereka
//   belum sempat diverifikasi ke dokumentasi resminya, jadi kode di bawah nyoba
//   beberapa kemungkinan nama field order id yang umum dipakai (order_id/orderId/
//   reference/trx_id) sambil tetap double-check langsung ke RumahOTP sebelum
//   nge-kredit saldo, supaya webhook palsu tidak bisa tembus.
// https://domainkamu.vercel.app/api/deposit/webhook
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    // Body callback RumahOTP dibungkus { success, data: {...} } sama seperti respons
    // create/get_status, dan field ID transaksinya bernama "id" (bukan order_id).
    const payload = body?.data || body;
    const orderId = pickField(payload, ["id", "order_id", "orderId", "reference", "trx_id", "trxId"]);
    const rawStatus = pickField(payload, ["status"]);
    if (!orderId) return NextResponse.json({ error: "order_id kosong." }, { status: 400 });

    const deposits = await depositsCol();
    // orderId dari body webhook bisa jadi order_id internal kita ATAU ID transaksi
    // milik provider (providerRef) tergantung field mana yang mereka echo balik,
    // jadi dicocokkan ke keduanya.
    const deposit = await deposits.findOne({ $or: [{ orderId }, { providerRef: orderId }] });
    if (!deposit) return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });

    // Double-check langsung ke provider terkait supaya webhook palsu tidak bisa mengisi saldo.
    let verifiedStatus;
    if (deposit.provider === "rumahotp") {
      const verify = await checkDeposit(process.env.RUMAHOTP_APIKEY, deposit.providerRef || deposit.orderId);
      const data = verify.data || verify;
      console.log("[deposit/webhook] rumahotp verify raw:", JSON.stringify(data));
      verifiedStatus = normalizeRumahOtpStatus(pickField(data, ["status"]) || rawStatus);
    } else {
      const verify = await checkTransaction(process.env.PAKASIR_PROJECT, process.env.PAKASIR_APIKEY, deposit.orderId, deposit.amount);
      const tx = verify.transaction || verify;
      verifiedStatus = tx.status || rawStatus;
    }

    await deposits.updateOne({ orderId: deposit.orderId }, { $set: { status: verifiedStatus } });

    if (verifiedStatus === "completed" && !deposit.credited) {
      const users = await usersCol();
      const updatedUser = await users.findOneAndUpdate(
        { token: deposit.token },
        { $inc: { balance: deposit.amount } },
        { returnDocument: "after" }
      );
      await deposits.updateOne({ orderId: deposit.orderId }, { $set: { credited: true } });

      const cashback = await awardDepositCashback(deposit.token, deposit.amount);

      // Program undang teman: begitu user yang diundang deposit pertama kali,
      // pengundang dapat bonus persentase dari nominal deposit itu (sekali saja per user).
      if (updatedUser?.referredBy && !updatedUser.referralBonusGiven) {
        const percent = Number(process.env.REFERRAL_BONUS_PERCENT || 0);
        const bonus = percent > 0 ? Math.floor((deposit.amount * percent) / 100) : 0;
        await users.updateOne(
          { token: updatedUser.referredBy },
          { $inc: { balance: bonus, referralEarnings: bonus, referralCount: 1 } }
        );
        await users.updateOne({ token: updatedUser.token }, { $set: { referralBonusGiven: true } });
      }

      const finalUser = cashback > 0 ? await users.findOne({ token: deposit.token }) : updatedUser;
      sendTelegramNotif(
        depositSuccessNotif({
          orderId: deposit.orderId,
          amount: deposit.amount,
          token: deposit.token,
          balance: finalUser?.balance ?? 0,
          cashback
        })
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal memproses webhook." }, { status: 500 });
  }
}
