import { NextResponse } from "next/server";
import { otpOrdersCol } from "@/lib/db";
import { checkOrderStatus } from "@/lib/rumahotp";
import { sendTelegramNotif, otpReceivedNotif } from "@/lib/telegram";

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

    const newOtpCode = data?.otp_code || order.otpCode;
    const otpJustArrived = !order.otpCode && !!newOtpCode;
    // Begitu kode OTP masuk, status transaksi dianggap "done" (dipakai di riwayat),
    // apa pun status mentah dari provider.
    const resolvedStatus = newOtpCode ? "done" : data?.status || order.status;

    if (data) {
      await orders.updateOne(
        { orderId },
        { $set: { status: resolvedStatus, otpCode: newOtpCode, otpMsg: data.otp_msg || order.otpMsg } }
      );
    }

    if (otpJustArrived) {
      sendTelegramNotif(
        otpReceivedNotif({
          orderId: order.orderId,
          serviceName: order.serviceName,
          countryName: order.countryName,
          phoneNumber: order.phoneNumber,
          otpCode: newOtpCode,
          token
        })
      );
    }

    return NextResponse.json({
      status: resolvedStatus,
      otpCode: data?.otp_code || order.otpCode,
      otpMsg: data?.otp_msg || order.otpMsg,
      phoneNumber: order.phoneNumber,
      serviceName: order.serviceName,
      countryName: order.countryName,
      price: order.price,
      createdAt: order.createdAt,
      refunded: order.refunded || false
    });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal memeriksa status pesanan." }, { status: 500 });
  }
}
