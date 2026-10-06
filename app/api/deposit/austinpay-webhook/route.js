// Webhook AustinPay (QRIS FAST). Didaftarkan di dashboard AustinPay → Webhook:
//   https://DOMAIN-KAMU/api/deposit/austinpay-webhook
//
// Keamanan berlapis:
//   1. Tanda tangan HMAC-SHA256 (hex) atas RAW body memakai AUSTINPAY_WEBHOOK_SECRET, dibandingkan timing-safe.
//      Tanpa secret terisi, webhook DITOLAK (deposit tetap lunas lewat pengecekan otomatis & polling).
//   2. Isi body TIDAK dipercaya untuk mengkreditkan: syncDeposit selalu menanyakan ulang statusnya ke AustinPay
//      (GET /api/deposit/check) sebelum saldo bertambah.
//   3. Stempel waktu `sentAt` yang terlalu lama (> 10 menit) ditolak (anti replay).
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { depositsCol, gatewayInvoicesCol } from "@/lib/db";
import { periksaDanKabari } from "@/lib/gatewayBayar";
import { syncDeposit } from "@/lib/depositService";
import { cfg } from "@/lib/config";
import { catatKejadian } from "@/lib/keamanan";

export const dynamic = "force-dynamic";

const aman = (a, b) => {
  const x = Buffer.from(String(a || ""), "hex"), y = Buffer.from(String(b || ""), "hex");
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
};

export async function POST(req) {
  const mentah = await req.text();
  const secret = ((await cfg("AUSTINPAY_WEBHOOK_SECRET")) || "").trim();
  if (!secret) return NextResponse.json({ error: "Webhook belum diaktifkan." }, { status: 401 });
  const tanda = (req.headers.get("x-austinpay-signature") || "").trim().toLowerCase();
  const harap = crypto.createHmac("sha256", secret).update(mentah).digest("hex");
  if (!aman(tanda, harap)) {
    await catatKejadian({ jenis: "webhook-austin-palsu", tingkat: "tinggi", ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null, detail: "Tanda tangan webhook AustinPay tidak cocok" }).catch(() => {});
    return NextResponse.json({ error: "Signature tidak valid." }, { status: 401 });
  }
  let body;
  try { body = JSON.parse(mentah); } catch { return NextResponse.json({ error: "JSON tidak valid." }, { status: 400 }); }
  const sent = Date.parse(body?.sentAt || "");
  if (Number.isFinite(sent) && Math.abs(Date.now() - sent) > 10 * 60_000) return NextResponse.json({ error: "Kedaluwarsa." }, { status: 400 });

  if (body?.event !== "deposit.paid") return NextResponse.json({ ok: true, diabaikan: true });
  const trx = String(body?.data?.transactionId || "").trim();
  if (!trx) return NextResponse.json({ error: "transactionId kosong." }, { status: 400 });
  try {
    const deposit = await (await depositsCol()).findOne({ provider: "qrisfast", providerRef: trx });
    if (!deposit) {
      // Bukan deposit pengguna: mungkin tagihan QRIS Gateway milik merchant.
      const tagihan = await (await gatewayInvoicesCol()).findOne({ provider: "austinpay", txnId: trx });
      if (tagihan) {
        const r = await periksaDanKabari(tagihan.invoiceId);
        return NextResponse.json({ ok: true, gateway: true, status: r.invoice?.status || null });
      }
      return NextResponse.json({ ok: true, tidakDikenal: true }); // 200 agar AustinPay tidak mengulang terus
    }
    const hasil = await syncDeposit(deposit);
    return NextResponse.json({ ok: true, status: hasil.status });
  } catch (err) {
    console.error("[austinpay-webhook]", err?.message || err);
    return NextResponse.json({ error: "Gagal memproses." }, { status: 500 });
  }
}
