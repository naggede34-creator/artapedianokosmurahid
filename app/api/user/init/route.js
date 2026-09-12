import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { generateUserToken } from "@/lib/token";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const users = await usersCol();

    if (body.token) {
      const existing = await users.findOne({ token: body.token });
      if (existing) {
        return NextResponse.json({ token: existing.token, balance: existing.balance });
      }
      return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });
    }

    let token;
    for (let i = 0; i < 5; i++) {
      const candidate = generateUserToken();
      const found = await users.findOne({ token: candidate });
      if (!found) {
        token = candidate;
        break;
      }
    }
    if (!token) throw new Error("Gagal membuat kode akun, coba lagi.");

    await users.insertOne({ token, balance: 0, createdAt: new Date() });
    return NextResponse.json({ token, balance: 0 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
