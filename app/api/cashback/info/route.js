import { NextResponse } from "next/server";
import { infoCashbackUser } from "@/lib/cashback";

export const dynamic = "force-dynamic";

// GET /api/cashback/info?token=…&amount=50000&provider=qris
// Tingkat, kemajuan ke tingkat berikutnya, total cashback, dan (kalau amount diisi) simulasi cashback deposit itu.
export async function GET(req) {
  try {
    const sp = new URL(req.url).searchParams;
    const token = sp.get("token");
    if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });
    const amount = Math.min(100_000_000, Math.max(0, Math.floor(Number(sp.get("amount")) || 0)));
    const provider = String(sp.get("provider") || "qris").slice(0, 20);
    const info = await infoCashbackUser(token, { amount, providerKey: provider });
    if (!info) return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });
    return NextResponse.json(info);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
