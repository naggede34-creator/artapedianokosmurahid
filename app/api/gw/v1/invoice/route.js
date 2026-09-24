// API publik untuk merchant: buat tagihan QRIS.
//
//   POST /api/gw/v1/invoice
//   Header: X-API-Key: apk_xxx
//   Body:   { "amount": 25000, "ref": "ORDER-123", "callback_url": "https://..." }
import { NextResponse } from "next/server";
import { akunDariApiKey, buatTagihan } from "@/lib/gateway";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Jawaban dibuat seragam supaya sistem merchant bisa memeriksa satu bentuk
// saja, bukan menebak-nebak bentuk error yang berbeda-beda per kasus.
const balas = (ok, isi, status = 200) => NextResponse.json({ success: ok, ...isi }, { status });

export async function POST(req) {
  const apiKey = req.headers.get("x-api-key") || "";
  const akun = await akunDariApiKey(apiKey);
  // Pesannya sengaja sama untuk kunci kosong maupun kunci salah: membedakannya
  // memberi tahu penebak bahwa kunci yang ia coba "ada tapi salah", dan itu
  // mempersempit tebakan berikutnya.
  if (!akun) return balas(false, { error: "API key tidak valid." }, 401);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`gw:${akun.token}`, 60, 60_000) || !rateLimit(`gwip:${ip}`, 120, 60_000)) {
    return balas(false, { error: "Terlalu banyak permintaan. Maksimal 60 tagihan per menit." }, 429);
  }

  const body = await req.json().catch(() => ({}));
  const r = await buatTagihan({
    token: akun.token,
    amount: body.amount,
    merchantRef: body.ref || body.merchant_ref || "",
    callbackUrl: body.callback_url || "",
    sumber: "api"
  });
  if (!r.ok) return balas(false, { error: r.error }, r.status || 400);

  const i = r.invoice;
  return balas(true, {
    invoice_id: i.invoiceId,
    amount: i.amount,
    fee: i.biaya,
    net_amount: i.diterima,
    qr_string: i.qrString,
    payment_url: i.paymentUrl,
    status: i.status,
    merchant_ref: i.merchantRef,
    expired_at: i.expiredAt,
    created_at: i.createdAt
  }, 201);
}
