import { NextResponse } from "next/server";
import { klaimKaget } from "@/lib/kaget";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`${ip}:kaget-klaim`, 20, 60_000)) return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi dalam 1 menit." }, { status: 429 });
    const b = await req.json().catch(() => ({}));
    const r = await klaimKaget({ token: b.token, kid: String(b.kid || "").toUpperCase() });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status === 202 ? 202 : r.status });
    return NextResponse.json({ jumlah: r.jumlah, sudah: r.sudah, dari: r.dari, pesan: r.pesan, saldo: r.saldo });
  } catch (err) {
    console.error("[kaget:klaim]", err);
    return NextResponse.json({ error: "Gagal mengambil Kaget. Coba lagi." }, { status: 500 });
  }
}
