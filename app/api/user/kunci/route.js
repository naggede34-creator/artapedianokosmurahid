import { NextResponse } from "next/server";
import { statusKunci, ubahKunci } from "@/lib/kunciAkun";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };

export async function GET(req) {
  const token = String(new URL(req.url).searchParams.get("token") || "").trim().toUpperCase();
  if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400, headers: H });
  const s = await statusKunci(token);
  return s ? NextResponse.json(s, { headers: H }) : NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404, headers: H });
}

// POST { token, aksi: "kunci" | "minta-buka" | "batal-buka" }
export async function POST(req) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`${ip}:user-kunci`, 20, 60_000)) return NextResponse.json({ error: "Terlalu banyak percobaan." }, { status: 429, headers: H });
  const b = await req.json().catch(() => ({}));
  const token = String(b.token || "").trim().toUpperCase();
  if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400, headers: H });
  const r = await ubahKunci(token, String(b.aksi || ""));
  return r.ok ? NextResponse.json(r.status, { headers: H }) : NextResponse.json({ error: r.alasan }, { status: r.status || 400, headers: H });
}
