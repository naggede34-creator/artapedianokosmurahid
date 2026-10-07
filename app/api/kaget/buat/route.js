import { NextResponse } from "next/server";
import { buatKaget } from "@/lib/kaget";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`${ip}:kaget-buat`, 20, 60_000)) return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi dalam 1 menit." }, { status: 429 });
    const b = await req.json().catch(() => ({}));
    if (b.token && !rateLimit(`${String(b.token).slice(0, 40)}:kaget-buat`, 15, 60_000)) return NextResponse.json({ error: "Terlalu cepat. Tunggu sebentar." }, { status: 429 });
    const r = await buatKaget({ token: b.token, total: b.total, jumlah: b.jumlah, mode: b.mode, pesan: b.pesan });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ kid: r.kid, saldo: r.saldo, biaya: r.biaya, berakhirPada: r.expiresAt });
  } catch (err) {
    console.error("[kaget:buat]", err);
    return NextResponse.json({ error: "Gagal membuat Kaget. Coba lagi." }, { status: 500 });
  }
}
