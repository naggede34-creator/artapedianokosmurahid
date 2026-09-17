import { NextResponse } from "next/server";
import { smmOrdersCol } from "@/lib/db";
import { toPublicOrder } from "@/lib/smmService";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });
  const col = await smmOrdersCol();
  const list = await col.find({ token }).sort({ createdAt: -1 }).limit(50).toArray();
  return NextResponse.json({ items: list.map(toPublicOrder) });
}
