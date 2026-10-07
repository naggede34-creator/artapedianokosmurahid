import { NextResponse } from "next/server";
import { chatMessagesCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { token, msgId, emoji } = await req.json().catch(() => ({}));
    if (!token || !msgId || !emoji) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const col = await chatMessagesCol();
    const msg = await col.findOne({ msgId });
    if (!msg) return NextResponse.json({ error: "Pesan tidak ditemukan." }, { status: 404 });

    const reactions = msg.reactions || {};
    const emojiKey = String(emoji).slice(0, 8);
    const voters = reactions[emojiKey] || [];
    const idx = voters.indexOf(token);

    if (idx === -1) {
      // Add reaction — remove user from any other emoji first (one reaction per user)
      for (const key of Object.keys(reactions)) {
        reactions[key] = (reactions[key] || []).filter(t => t !== token);
        if (reactions[key].length === 0) delete reactions[key];
      }
      reactions[emojiKey] = [...(reactions[emojiKey] || []), token];
    } else {
      // Toggle off
      reactions[emojiKey] = voters.filter(t => t !== token);
      if (reactions[emojiKey].length === 0) delete reactions[emojiKey];
    }

    await col.updateOne({ msgId }, { $set: { reactions } });
    return NextResponse.json({ ok: true, reactions });
  } catch (err) {
    console.error("[chat/react]", err);
    return NextResponse.json({ error: "Gagal menambah reaksi." }, { status: 500 });
  }
}
