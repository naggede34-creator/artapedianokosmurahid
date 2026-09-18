import { NextResponse } from "next/server";
import { ticketsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { token, ticketId, message } = body;
  if (!token || !ticketId || !message) {
    return NextResponse.json({ error: "token, ticketId, dan message wajib diisi." }, { status: 400 });
  }

  const col = await ticketsCol();
  const ticket = await col.findOne({ ticketId, token });
  if (!ticket) return NextResponse.json({ error: "Tiket tidak ditemukan." }, { status: 404 });
  if (ticket.status === "closed") return NextResponse.json({ error: "Tiket sudah ditutup." }, { status: 400 });

  const now = new Date();
  await col.updateOne(
    { ticketId, token },
    {
      $push: { messages: { from: "user", text: String(message).slice(0, 2000), createdAt: now } },
      $set: { status: "open", updatedAt: now },
    }
  );

  return NextResponse.json({ ok: true });
}
