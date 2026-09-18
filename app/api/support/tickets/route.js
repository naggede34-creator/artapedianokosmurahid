import { NextResponse } from "next/server";
import { ticketsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token wajib." }, { status: 400 });

  const col = await ticketsCol();
  const tickets = await col
    .find({ token })
    .sort({ updatedAt: -1 })
    .toArray();

  const items = tickets.map((t) => ({
    ticketId: t.ticketId,
    subject: t.subject,
    status: t.status,
    messageCount: t.messages?.length || 0,
    firstMessage: t.messages?.[0]?.text?.slice(0, 200) || "",
    lastMessage: t.messages?.[t.messages.length - 1]?.text?.slice(0, 200) || "",
    messages: t.messages || [],
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));

  return NextResponse.json({ items });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { token, subject, message } = body;
  if (!token) return NextResponse.json({ error: "token wajib." }, { status: 400 });
  if (!subject || !message) return NextResponse.json({ error: "subject dan message wajib diisi." }, { status: 400 });

  const col = await ticketsCol();
  const now = new Date();
  const ticketId = `TKT${Date.now()}`;
  await col.insertOne({
    ticketId,
    token,
    subject: String(subject).slice(0, 200),
    status: "open",
    messages: [{ from: "user", text: String(message).slice(0, 2000), createdAt: now }],
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ ok: true, ticketId });
}
