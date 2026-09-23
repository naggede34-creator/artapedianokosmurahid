import { NextResponse } from "next/server";
import { chatMessagesCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";
import { getChatSettings, chatClosedMessage } from "@/lib/chatSettings";

export const dynamic = "force-dynamic";

function serializeMsg(m) {
  return {
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
    imageData: m.imageData || null,
    pollQuestion: m.pollQuestion || null,
    pollOptions: m.pollOptions || null,
    isAI: m.isAI || false,
    aiPersona: m.aiPersona || null,
    isSystem: m.isSystem || false,
    reactions: m.reactions || {},
    pinned: m.pinned || false,
    pinnedBy: m.pinnedBy || null,
    mentions: m.mentions || [],
    isCommand: m.isCommand || false,
    createdAt: m.createdAt,
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const after = searchParams.get("after");
    const token = searchParams.get("token");
    const limit = Math.min(80, parseInt(searchParams.get("limit") || "60"));

    const col = await chatMessagesCol();
    const filter = { deleted: { $ne: true } };
    // "Hapus untuk saya" menyimpan kode akun peminta di hiddenFor. Disaring di
    // sini, bukan di browser: kalau disaring di browser, pesan yang katanya
    // sudah dihapus tetap terkirim ke sana dan tinggal dibuka lewat alat
    // pengembang — janji "sudah hilang" jadi tidak benar.
    if (token) filter.hiddenFor = { $ne: token };
    if (after) filter.createdAt = { $gt: new Date(after) };

    const msgs = await col
      .find(filter)
      .sort({ createdAt: after ? 1 : -1 })
      .limit(limit)
      .toArray();

    const result = after ? msgs : [...msgs].reverse();
    return NextResponse.json(result.map(serializeMsg));
  } catch (err) {
    console.error("[chat/messages GET]", err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, displayName, message, type, replyTo, replyToName, replyToPreview, voiceData, stickerCode, imageData, pollQuestion, pollOptions, mentions, isCommand } = body;

    if (!token) return NextResponse.json({ error: "Token diperlukan." }, { status: 400 });

    // Penutupan grup ditegakkan DI SINI, bukan cuma dengan mematikan kolom
    // ketik di browser. Kolom yang mati hanya menghalangi yang mengetik lewat
    // halamannya; permintaan langsung ke endpoint ini tetap lolos, dan grup
    // yang "ditutup" masih bisa dimasuki pesan.
    const chat = await getChatSettings();
    if (chat.closed && !isAdminRequest(req)) {
      return NextResponse.json({ error: chatClosedMessage(chat), closed: true }, { status: 403 });
    }
    if (!displayName) return NextResponse.json({ error: "Nama tampilan diperlukan." }, { status: 400 });
    if (type === "text" && !String(message || "").trim())
      return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });
    if (type === "voice" && !voiceData)
      return NextResponse.json({ error: "Data suara diperlukan." }, { status: 400 });
    if (type === "sticker" && !stickerCode)
      return NextResponse.json({ error: "Stiker diperlukan." }, { status: 400 });
    if (type === "image" && !imageData)
      return NextResponse.json({ error: "Data gambar diperlukan." }, { status: 400 });
    if (type === "poll" && (!pollQuestion || !Array.isArray(pollOptions) || pollOptions.length < 2))
      return NextResponse.json({ error: "Poll butuh pertanyaan dan minimal 2 opsi." }, { status: 400 });

    const VALID_TYPES = ["text", "sticker", "voice", "image", "poll"];
    const col = await chatMessagesCol();

    const parsedOptions = type === "poll"
      ? pollOptions.slice(0, 4).map((text, i) => ({ id: String(i), text: String(text).slice(0, 60), voters: [] }))
      : null;

    const msg = {
      msgId: crypto.randomUUID(),
      token: String(token),
      displayName: String(displayName).trim().slice(0, 24),
      message: type === "text" ? String(message || "").trim().slice(0, 500) : "",
      type: VALID_TYPES.includes(type) ? type : "text",
      replyTo: replyTo || null,
      replyToName: replyToName ? String(replyToName).slice(0, 24) : null,
      replyToPreview: replyToPreview ? String(replyToPreview).slice(0, 80) : null,
      voiceData: type === "voice" ? voiceData : null,
      stickerCode: type === "sticker" ? stickerCode : null,
      imageData: type === "image" ? imageData : null,
      pollQuestion: type === "poll" ? String(pollQuestion).slice(0, 200) : null,
      pollOptions: parsedOptions,
      isAI: false,
      isSystem: false,
      reactions: {},
      pinned: false,
      pinnedBy: null,
      mentions: Array.isArray(mentions) ? mentions.slice(0, 10).map(n => String(n).slice(0, 24)) : [],
      isCommand: isCommand === true,
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
