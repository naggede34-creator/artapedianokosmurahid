import { resolveApiKey, jsonV1 } from "@/lib/apiKeyAuth";
import { cancelDepositForToken } from "@/lib/depositOrderService";
import { depositsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/v1/deposit/cancel  { order_id }
//
// Membatalkan tagihan QRIS deposit yang masih pending. Sebelum membatalkan,
// cancelDepositForToken mengecek ke penyedia: kalau ternyata sudah dibayar,
// saldo dikreditkan dan tagihan TIDAK dibatalkan (balasnya 409).
export async function POST(req) {
  const { user, error } = await resolveApiKey(req, "batal");
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const orderId = String(body.order_id ?? body.orderId ?? "").trim();
  if (!orderId) return jsonV1(req, { error: "order_id is required." }, { status: 400 });

  try {
    // Deposit dompet game bukan bagian API ini (GET /v1/deposit juga
    // menyembunyikannya), jadi dianggap tidak ada.
    const col = await depositsCol();
    const dep = await col.findOne({ orderId, token: user.token }, { projection: { wallet: 1 } });
    if (!dep || dep.wallet === "game") return jsonV1(req, { error: "Deposit not found." }, { status: 404 });

    const r = await cancelDepositForToken({ token: user.token, orderId });
    if (!r.ok) {
      return jsonV1(
        req,
        { error: r.error, ...(r.depositStatus ? { status: r.depositStatus } : {}) },
        { status: r.status || 400 }
      );
    }
    return jsonV1(req, {
      success: true,
      order_id: orderId,
      status: r.status || "canceled",
      message: r.message || "Deposit dibatalkan."
    });
  } catch (e) {
    console.error("[v1/deposit/cancel]", e?.message || e);
    return jsonV1(req, { error: "Failed to cancel deposit." }, { status: 500 });
  }
}
