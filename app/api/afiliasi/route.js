import { NextResponse } from "next/server";
import { statusAfiliasi, ajukanKreator } from "@/lib/afiliasi";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const ip = (req) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token diperlukan." }, { status: 400 });
  const s = await statusAfiliasi(token);
  if (!s) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  return NextResponse.json(s);
}

export async function POST(req) {
  if (!rateLimit(`${ip(req)}:afiliasi`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan." }, { status: 429 });
  }
  const b = await req.json().catch(() => ({}));
  if (!b.token) return NextResponse.json({ error: "Token diperlukan." }, { status: 400 });
  const r = await ajukanKreator({ token: b.token, channel: b.channel, catatan: b.catatan });
  return NextResponse.json(r.ok ? { ok: true } : { error: r.alasan }, { status: r.ok ? 200 : 400 });
}
