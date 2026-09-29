// Denyut ringan untuk cron eksternal (cron-job.org / UptimeRobot, tiap 1 menit).
//
// Vercel Hobby hanya mengizinkan cron 1x/hari, padahal ada pekerjaan yang
// bergantung pada pengecekan rutin: kode OTP yang masuk saat halaman tertutup
// (untuk push/bot), jaminan OTP yang harus mengganti nomor tepat waktu, dan
// pengecekan stok untuk "kabari saya kalau stok ada".
//
//   GET https://domain-kamu.vercel.app/api/cron/tick?secret=ISI_CRON_SECRET
//
// Ringan sengaja: hanya pesanan yang masih hidup (≤ 35 menit) yang disentuh.
import { NextResponse } from "next/server";
import { otpOrdersCol } from "@/lib/db";
import { reconcileOtpOrder } from "@/lib/orderReconcile";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UMUR_MAKS_MS = 35 * 60 * 1000;
const MAKS_PER_DENYUT = 40;

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  if ((req.headers.get("authorization") || "") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

export async function GET(req) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const hasil = { pesanan: 0, otpMasuk: 0, refund: 0, diganti: 0, galat: [] };
  try {
    const orders = await otpOrdersCol();
    const hidup = await orders
      .find({ status: "pending", refunded: { $ne: true }, createdAt: { $gte: new Date(Date.now() - UMUR_MAKS_MS) } })
      .sort({ createdAt: 1 })
      .limit(MAKS_PER_DENYUT)
      .toArray();
    for (const order of hidup) {
      try {
        const r = await reconcileOtpOrder(order);
        hasil.pesanan++;
        if (r.otpCode && !order.otpCode) hasil.otpMasuk++;
        if (r.refunded) hasil.refund++;
        if (r.gantiKe) hasil.diganti++;
      } catch (err) {
        hasil.galat.push(`${order.orderId}: ${err?.message || err}`);
      }
    }
  } catch (err) {
    hasil.galat.push(`query: ${err?.message || err}`);
  }
  return NextResponse.json({ ok: true, ...hasil });
}
