// API publik untuk merchant: saldo gateway.
//
//   GET /api/gw/v1/balance
//   Header: X-API-Key: apk_xxx
import { NextResponse } from "next/server";
import { akunDariApiKey } from "@/lib/gateway";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const akun = await akunDariApiKey(req.headers.get("x-api-key") || "");
  if (!akun) return NextResponse.json({ success: false, error: "API key tidak valid." }, { status: 401 });
  if (!rateLimit(`gwbal:${akun.token}`, 60, 60_000)) {
    return NextResponse.json({ success: false, error: "Terlalu banyak permintaan." }, { status: 429 });
  }
  return NextResponse.json({
    success: true,
    balance: akun.balance || 0,
    total_masuk: akun.totalMasuk || 0,
    frozen: Boolean(akun.dibekukan)
  });
}
