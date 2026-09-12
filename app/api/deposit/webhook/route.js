import { NextResponse } from "next/server";
import { depositsCol, usersCol } from "@/lib/db";
import { checkTransaction } from "@/lib/pakasir";
import { sendTelegramNotif, depositSuccessNotif } from "@/lib/telegram";

// Set URL ini di dashboard Pakasir (Project -> Callback URL):
// https://domainkamu.vercel.app/api/deposit/webhook
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { order_id, status } = body;
    if (!order_id) return NextResponse.json({ error: "order_id kosong." }, { status: 400 });

    const deposits = await depositsCol();
    const deposit = await deposits.findOne({ orderId: order_id });
    if (!deposit) return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });

    // Double-check langsung ke Pakasir supaya webhook palsu tidak bisa mengisi saldo.
    const verify = await checkTransaction(
      process.env.PAKASIR_PROJECT,
      process.env.PAKASIR_APIKEY,
      order_id,
      deposit.amount
    );
    const tx = verify.transaction || verify;
    const verifiedStatus = tx.status || status;

    await deposits.updateOne({ orderId: order_id }, { $set: { status: verifiedStatus } });

    if (verifiedStatus === "completed" && !deposit.credited) {
      const users = await usersCol();
      const updatedUser = await users.findOneAndUpdate(
        { token: deposit.token },
        { $inc: { balance: deposit.amount } },
        { returnDocument: "after" }
      );
      await deposits.updateOne({ orderId: order_id }, { $set: { credited: true } });
      sendTelegramNotif(
        depositSuccessNotif({
          orderId: order_id,
          amount: deposit.amount,
          token: deposit.token,
          balance: updatedUser?.balance ?? 0
        })
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal memproses webhook." }, { status: 500 });
  }
}
