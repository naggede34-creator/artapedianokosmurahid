import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { pantauStok, batalkanPantau, daftarPantau } from "@/lib/stokWatch";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

async function akunAda(token) {
  if (!token || typeof token !== "string") return false;
  return Boolean(await (await usersCol()).findOne({ token }, { projection: { _id: 1 } }));
}
const ip = (req) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  if (!(await akunAda(token))) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ items: await daftarPantau(token) });
}

export async function POST(req) {
  if (!rateLimit(`${ip(req)}:stok-watch`, 30, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan." }, { status: 429 });
  }
  const b = await req.json().catch(() => ({}));
  if (!(await akunAda(b.token))) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  const r = await pantauStok(b);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

export async function DELETE(req) {
  const b = await req.json().catch(() => ({}));
  if (!(await akunAda(b.token)) || !b.serviceId) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });
  return NextResponse.json(await batalkanPantau(b));
}
