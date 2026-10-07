import { NextResponse } from "next/server";
import { usersCol, waProfilCol } from "@/lib/db";
import { lupakanCache } from "@/lib/wa/inti";

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

    // Nama di WEARTA CHAT ikut berubah (satu identitas).
    if (name.length >= 2) {
      try {
        await (await waProfilCol()).updateOne({ token }, { $set: { nama: name } });
        lupakanCache(token);
      } catch {}
    }

    return NextResponse.json({ token, name: name || null });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menyimpan nama." }, { status: 500 });
  }
}
