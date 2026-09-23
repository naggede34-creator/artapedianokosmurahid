// Pembuatan deposit ada di lib/depositOrderService.js supaya web dan bot
// Telegram memakai logika yang sama persis. Route ini hanya pembungkus HTTP:
// rate limit, baca body, terjemahkan hasilnya jadi respons.
import { NextResponse } from "next/server";
import { createDepositForToken } from "@/lib/depositOrderService";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`${ip}:deposit`, 5, 60_000)) {
      return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi dalam 1 menit." }, { status: 429 });
    }

    const { token, amount, provider } = await req.json().catch(() => ({}));
    const result = await createDepositForToken({ token, amount, provider });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json(result.deposit);
  } catch (err) {
    console.error("[deposit/create]", err?.response?.data || err?.message || err);
    return NextResponse.json({ error: "Gagal membuat transaksi deposit. Coba lagi sebentar lagi." }, { status: 500 });
  }
}
