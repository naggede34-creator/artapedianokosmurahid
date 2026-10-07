import { NextResponse } from "next/server";
import { productOrdersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Token diperlukan." }, { status: 400 });

    const col = await productOrdersCol();
    const items = await col
      .find({ token })
      .sort({ purchasedAt: -1 })
      .limit(50)
      .project({ _id: 1, productName: 1, price: 1, deliveryType: 1, deliveryContent: 1, ref: 1, purchasedAt: 1 })
      .toArray();

    return NextResponse.json({ items: items.map((o) => ({ ...o, id: o._id.toString() })) });
  } catch (err) {
    console.error("[products/orders]", err);
    return NextResponse.json({ error: "Gagal memuat riwayat." }, { status: 500 });
  }
}
