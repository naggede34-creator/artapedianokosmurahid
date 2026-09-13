import { NextResponse } from "next/server";
import { announcementsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";
import { sendTelegramNotif, announcementCreatedNotif } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const CATEGORY_ICON = {
  Penting: "📢",
  Informasi: "ℹ️",
  Promo: "🎉"
};

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const col = await announcementsCol();
  const list = await col.find({}).sort({ createdAt: -1 }).limit(100).toArray();
  return NextResponse.json({
    items: list.map((a) => ({
      id: a._id.toString(),
      category: a.category,
      title: a.title,
      body: a.body,
      icon: a.icon,
      active: a.active !== false,
      createdAt: a.createdAt
    }))
  });
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const title = String(body.title || "").trim().slice(0, 120);
    const text = String(body.body || "").trim().slice(0, 1000);
    const category = ["Penting", "Informasi", "Promo"].includes(body.category) ? body.category : "Informasi";
    if (!title || !text) {
      return NextResponse.json({ error: "Judul & isi pengumuman wajib diisi." }, { status: 400 });
    }

    const col = await announcementsCol();
    const doc = {
      category,
      title,
      body: text,
      icon: CATEGORY_ICON[category] || "ℹ️",
      active: true,
      views: 0,
      likes: 0,
      fire: 0,
      createdAt: new Date()
    };
    const result = await col.insertOne(doc);

    sendTelegramNotif(announcementCreatedNotif({ title, category }));

    return NextResponse.json({ id: result.insertedId.toString(), ...doc });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal membuat pengumuman." }, { status: 500 });
  }
}
