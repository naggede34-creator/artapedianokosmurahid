import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { ticketsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const col = await ticketsCol();
  const tickets = await col.find({}).sort({ updatedAt: -1 }).toArray();
  const items = tickets.map((t) => ({
    ticketId: t.ticketId,
    token: t.token,
    subject: t.subject,
    status: t.status,
    messageCount: t.messages?.length || 0,
    messages: t.messages || [],
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));
  return NextResponse.json({ items });
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { ticketId, action, message } = body;
  if (!ticketId || !action) return NextResponse.json({ error: "ticketId dan action wajib." }, { status: 400 });

  const col = await ticketsCol();
  const ticket = await col.findOne({ ticketId });
  if (!ticket) return NextResponse.json({ error: "Tiket tidak ditemukan." }, { status: 404 });
  const now = new Date();

  if (action === "reply") {
    if (!message) return NextResponse.json({ error: "message wajib untuk reply." }, { status: 400 });
    await col.updateOne(
      { ticketId },
      {
        $push: { messages: { from: "admin", text: String(message).slice(0, 2000), createdAt: now } },
        $set: { status: "answered", updatedAt: now },
      }
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "close") {
    await col.updateOne({ ticketId }, { $set: { status: "closed", updatedAt: now } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action tidak dikenal." }, { status: 400 });
}
