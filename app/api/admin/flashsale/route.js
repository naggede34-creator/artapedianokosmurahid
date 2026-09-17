import { NextResponse } from "next/server";
import { flashSalesCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const col = await flashSalesCol();
  const items = await col.find({}).sort({ createdAt: -1 }).limit(20).toArray();
  return NextResponse.json({ items: items.map((s) => ({ ...s, id: s._id.toString(), _id: undefined })) });
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await req.json();
  const col = await flashSalesCol();

  if (body.action === "delete" && body.id) {
    await col.deleteOne({ _id: new ObjectId(body.id) });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "toggle" && body.id) {
    const sale = await col.findOne({ _id: new ObjectId(body.id) });
    await col.updateOne({ _id: new ObjectId(body.id) }, { $set: { active: !sale?.active } });
    return NextResponse.json({ ok: true });
  }

  const { title, description, discountPercent, startAt, endAt, serviceFilter } = body;
  if (!title || !discountPercent || !startAt || !endAt) {
    return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 });
  }

  await col.insertOne({
    title,
    description: description || "",
    discountPercent: Number(discountPercent),
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    serviceFilter: serviceFilter || null,
    active: true,
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}
