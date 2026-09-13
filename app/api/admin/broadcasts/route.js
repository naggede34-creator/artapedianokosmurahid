import { NextResponse } from "next/server";
import { broadcastsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";
import { sendTelegramNotif, broadcastCreatedNotif } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const col = await broadcastsCol();
  const list = await col.find({}).sort({ createdAt: -1 }).limit(50).toArray();
  return NextResponse.json({
    items: list.map((b) => ({
      id: b._id.toString(),
      message: b.message,
      active: b.active !== false,
      createdAt: b.createdAt
    }))
  });
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const message = String(body.message || "").trim().slice(0, 240);
    if (!message) return NextResponse.json({ error: "Isi broadcast wajib diisi." }, { status: 400 });

    const col = await broadcastsCol();
    const doc = { message, active: true, createdAt: new Date() };
    const result = await col.insertOne(doc);

    sendTelegramNotif(broadcastCreatedNotif({ message }));

    return NextResponse.json({ id: result.insertedId.toString(), message, active: true, createdAt: doc.createdAt });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengirim broadcast." }, { status: 500 });
  }
}
