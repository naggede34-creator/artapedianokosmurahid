import { NextResponse } from "next/server";
import { productsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const col = await productsCol();
    const items = await col
      .find({ active: true })
      .sort({ createdAt: -1 })
      .project({ _id: 1, name: 1, description: 1, price: 1, category: 1, stock: 1, imageUrl: 1, deliveryType: 1 })
      .toArray();
    return NextResponse.json({ items: items.map((p) => ({ ...p, id: p._id.toString() })) });
  } catch (err) {
    console.error("[products]", err);
    return NextResponse.json({ error: "Gagal memuat produk." }, { status: 500 });
  }
}
