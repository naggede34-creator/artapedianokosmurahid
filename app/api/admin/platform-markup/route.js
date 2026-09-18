import { NextResponse } from "next/server";
import { platformMarkupCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const col = await platformMarkupCol();
  const items = await col.find({}).toArray();
  return NextResponse.json({ items: items.map((i) => ({ id: i._id.toString(), platform: i.platform, markupPercent: i.markupPercent, active: i.active })) });
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { action, id, platform, markupPercent } = body;

  const col = await platformMarkupCol();

  if (action === "upsert") {
    if (!platform || markupPercent == null) return NextResponse.json({ error: "platform dan markupPercent wajib." }, { status: 400 });
    const pct = Number(markupPercent);
    if (isNaN(pct) || pct < 0 || pct > 200) return NextResponse.json({ error: "markupPercent 0–200." }, { status: 400 });
    await col.updateOne(
      { platform: platform.trim().toLowerCase() },
      { $set: { platform: platform.trim().toLowerCase(), markupPercent: pct, active: true, updatedAt: new Date() } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "toggle" || action === "delete") {
    const { ObjectId } = await import("mongodb");
    let oid;
    try { oid = new ObjectId(id); } catch { return NextResponse.json({ error: "id tidak valid" }, { status: 400 }); }
    if (action === "toggle") {
      const doc = await col.findOne({ _id: oid });
      if (!doc) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
      await col.updateOne({ _id: oid }, { $set: { active: !doc.active } });
    } else {
      await col.deleteOne({ _id: oid });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action tidak dikenal" }, { status: 400 });
}
