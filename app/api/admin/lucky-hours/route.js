import { NextResponse } from "next/server";
import { luckyHoursCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const col = await luckyHoursCol();
  const items = await col.find({}).toArray();
  return NextResponse.json({ items: items.map((i) => ({ ...i, id: i._id.toString(), _id: undefined })) });
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await req.json();
  const col = await luckyHoursCol();

  if (body.action === "delete" && body.id) {
    await col.deleteOne({ _id: new ObjectId(body.id) });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "toggle" && body.id) {
    const item = await col.findOne({ _id: new ObjectId(body.id) });
    await col.updateOne({ _id: new ObjectId(body.id) }, { $set: { active: !item?.active } });
    return NextResponse.json({ ok: true });
  }

  const { startHour, endHour, discountPercent, label } = body;
  if (startHour === undefined || endHour === undefined || !discountPercent) {
    return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 });
  }
  await col.insertOne({
    startHour: Number(startHour), endHour: Number(endHour),
    discountPercent: Number(discountPercent),
    label: label || `Lucky Hour ${startHour}:00–${endHour}:00`,
    active: true, createdAt: new Date(),
  });
  return NextResponse.json({ ok: true });
}
