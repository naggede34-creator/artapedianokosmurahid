import { NextResponse } from "next/server";
import { konversiKeSaldo } from "@/lib/gateway";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { token, amount } = await req.json().catch(() => ({}));
  if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });
  if (!rateLimit(`gwconv:${token}`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu cepat. Tunggu sebentar." }, { status: 429 });
  }
  const r = await konversiKeSaldo({ token, amount });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status || 400 });
  return NextResponse.json({ ok: true, ...r });
}
