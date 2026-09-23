import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { bannersCol } from "@/lib/db";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

const PLACEMENTS = ["homepage", "order", "dashboard", "deposit"];

// Gambar banner boleh berupa alamat http ATAU data URL hasil unggahan admin.
// Batas 500 karakter yang lama membuat unggahan diam-diam terpotong jadi
// gambar rusak, bukan ditolak — jadi panjangnya dibedakan per bentuk.
function bersihkanGambar(value) {
  const src = String(value || "").trim();
  if (src.startsWith("data:image/")) return src.slice(0, 1_400_000);
  return src.slice(0, 500);
}

const pilihPlacement = (p) => (PLACEMENTS.includes(p) ? p : "homepage");

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const col = await bannersCol();
  const items = await col.find({}).sort({ sortOrder: 1, createdAt: -1 }).toArray();
  return NextResponse.json({ items: items.map((b) => ({ ...b, id: b._id.toString(), _id: undefined })) });
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const col = await bannersCol();
  const now = new Date();

  if (body.action === "create") {
    const { title, imageUrl, linkUrl, placement, sortOrder, label } = body;
    if (!title || !imageUrl || !placement) return NextResponse.json({ error: "title, imageUrl, placement wajib diisi." }, { status: 400 });
    const doc = {
      title: String(title).slice(0, 200),
      label: String(label || "").slice(0, 24),
      imageUrl: bersihkanGambar(imageUrl),
      linkUrl: String(linkUrl || "").slice(0, 500),
      placement: pilihPlacement(placement),
      active: true,
      sortOrder: Number(sortOrder) || 0,
      createdAt: now,
      updatedAt: now,
    };
    const result = await col.insertOne(doc);
    return NextResponse.json({ ok: true, id: result.insertedId.toString() });
  }

  if (body.action === "update") {
    const { id, title, imageUrl, linkUrl, placement, sortOrder, label } = body;
    if (!id) return NextResponse.json({ error: "id wajib." }, { status: 400 });
    const set = { updatedAt: now };
    if (title !== undefined) set.title = String(title).slice(0, 200);
    if (label !== undefined) set.label = String(label).slice(0, 24);
    if (imageUrl !== undefined) set.imageUrl = bersihkanGambar(imageUrl);
    if (linkUrl !== undefined) set.linkUrl = String(linkUrl).slice(0, 500);
    if (placement !== undefined) set.placement = pilihPlacement(placement);
    if (sortOrder !== undefined) set.sortOrder = Number(sortOrder) || 0;
    await col.updateOne({ _id: new ObjectId(id) }, { $set: set });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id wajib." }, { status: 400 });
    await col.deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "toggle") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id wajib." }, { status: 400 });
    const banner = await col.findOne({ _id: new ObjectId(id) });
    if (!banner) return NextResponse.json({ error: "Banner tidak ditemukan." }, { status: 404 });
    await col.updateOne({ _id: new ObjectId(id) }, { $set: { active: !banner.active, updatedAt: now } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action tidak dikenal." }, { status: 400 });
}
