import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { detailPengguna } from "@/lib/penggunaAdmin";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) return NextResponse.json({ error: "Kode akun wajib." }, { status: 400 });
  try {
    const d = await detailPengguna(token);
    return d ? NextResponse.json(d, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
  } catch (err) {
    console.error("[admin/pengguna/detail]", err?.message || err);
    return NextResponse.json({ error: "Gagal memuat detail." }, { status: 500 });
  }
}
