import { NextResponse } from "next/server";
import { chatGroupSettingsCol, chatMessagesCol } from "@/lib/db";
import { adminSah } from "@/lib/adminAuth";
import { CHAT_DEFAULTS, CHAT_SETTINGS_ID, getChatSettings, chatClosedMessage } from "@/lib/chatSettings";

export const dynamic = "force-dynamic";

const DEFAULTS = { _id: CHAT_SETTINGS_ID, ...CHAT_DEFAULTS };

export async function GET(req) {
  try {
    const settings = await getChatSettings();
    const isAdmin = await adminSah(req);
    return NextResponse.json({
      name: settings.name,
      desc: settings.desc,
      photo: settings.photo || null,
      closed: settings.closed || false,
      closedMsg: chatClosedMessage(settings),
      pinnedMsgId: settings.pinnedMsgId || null,
      isAdmin,
    });
  } catch (err) {
    console.error("[group-settings GET]", err);
    return NextResponse.json({ ...DEFAULTS, isAdmin: false });
  }
}

export async function POST(req) {
  if (!await adminSah(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const { action, name, desc, photo, closed, closedMsg } = body;

    const col = await chatGroupSettingsCol();
    const update = {};

    if (action === "tagall") {
      // Pengumuman masuk ke Grup Umum WEARTA CHAT (penyimpanan baru).
      const { waPesanCol, waRoomCol } = await import("@/lib/db");
      const sekarang = new Date();
      const teks = "📢 @semua — Ada pengumuman penting dari admin!";
      const pesan = {
        msgId: crypto.randomUUID(), roomId: "umum", dari: null, namaDari: "Admin", jenis: "teks", teks, reaksi: {},
        dihapusUntuk: [], readBy: [], deliveredTo: [], bintang: [], createdAt: sekarang
      };
      await (await waPesanCol()).insertOne(pesan);
      await (await waRoomCol()).updateOne({ roomId: "umum" }, { $set: { lastAt: sekarang, lastPreview: { dari: null, jenis: "teks", teks: `Admin: ${teks}`.slice(0, 80), at: sekarang } } }, { upsert: false });
      return NextResponse.json({ ok: true, action: "tagall", msgId: pesan.msgId });
    }

    if (name !== undefined) update.name = String(name).trim().slice(0, 50) || DEFAULTS.name;
    if (desc !== undefined) update.desc = String(desc).trim().slice(0, 200);
    if (photo !== undefined) update.photo = photo || null;
    if (closed !== undefined) update.closed = Boolean(closed);
    if (closedMsg !== undefined) update.closedMsg = String(closedMsg).slice(0, 200);

    await col.updateOne({ _id: CHAT_SETTINGS_ID }, { $set: update }, { upsert: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[group-settings POST]", err);
    return NextResponse.json({ error: "Gagal update settings." }, { status: 500 });
  }
}
