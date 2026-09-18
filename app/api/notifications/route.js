import { NextResponse } from "next/server";
import { userNotificationsCol } from "@/lib/db";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token diperlukan." }, { status: 400 });

  const col = await userNotificationsCol();
  const items = await col.find({ token }).sort({ createdAt: -1 }).limit(20).toArray();
  const unread = items.filter((n) => !n.read).length;

  return NextResponse.json({
    items: items.map((n) => ({ ...n, id: n._id.toString(), _id: undefined })),
    unread,
  });
}

export async function POST(req) {
  const body = await req.json();
  if (body.action === "read_all" && body.token) {
    const col = await userNotificationsCol();
    await col.updateMany({ token: body.token, read: false }, { $set: { read: true } });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "read" && body.id && body.token) {
    const col = await userNotificationsCol();
    await col.updateOne({ _id: new ObjectId(body.id), token: body.token }, { $set: { read: true } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Action tidak valid." }, { status: 400 });
}
