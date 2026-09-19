import { NextResponse } from "next/server";
import { chatMessagesCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const after = searchParams.get("after");
    const limit = Math.min(80, parseInt(searchParams.get("limit") || "60"));

    const col = await chatMessagesCol();
    const filter = { deleted: { $ne: true } };
    if (after) filter.createdAt = { $gt: new Date(after) };

    const msgs = await col
      .find(filter)
      .sort({ createdAt: after ? 1 : -1 })
      .limit(limit)
      .toArray();

    const result = after ? msgs : [...msgs].reverse();
    return NextResponse.json(
      result.map((m) => ({
        id: m.msgId,
        token: m.token,
        displayName: m.displayName,
        message: m.message || "",
        type: m.type || "text",
        replyTo: m.replyTo || null,
        replyToName: m.replyToName || null,
        replyToPreview: m.replyToPreview || null,
        voiceData: m.voiceData || null,
        stickerCode: m.stickerCode || null,
        isAI: m.isAI || false,
        aiPersona: m.aiPersona || null,
        createdAt: m.createdAt,
      }))
    );
  } catch (err) {
    console.error("[chat/messages GET]", err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, displayName, message, type, replyTo, replyToName, replyToPreview, voiceData, stickerCode } = body;

    if (!token) return NextResponse.json({ error: "Token diperlukan." }, { status: 400 });
    if (!displayName) return NextResponse.json({ error: "Nama tampilan diperlukan." }, { status: 400 });
    if (type === "text" && !String(message || "").trim())
      return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });
    if (type === "voice" && !voiceData)
      return NextResponse.json({ error: "Data suara diperlukan." }, { status: 400 });
    if (type === "sticker" && !stickerCode)
      return NextResponse.json({ error: "Stiker diperlukan." }, { status: 400 });

    const col = await chatMessagesCol();

    const msg = {
      msgId: crypto.randomUUID(),
      token: String(token),
      displayName: String(displayName).trim().slice(0, 24),
      message: type === "text" ? String(message || "").trim().slice(0, 500) : "",
      type: ["text", "sticker", "voice"].includes(type) ? type : "text",
      replyTo: replyTo || null,
      replyToName: replyToName ? String(replyToName).slice(0, 24) : null,
      replyToPreview: replyToPreview ? String(replyToPreview).slice(0, 80) : null,
      voiceData: type === "voice" ? voiceData : null,
      stickerCode: type === "sticker" ? stickerCode : null,
      isAI: false,
      createdAt: new Date(),
      deleted: false,
    };

    await col.insertOne(msg);
    return NextResponse.json({ ok: true, msgId: msg.msgId, createdAt: msg.createdAt });
  } catch (err) {
    console.error("[chat/messages POST]", err);
    return NextResponse.json({ error: "Gagal mengirim pesan." }, { status: 500 });
  }
}
