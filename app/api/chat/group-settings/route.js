import { NextResponse } from "next/server";
import { chatGroupSettingsCol, chatMessagesCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const DEFAULTS = {
  _id: "config",
  name: "Artapedia Community",
  desc: "Komunitas deposit saldo & beli nomor OTP 🚀",
  photo: null,
  closed: false,
  pinnedMsgId: null,
};

export async function GET(req) {
  try {
    const col = await chatGroupSettingsCol();
    const doc = await col.findOne({ _id: "config" });
    const settings = { ...DEFAULTS, ...(doc || {}) };

    const isAdmin = isAdminRequest(req);
    return NextResponse.json({
      name: settings.name,
      desc: settings.desc,
      photo: settings.photo || null,
      closed: settings.closed || false,
      pinnedMsgId: settings.pinnedMsgId || null,
      isAdmin,
    });
  } catch (err) {
    console.error("[group-settings GET]", err);
    return NextResponse.json({ ...DEFAULTS, isAdmin: false });
  }
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const { action, name, desc, photo, closed } = body;

    const col = await chatGroupSettingsCol();
    const update = {};

    if (action === "tagall") {
      const msgCol = await chatMessagesCol();
      const tagMsg = {
        msgId: crypto.randomUUID(),
        token: null,
        displayName: "Admin",
        message: "📢 @semua — Ada pengumuman penting dari admin!",
        type: "text",
        isSystem: true,
        isAI: false,
        reactions: {},
        pinned: false,
        pinnedBy: null,
        mentions: ["semua"],
        createdAt: new Date(),
        deleted: false,
      };
      await msgCol.insertOne(tagMsg);
      return NextResponse.json({ ok: true, action: "tagall", msgId: tagMsg.msgId });
    }

    if (name !== undefined) update.name = String(name).trim().slice(0, 50) || DEFAULTS.name;
    if (desc !== undefined) update.desc = String(desc).trim().slice(0, 200);
    if (photo !== undefined) update.photo = photo || null;
    if (closed !== undefined) update.closed = Boolean(closed);

    await col.updateOne({ _id: "config" }, { $set: update }, { upsert: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[group-settings POST]", err);
    return NextResponse.json({ error: "Gagal update settings." }, { status: 500 });
  }
}
