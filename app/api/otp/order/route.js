import { NextResponse } from "next/server";
import { placeOtpOrder } from "@/lib/otpOrderService";

export const dynamic = "force-dynamic";
// Tanpa baris ini, Vercel membunuh fungsinya di sekitar detik ke-10 — sedangkan
// batas waktu panggilan ke provider 20-30 detik. Saat itu terjadi, saldo sudah
// terpotong dan kode pengembaliannya TIDAK PERNAH DIJALANKAN. Itulah keluhan
// "order gagal tapi saldo tetap berkurang".
export const maxDuration = 60;

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const result = await placeOtpOrder(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.order);
}
