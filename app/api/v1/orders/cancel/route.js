import { resolveApiKey, jsonV1 } from "@/lib/apiKeyAuth";
import { cancelOtpOrder } from "@/lib/otpOrderService";

export const dynamic = "force-dynamic";

// POST /api/v1/orders/cancel  { order_id }
//
// Membatalkan pesanan nokos yang belum menerima OTP dan mengembalikan saldo.
// Memakai cancelOtpOrder yang SAMA dengan tombol batal di web dan bot Telegram:
// jalur refund tidak boleh ada dua, karena satu perbedaan kecil syarat sudah
// cukup untuk membuat satu pesanan direfund dua kali.
export async function POST(req) {
  const { user, error } = await resolveApiKey(req, "batal");
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  // Dua penulisan diterima (order_id seperti di /orders/status, orderId seperti
  // di respons /order) supaya developer tidak tersandung salah ketik nama.
  const orderId = String(body.order_id ?? body.orderId ?? "").trim();
  if (!orderId) return jsonV1(req, { error: "order_id is required." }, { status: 400 });

  try {
    // Token selalu dari API key — pesanan akun lain tidak akan ditemukan.
    const r = await cancelOtpOrder({ token: user.token, orderId });
    if (!r.ok) {
      return jsonV1(
        req,
        {
          error: r.error,
          ...(r.remainingMs ? { retry_after: Math.ceil(r.remainingMs / 1000) } : {}),
          ...(r.otpCode ? { otpCode: r.otpCode } : {}),
          ...(r.orderStatus ? { status: r.orderStatus } : {})
        },
        { status: r.status || 400 }
      );
    }
    return jsonV1(req, {
      success: true,
      order_id: orderId,
      status: "canceled",
      refunded: true,
      balance: r.balance ?? null,
      message: r.message || "Pesanan dibatalkan dan saldo dikembalikan."
    });
  } catch (e) {
    console.error("[v1/orders/cancel]", e?.message || e);
    return jsonV1(req, { error: "Failed to cancel order." }, { status: 500 });
  }
}
