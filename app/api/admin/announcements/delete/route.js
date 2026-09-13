import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { announcementsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { id } = await req.json().catch(() => ({}));
    if (!id) return NextResponse.json({ error: "ID pengumuman wajib diisi." }, { status: 400 });

    const col = await announcementsCol();
    await col.deleteOne({ _id: new ObjectId(id) });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menghapus pengumuman." }, { status: 500 });
  }
}
