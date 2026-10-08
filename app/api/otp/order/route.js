import { NextResponse } from "next/server";
import { placeOtpOrder, denganWeb } from "@/lib/otpOrderService";
import { rwDariReq } from "@/lib/rwKonteks";

export const dynamic = "force-dynamic";
// Tanpa baris ini, Vercel membunuh fungsinya di sekitar detik ke-10 — sedangkan
// batas waktu panggilan ke provider 20-30 detik. Saat itu terjadi, saldo sudah
// terpotong dan kode pengembaliannya TIDAK PERNAH DIJALANKAN. Itulah keluhan
// "order gagal tapi saldo tetap berkurang".
export const maxDuration = 60;

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  // Web reseller ditentukan SERVER dari host/cookie — bukan dari isi permintaan.
  const web = await rwDariReq(req);
  const result = await placeOtpOrder(denganWeb(body, web));
  if (!result.ok) {
    const { kurang, harga, nominalTopup } = result;
    return NextResponse.json(
      { error: result.error, ...(kurang ? { kurang, harga, nominalTopup } : {}) },
      { status: result.status }
    );
  }
  return NextResponse.json(result.order);
}
