import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const name = String(body.name || "").trim().slice(0, 24);
    if (!token) return NextResponse.json({ error: "Token wajib diisi." }, { status: 400 });

    const users = await usersCol();
    const existing = await users.findOne({ token });
    if (!existing) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });

    await users.updateOne({ token }, { $set: { name: name || null } });

    return NextResponse.json({ token, name: name || null });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menyimpan nama." }, { status: 500 });
  }
}
