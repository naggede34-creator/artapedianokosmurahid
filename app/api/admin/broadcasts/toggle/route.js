import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { broadcastsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { id } = await req.json().catch(() => ({}));
    if (!id) return NextResponse.json({ error: "ID broadcast wajib diisi." }, { status: 400 });

    const col = await broadcastsCol();
    const item = await col.findOne({ _id: new ObjectId(id) });
    if (!item) return NextResponse.json({ error: "Broadcast tidak ditemukan." }, { status: 404 });

    const updated = await col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { active: !(item.active !== false) } },
      { returnDocument: "after" }
    );

    return NextResponse.json({ id, active: updated.active });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengubah status broadcast." }, { status: 500 });
  }
}
