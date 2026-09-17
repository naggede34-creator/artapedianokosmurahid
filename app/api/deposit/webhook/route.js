import { NextResponse } from "next/server";
import { depositsCol } from "@/lib/db";
import { syncDeposit } from "@/lib/depositService";

function pickField(obj, names) {
  for (const n of names) {
    if (obj?.[n] !== undefined && obj[n] !== null && obj[n] !== "") return obj[n];
  }
  return null;
}

// Callback URL untuk Pakasir & RumahOTP:
//   https://domain-kamu.vercel.app/api/deposit/webhook
// Isi body webhook TIDAK pernah dipercaya begitu saja — status selalu dicek ulang
// langsung ke provider (lihat syncDeposit) sebelum saldo dikreditkan.
// Simuru tidak punya webhook deposit; deposit Simuru dicek lewat polling & cron.
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const payload = body?.data || body;
    const ref = pickField(payload, ["order_id", "orderId", "id", "reference", "trx_id", "trxId"]);
    if (!ref) return NextResponse.json({ error: "order_id kosong." }, { status: 400 });

    const deposits = await depositsCol();
    const deposit = await deposits.findOne({ $or: [{ orderId: String(ref) }, { providerRef: String(ref) }] });
    if (!deposit) return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });

    const result = await syncDeposit(deposit);
    return NextResponse.json({ ok: true, status: result.status });
  } catch (err) {
    console.error("[deposit/webhook]", err?.response?.data || err?.message || err);
    return NextResponse.json({ error: "Gagal memproses webhook." }, { status: 500 });
  }
}
