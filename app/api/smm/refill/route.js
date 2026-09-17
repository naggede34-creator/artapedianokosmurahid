import { NextResponse } from "next/server";
import { smmOrdersCol } from "@/lib/db";
import { requestSmmRefill } from "@/lib/simuru";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { token, id } = await req.json().catch(() => ({}));
    if (!token || !id) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const col = await smmOrdersCol();
    const order = await col.findOne({ id, token });
    if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    if (order.status !== "completed" || !order.refill) {
      return NextResponse.json({ error: "Refill hanya untuk pesanan selesai dengan garansi refill." }, { status: 400 });
    }
    const last = order.refillAt ? new Date(order.refillAt).getTime() : 0;
    if (Date.now() - last < 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "Refill hanya bisa diajukan 1x per 24 jam." }, { status: 429 });
    }

    const message = await requestSmmRefill(order.providerOrderId);
    await col.updateOne({ id }, { $set: { refillAt: new Date(), refillRequested: true } });
    return NextResponse.json({ ok: true, message });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Gagal mengajukan refill." }, { status: 400 });
  }
}
