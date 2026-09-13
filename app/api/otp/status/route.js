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

    // Log respons mentah dari RumahOTP supaya kalau ekstraksi kode masih meleset,
    // bentuk field aslinya kelihatan di Vercel Function Logs (cek log "[otp/status] raw:").
    console.log("[otp/status] raw:", JSON.stringify(data));

    // Coba beberapa kemungkinan nama field kode OTP dari provider (nama field API
    // pihak ketiga tidak selalu konsisten/didokumentasikan), lalu fallback ekstrak
    // angka dari teks SMS kalau field kode dedicated tidak ada.
    function extractCode(d) {
      if (!d) return null;
      const directFields = ["otp_code", "code", "sms_code", "otpCode", "full_sms", "verification_code"];
      for (const f of directFields) {
        if (d[f] !== undefined && d[f] !== null && String(d[f]).trim() !== "") return String(d[f]).trim();
      }
      const textFields = ["sms", "message", "sms_text", "full_sms_text", "text"];
      for (const f of textFields) {
        const text = d[f];
        if (typeof text === "string" && text.trim()) {
          const match = text.match(/\b\d{3,8}\b/);
          if (match) return match[0];
        }
      }
      return null;
    }

    const extractedCode = extractCode(data);
    const newOtpCode = extractedCode || order.otpCode;
    const otpJustArrived = !order.otpCode && !!newOtpCode;

    // Status "done" HANYA kalau kode OTP-nya beneran ketemu — jangan ikut-ikutan
    // status mentah dari provider (mis. "success"/"completed") kalau kodenya sendiri
    // belum berhasil terbaca, supaya tidak muncul "Selesai" dengan kolom kode kosong.
    // Status terminal lain dari provider (dibatalkan/kedaluwarsa) tetap dihormati.
    const providerStatus = data?.status;
    const knownTerminal = ["canceled", "cancelled", "expired", "refund", "refunded"];
    let resolvedStatus = order.status;
    if (newOtpCode) {
      resolvedStatus = "done";
    } else if (providerStatus && knownTerminal.includes(String(providerStatus).toLowerCase())) {
      resolvedStatus = String(providerStatus).toLowerCase();
    }

    if (data) {
      await orders.updateOne(
        { orderId },
        { $set: { status: resolvedStatus, otpCode: newOtpCode, otpMsg: data.otp_msg || data.sms || order.otpMsg } }
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
      otpCode: newOtpCode,
      otpMsg: data?.otp_msg || data?.sms || order.otpMsg,
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
