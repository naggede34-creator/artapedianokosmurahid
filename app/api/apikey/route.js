import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

function mask(key) {
  if (!key || key.length < 8) return key || null;
  return `${key.slice(0, 4)}${"•".repeat(key.length - 8)}${key.slice(-4)}`;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token wajib." }, { status: 400 });

  const col = await usersCol();
  const user = await col.findOne({ token });
  if (!user) return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });

  return NextResponse.json({ hasKey: !!user.apiKey, maskedKey: user.apiKey ? mask(user.apiKey) : null });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { token } = body;
  if (!token) return NextResponse.json({ error: "token wajib." }, { status: 400 });

  const col = await usersCol();
  const user = await col.findOne({ token });
  if (!user) return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });

  const apiKey = randomBytes(16).toString("hex");
  await col.updateOne({ token }, { $set: { apiKey } });

  return NextResponse.json({ ok: true, apiKey });
}
