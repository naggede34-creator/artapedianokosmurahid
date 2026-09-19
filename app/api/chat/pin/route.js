import { NextResponse } from "next/server";
import { chatMessagesCol, chatGroupSettingsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { msgId, unpin } = await req.json().catch(() => ({}));
    if (!msgId) return NextResponse.json({ error: "msgId diperlukan." }, { status: 400 });

    const col = await chatMessagesCol();
    const settingsCol = await chatGroupSettingsCol();

    if (unpin) {
      await col.updateMany({ pinned: true }, { $set: { pinned: false, pinnedBy: null } });
      await settingsCol.updateOne({ _id: "config" }, { $set: { pinnedMsgId: null } }, { upsert: true });
      return NextResponse.json({ ok: true, pinned: false });
    }

    // Unpin previous
    await col.updateMany({ pinned: true }, { $set: { pinned: false, pinnedBy: null } });
    // Pin new
    await col.updateOne({ msgId }, { $set: { pinned: true, pinnedBy: "admin", pinnedAt: new Date() } });
    await settingsCol.updateOne({ _id: "config" }, { $set: { pinnedMsgId: msgId } }, { upsert: true });

    return NextResponse.json({ ok: true, pinned: true });
  } catch (err) {
    console.error("[chat/pin]", err);
    return NextResponse.json({ error: "Gagal pin pesan." }, { status: 500 });
  }
}
