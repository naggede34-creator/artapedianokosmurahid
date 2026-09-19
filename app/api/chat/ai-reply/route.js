import { NextResponse } from "next/server";
import { chatMessagesCol } from "@/lib/db";
import { askCsAi } from "@/lib/neoxr";

export const dynamic = "force-dynamic";

const AI_PERSONAS = [
  { name: "Sanzz", style: "gaul, santai, suka pakai 'wkwk', 'bro', singkat 1-2 kalimat" },
  { name: "Manz", style: "cool, lugas, kadang pakai emoji, informatif singkat" },
  { name: "Ara", style: "ramah, semangat, suka kasih semangat, pakai 'kak', perempuan" },
  { name: "Dunia OTP", style: "expert OTP dan deposit, bantu teknis dengan jelas" },
  { name: "Fascall ID", style: "responsif, cepat, pakai banyak emoji, positif" },
  { name: "Zall", style: "humor ringan, santai, jawab dengan bercanda tapi tetap helpful" },
];

const GROUP_CONTEXT = `Kamu adalah anggota grup chat komunitas Artapedia — platform deposit saldo QRIS, beli nomor OTP, dan suntik sosmed.

Info singkat Artapedia:
- Deposit lewat QRIS, saldo masuk otomatis
- Beli nomor OTP: pilih layanan, negara, operator
- Suntik followers/likes/views media sosial
- Kode akun format AP-XXXX-XXXX adalah kunci akun, simpan baik-baik

Aturan menjawab:
- Balas HANYA jika pesan relevan atau kamu ingin menyapa/merespons
- Jawab singkat (1-3 kalimat max), sesuai gaya karaktermu
- Boleh pakai emoji tapi jangan berlebihan
- JANGAN minta kode akun atau data sensitif
- Jangan sebut dirimu AI atau bot — kamu anggota grup biasa yang ramah
- Kalau tidak tahu, sarankan tanya admin atau cek website`;

function pickPersona(lastAiName) {
  const pool = AI_PERSONAS.filter((p) => p.name !== lastAiName);
  return pool[Math.floor(Math.random() * pool.length)];
}

function shouldReply(message, msgType) {
  if (msgType !== "text") return Math.random() < 0.15;
  const txt = message.toLowerCase();
  const triggers = ["?", "gimana", "cara", "bisa", "saldo", "otp", "deposit", "error", "kenapa", "halo", "hai", "helo", "kok", "minta", "tolong", "help", "bantu"];
  if (triggers.some((t) => txt.includes(t))) return Math.random() < 0.65;
  return Math.random() < 0.22;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { message, type, displayName } = body;

    if (!shouldReply(message || "", type || "text")) {
      return NextResponse.json({ ok: true, replied: false });
    }

    const col = await chatMessagesCol();

    // Cek AI terakhir agar persona tidak sama
    const lastAiMsg = await col.findOne({ isAI: true }, { sort: { createdAt: -1 } });
    const lastAiName = lastAiMsg?.aiPersona || null;

    // Cek jika AI baru saja balas (< 8 detik lalu)
    if (lastAiMsg?.createdAt) {
      const diff = Date.now() - new Date(lastAiMsg.createdAt).getTime();
      if (diff < 8000) return NextResponse.json({ ok: true, replied: false });
    }

    const persona = pickPersona(lastAiName);

    // Ambil 8 pesan terakhir untuk konteks
    const recent = await col.find({ deleted: { $ne: true } }).sort({ createdAt: -1 }).limit(8).toArray();
    const history = [...recent].reverse().map((m) => `${m.displayName}: ${m.message || "[stiker/suara]"}`).join("\n");

    const prompt = `${GROUP_CONTEXT}\n\nGaya karaktermu: ${persona.style}\nNamamu: ${persona.name}\n\nPercakapan terbaru di grup:\n${history}\n\n${displayName}: ${message || "[stiker]"}\n${persona.name}:`;

    const reply = await askCsAi(prompt);
    if (!reply) return NextResponse.json({ ok: true, replied: false });

    // Delay alami (0.5-2.5 detik sudah lewat sisi client, di sini langsung insert)
    const aiMsg = {
      msgId: crypto.randomUUID(),
      token: null,
      displayName: persona.name,
      message: String(reply).trim().slice(0, 400),
      type: "text",
      replyTo: null,
      replyToName: null,
      replyToPreview: null,
      voiceData: null,
      stickerCode: null,
      isAI: true,
      aiPersona: persona.name,
      createdAt: new Date(),
      deleted: false,
    };

    await col.insertOne(aiMsg);
    return NextResponse.json({ ok: true, replied: true, persona: persona.name });
  } catch (err) {
    console.error("[chat/ai-reply]", err);
    return NextResponse.json({ ok: true, replied: false });
  }
}
