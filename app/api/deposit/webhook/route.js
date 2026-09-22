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
// WarungNokos tidak punya webhook deposit; statusnya dicek lewat polling & cron.
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const payload = body?.data || body;
    // Pakasir v2 mengirim txn_id; v1 dan RumahOTP mengirim order_id. Dicari
    // dengan semua kemungkinan itu sekaligus. Isi body-nya tetap tidak dipercaya
    // — statusnya dicek ulang ke provider di bawah.
    const ref = pickField(payload, ["order_id", "orderId", "id", "reference", "trx_id", "trxId"]);
    const txn = pickField(payload, ["txn_id", "txnId"]);
    if (!ref && !txn) return NextResponse.json({ error: "order_id kosong." }, { status: 400 });

    const or = [];
    if (ref) or.push({ orderId: String(ref) }, { providerRef: String(ref) });
    if (txn) or.push({ pakasirTxnId: String(txn) });

    const deposits = await depositsCol();
    const deposit = await deposits.findOne({ $or: or });
    if (!deposit) return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });

    const result = await syncDeposit(deposit);
    return NextResponse.json({ ok: true, status: result.status });
  } catch (err) {
    console.error("[deposit/webhook]", err?.response?.data || err?.message || err);
    return NextResponse.json({ error: "Gagal memproses webhook." }, { status: 500 });
  }
}
