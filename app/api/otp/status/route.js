import { NextResponse } from "next/server";
import { otpOrdersCol } from "@/lib/db";
import { checkOrderStatus } from "@/lib/rumahotp";

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

    const result = await checkOrderStatus(process.env.RUMAHOTP_APIKEY, orderId);
    const data = result.data || result;

    if (data) {
      await orders.updateOne(
        { orderId },
        { $set: { status: data.status || order.status, otpCode: data.otp_code || order.otpCode, otpMsg: data.otp_msg || order.otpMsg } }
      );
    }

    return NextResponse.json({
      status: data?.status || order.status,
      otpCode: data?.otp_code || order.otpCode,
      otpMsg: data?.otp_msg || order.otpMsg,
      phoneNumber: order.phoneNumber
    });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal memeriksa status pesanan." }, { status: 500 });
  }
}
