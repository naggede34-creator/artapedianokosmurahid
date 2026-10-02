import { resolveApiKey, jsonV1 } from "@/lib/apiKeyAuth";
import { createDepositForToken } from "@/lib/depositOrderService";
import { syncDeposit } from "@/lib/depositService";
import { depositsCol, usersCol } from "@/lib/db";
import { MANUAL_DEPOSIT_KEY } from "@/lib/paymentProviders";

export const dynamic = "force-dynamic";

const ringkas = (d) => ({
  order_id: d.orderId,
  provider: d.provider,
  status: d.status,
  amount: d.amount,
  admin_fee: d.adminFee ?? 0,
  total_amount: d.totalAmount ?? d.amount,
  credited: Boolean(d.credited),
  created_at: d.createdAt || null,
  expired_at: d.expiredAt || null
});

// POST /api/v1/deposit  { amount, provider } — membuat QRIS deposit OTOMATIS (saldo masuk sendiri setelah dibayar).
export async function POST(req) {
  const { user, error } = await resolveApiKey(req, "deposit");
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  if (body.provider === MANUAL_DEPOSIT_KEY) return jsonV1(req, { error: "QRIS manual tidak tersedia lewat API. Lihat GET /v1/deposit/methods." }, { status: 400 });
  const r = await createDepositForToken({ token: user.token, amount: body.amount, provider: body.provider, tanpaRute: true });
  if (!r.ok) return jsonV1(req, { error: r.error }, { status: r.status || 400 });
  const d = r.deposit;
  return jsonV1(req, {
    order_id: d.orderId,
    provider: d.provider,
    status: "pending",
    amount: d.amount,
    admin_fee: d.adminFee ?? 0,
    total_amount: d.totalAmount ?? d.amount,
    qr_string: d.qrString || null,
    qr_image: d.qrImage || null,
    payment_url: d.paymentUrl || null,
    expired_at: d.expiredAt || null
  });
}

// GET /api/v1/deposit?order_id=XXX — status satu deposit (sekaligus memicu pengecekan ke provider & kredit saldo).
// GET /api/v1/deposit — 20 deposit terakhir.
export async function GET(req) {
  const { user, error } = await resolveApiKey(req);
  if (error) return error;
  const orderId = new URL(req.url).searchParams.get("order_id");
  const col = await depositsCol();
  if (orderId) {
    const dep = await col.findOne({ orderId, token: user.token });
    if (!dep) return jsonV1(req, { error: "Deposit not found." }, { status: 404 });
    const hasil = await syncDeposit(dep).catch(() => null);
    const baru = await col.findOne({ orderId, token: user.token });
    const u = await (await usersCol()).findOne({ token: user.token }, { projection: { balance: 1 } });
    return jsonV1(req, { ...ringkas(baru || dep), status: hasil?.status || baru?.status || dep.status, balance: u?.balance ?? 0 });
  }
  const daftar = await col.find({ token: user.token, wallet: { $ne: "game" } }).sort({ createdAt: -1 }).limit(20).toArray();
  return jsonV1(req, { items: daftar.map(ringkas) });
}
