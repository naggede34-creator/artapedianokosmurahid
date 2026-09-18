import { NextResponse } from "next/server";
import { userNotificationsCol, usersCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { target, token, type, title, body: msgBody } = body;

  if (!title || !msgBody) return NextResponse.json({ error: "title dan body wajib diisi." }, { status: 400 });

  const col = await userNotificationsCol();

  if (target === "all") {
    const users = await usersCol();
    const allUsers = await users.find({}, { projection: { token: 1 } }).toArray();
    const docs = allUsers.map((u) => ({
      token: u.token,
      type: type || "promo",
      title,
      body: msgBody,
      read: false,
      createdAt: new Date(),
    }));
    if (docs.length > 0) await col.insertMany(docs);
    return NextResponse.json({ ok: true, sent: docs.length });
  }

  if (target === "single") {
    if (!token) return NextResponse.json({ error: "token user diperlukan." }, { status: 400 });
    await col.insertOne({ token, type: type || "promo", title, body: msgBody, read: false, createdAt: new Date() });
    return NextResponse.json({ ok: true, sent: 1 });
  }

  return NextResponse.json({ error: "target harus 'all' atau 'single'." }, { status: 400 });
}
