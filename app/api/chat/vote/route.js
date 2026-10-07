import { NextResponse } from "next/server";
import { chatMessagesCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { token, msgId, optionId } = await req.json().catch(() => ({}));
    if (!token || !msgId || optionId === undefined)
      return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const col = await chatMessagesCol();
    const msg = await col.findOne({ msgId, type: "poll" });
    if (!msg) return NextResponse.json({ error: "Poll tidak ditemukan." }, { status: 404 });

    const options = (msg.pollOptions || []).map(opt => ({
      ...opt,
      voters: (opt.voters || []).filter(t => t !== token),
    }));

    const target = options.find(o => o.id === String(optionId));
    if (!target) return NextResponse.json({ error: "Opsi tidak ditemukan." }, { status: 404 });

    const alreadyVoted = (msg.pollOptions || []).some(o => o.id === String(optionId) && (o.voters||[]).includes(token));
    if (!alreadyVoted) target.voters.push(token);

    await col.updateOne({ msgId }, { $set: { pollOptions: options } });
    return NextResponse.json({ ok: true, pollOptions: options });
  } catch (err) {
    console.error("[chat/vote]", err);
    return NextResponse.json({ error: "Gagal vote." }, { status: 500 });
  }
}
