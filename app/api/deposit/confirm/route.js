// Konfirmasi pembayaran deposit MANUAL oleh user.
//
// Logikanya ada di lib/depositOrderService.js supaya web dan bot Telegram
// memakai jalur yang sama persis. Route ini cuma pembungkus HTTP: rate limit,
// baca body, terjemahkan hasilnya jadi respons.
import { NextResponse } from "next/server";
import { confirmManualDeposit } from "@/lib/depositOrderService";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`${ip}:deposit-confirm`, 10, 60_000)) {
      return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi sebentar lagi." }, { status: 429 });
    }

    const { token, orderId, proofImage, note } = await req.json().catch(() => ({}));
    const result = await confirmManualDeposit({ token, orderId, proofImage, note });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ ok: true, status: result.status });
  } catch (err) {
    console.error("[deposit/confirm]", err?.message || err);
    return NextResponse.json({ error: "Gagal mengirim konfirmasi. Coba lagi." }, { status: 500 });
  }
}
