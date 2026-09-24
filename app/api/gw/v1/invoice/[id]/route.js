// API publik untuk merchant: status satu tagihan.
//
//   GET /api/gw/v1/invoice/{invoice_id}
//   Header: X-API-Key: apk_xxx
import { NextResponse } from "next/server";
import { akunDariApiKey, periksaTagihan } from "@/lib/gateway";
import { gatewayInvoicesCol } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const balas = (ok, isi, status = 200) => NextResponse.json({ success: ok, ...isi }, { status });

export async function GET(req, { params }) {
  const akun = await akunDariApiKey(req.headers.get("x-api-key") || "");
  if (!akun) return balas(false, { error: "API key tidak valid." }, 401);
  if (!rateLimit(`gwstat:${akun.token}`, 120, 60_000)) {
    return balas(false, { error: "Terlalu banyak permintaan." }, 429);
  }

  const id = params?.id;
  const col = await gatewayInvoicesCol();
  const ada = await col.findOne({ invoiceId: id });
  // Milik merchant lain diperlakukan sama dengan tidak ada. Membedakannya
  // membuat API ini bisa dipakai memeriksa nomor tagihan orang lain.
  if (!ada || ada.token !== akun.token) return balas(false, { error: "Tagihan tidak ditemukan." }, 404);

  const r = await periksaTagihan(id);
  if (!r.ok) return balas(false, { error: r.error }, r.status || 400);

  const i = r.invoice;
  return balas(true, {
    invoice_id: i.invoiceId,
    amount: i.amount,
    fee: i.biaya,
    net_amount: i.diterima,
    status: i.status,
    merchant_ref: i.merchantRef,
    qr_string: i.qrString,
    payment_url: i.paymentUrl,
    paid_at: i.paidAt,
    expired_at: i.expiredAt,
    created_at: i.createdAt
  });
}
