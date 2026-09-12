import { NextResponse } from "next/server";
import { depositsCol, usersCol } from "@/lib/db";
import { checkTransaction } from "@/lib/pakasir";
import { sendTelegramNotif, depositSuccessNotif } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id");
    const token = searchParams.get("token");
    if (!orderId || !token) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const deposits = await depositsCol();
    const deposit = await deposits.findOne({ orderId, token });
    if (!deposit) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });

    if (deposit.status !== "completed") {
      try {
        const result = await checkTransaction(
          process.env.PAKASIR_PROJECT,
          process.env.PAKASIR_APIKEY,
          orderId,
          deposit.amount
        );
        const tx = result.transaction || result;
        if (tx.status && tx.status !== deposit.status) {
          await deposits.updateOne({ orderId }, { $set: { status: tx.status } });
          deposit.status = tx.status;
        }
      } catch (e) {
        // biarkan status lama kalau pengecekan gagal, tidak fatal
      }
    }

    if (deposit.status === "completed" && !deposit.credited) {
      const users = await usersCol();
      const updatedUser = await users.findOneAndUpdate(
        { token },
        { $inc: { balance: deposit.amount } },
        { returnDocument: "after" }
      );
      await deposits.updateOne({ orderId }, { $set: { credited: true } });
      deposit.credited = true;
      sendTelegramNotif(
        depositSuccessNotif({ orderId, amount: deposit.amount, token, balance: updatedUser?.balance ?? 0 })
      );
    }

    const user = await (await usersCol()).findOne({ token });

    return NextResponse.json({
      status: deposit.status,
      credited: deposit.credited,
      balance: user?.balance ?? 0
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
