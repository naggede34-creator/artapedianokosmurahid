import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    if (!token) return NextResponse.json({ error: "Token diperlukan." }, { status: 400 });
    const users = await usersCol();
    await users.updateOne({ token }, { $set: { tourDone: true } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[user/tour-done]", err);
    return NextResponse.json({ error: "Gagal." }, { status: 500 });
  }
}
