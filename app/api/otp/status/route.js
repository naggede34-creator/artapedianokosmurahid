import { NextResponse } from "next/server";
import { otpOrdersCol } from "@/lib/db";
import { reconcileOtpOrder } from "@/lib/orderReconcile";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id");
    const token = searchParams.get("token");
    if (!orderId || !token) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const orders = await otpOrdersCol();
    const order = await orders.findOne({ orderId, token });
    if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });

    const r = await reconcileOtpOrder(order);

    // Log respons mentah provider tetap disimpan di Vercel Function Logs kalau perlu
    // debug ekstraksi kode (lihat lib/orderReconcile.js untuk logika lengkapnya).

    return NextResponse.json({
      status: r.resolvedStatus,
      otpCode: r.otpCode,
      otpMsg: r.otpMsg,
      phoneNumber: order.phoneNumber,
      serviceName: order.serviceName,
      countryName: order.countryName,
      price: order.price,
      createdAt: order.createdAt,
      refunded: r.refunded ? true : order.refunded || false,
      balance: r.refunded ? r.newBalance : undefined,
      pointsEarned: r.pointsEarned
    });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal memeriksa status pesanan." }, { status: 500 });
  }
}
