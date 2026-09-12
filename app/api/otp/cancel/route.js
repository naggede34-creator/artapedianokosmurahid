import { NextResponse } from "next/server";
import { otpOrdersCol, usersCol } from "@/lib/db";
import { setOrderStatus } from "@/lib/rumahotp";

export async function POST(req) {
  try {
    const { token, orderId } = await req.json();
    if (!token || !orderId) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const orders = await otpOrdersCol();
    const order = await orders.findOne({ orderId, token });
    if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    if (order.refunded) return NextResponse.json({ error: "Pesanan ini sudah dibatalkan sebelumnya." }, { status: 400 });

    const result = await setOrderStatus(process.env.RUMAHOTP_APIKEY, orderId, "cancel");
    const data = result.data || result;

    await orders.updateOne({ orderId }, { $set: { status: "canceled", refunded: true } });
    const users = await usersCol();
    const updated = await users.findOneAndUpdate(
      { token },
      { $inc: { balance: order.price } },
      { returnDocument: "after" }
    );

    return NextResponse.json({ ok: true, balance: updated?.balance, message: data?.message });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal membatalkan pesanan. Coba lagi atau hubungi admin." }, { status: 500 });
  }
}
