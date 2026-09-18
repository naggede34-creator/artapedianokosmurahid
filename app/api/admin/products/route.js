import { NextResponse } from "next/server";
import { productsCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";
import { sendTelegramNotif, productCreatedNotif } from "@/lib/telegram";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const col = await productsCol();
    const items = await col.find({}).sort({ createdAt: -1 }).toArray();
    return NextResponse.json({ items: items.map((p) => ({ ...p, id: p._id.toString() })) });
  } catch (err) {
    return NextResponse.json({ error: "Gagal memuat produk." }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;
    const col = await productsCol();

    if (action === "create") {
      const { name, description, price, category, stock, imageUrl, deliveryType, deliveryContent } = body;
      if (!name || !price || !deliveryType || !deliveryContent) {
        return NextResponse.json({ error: "Nama, harga, tipe pengiriman, dan konten wajib diisi." }, { status: 400 });
      }
      const stockNum = Number(stock ?? -1);
      const result = await col.insertOne({
        name: String(name).trim(),
        description: String(description || "").trim(),
        price: Number(price),
        category: String(category || "Umum").trim(),
        stock: stockNum,
        imageUrl: String(imageUrl || "").trim(),
        deliveryType: String(deliveryType),
        deliveryContent: String(deliveryContent).trim(),
        active: true,
        soldCount: 0,
        createdAt: new Date()
      });
      sendTelegramNotif(productCreatedNotif({
        name: String(name).trim(),
        price: Number(price),
        category: String(category || "Umum").trim(),
        stock: stockNum,
        deliveryType: String(deliveryType),
        description: String(description || "").trim()
      }));
      return NextResponse.json({ ok: true, id: result.insertedId.toString() });
    }

    if (action === "edit") {
      const { id, name, description, price, category, stock, imageUrl, deliveryType, deliveryContent } = body;
      if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });
      await col.updateOne(
        { _id: new ObjectId(id) },
        { $set: {
          name: String(name).trim(),
          description: String(description || "").trim(),
          price: Number(price),
          category: String(category || "Umum").trim(),
          stock: Number(stock ?? -1),
          imageUrl: String(imageUrl || "").trim(),
          deliveryType: String(deliveryType),
          deliveryContent: String(deliveryContent).trim()
        }}
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "toggle") {
      const { id } = body;
      const p = await col.findOne({ _id: new ObjectId(id) });
      if (!p) return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
      await col.updateOne({ _id: new ObjectId(id) }, { $set: { active: !p.active } });
      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      const { id } = body;
      await col.deleteOne({ _id: new ObjectId(id) });
      return NextResponse.json({ ok: true });
    }

    if (action === "add-stock") {
      const { id, amount } = body;
      const add = Math.floor(Number(amount || 0));
      if (!id || add <= 0) return NextResponse.json({ error: "ID dan jumlah stok wajib diisi." }, { status: 400 });
      await col.updateOne({ _id: new ObjectId(id) }, { $inc: { stock: add } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
  } catch (err) {
    console.error("[admin/products]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
