// Pembatalan + refund ada di lib/otpOrderService.js supaya web dan bot Telegram
// memakai jalur yang sama persis. Jalur refund tidak boleh ada dua.
import { NextResponse } from "next/server";
import { cancelOtpOrder } from "@/lib/otpOrderService";

export async function POST(req) {
  try {
    const { token, orderId } = await req.json().catch(() => ({}));
    const r = await cancelOtpOrder({ token, orderId });

    if (!r.ok) {
      return NextResponse.json(
        {
          error: r.error,
          ...(r.remainingMs ? { remainingMs: r.remainingMs } : {}),
          ...(r.otpCode ? { otpCode: r.otpCode } : {}),
          ...(r.orderStatus ? { status: r.orderStatus } : {})
        },
        { status: r.status }
      );
    }

    return NextResponse.json({ ok: true, balance: r.balance, message: r.message });
  } catch (err) {
    console.error("[otp/cancel]", err?.response?.data || err?.message || err);
    return NextResponse.json({ error: "Gagal membatalkan pesanan. Coba lagi atau hubungi admin." }, { status: 500 });
  }
}
