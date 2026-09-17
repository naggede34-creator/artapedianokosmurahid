import { NextResponse } from "next/server";
import { smmOrdersCol, usersCol } from "@/lib/db";
import { syncSmmOrder, toPublicOrder } from "@/lib/smmService";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const sp = new URL(req.url).searchParams;
    const token = sp.get("token");
    const id = sp.get("id");
    if (!token || !id) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const col = await smmOrdersCol();
    const order = await col.findOne({ id, token });
    if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });

    // Batasi sinkron ke provider maksimal 1x per 10 detik per pesanan.
    let fresh = order;
    const last = order.lastSyncAt ? new Date(order.lastSyncAt).getTime() : 0;
    if (!order.settled && Date.now() - last > 10 * 1000) {
      try {
        fresh = await syncSmmOrder(order);
      } catch (e) {
        console.error("[smm/status] sync gagal:", e?.message);
      }
    }
    const user = await (await usersCol()).findOne({ token }, { projection: { balance: 1 } });
    return NextResponse.json({ item: toPublicOrder(fresh), balance: user?.balance ?? 0 });
  } catch (err) {
    console.error("[smm/status]", err?.message || err);
    return NextResponse.json({ error: "Gagal memeriksa status pesanan." }, { status: 500 });
  }
}
