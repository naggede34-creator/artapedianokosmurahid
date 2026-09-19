import { NextResponse } from "next/server";
import { resellersCol, resellerOrdersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Token diperlukan." }, { status: 400 });

    const rCol = await resellersCol();
    const r = await rCol.findOne({ token });
    if (!r) return NextResponse.json({ error: "Reseller tidak ditemukan." }, { status: 404 });

    const oCol = await resellerOrdersCol();
    const orders = await oCol.find({ resellerToken: token }).sort({ createdAt: -1 }).limit(50).toArray();

    const totalOrders = await oCol.countDocuments({ resellerToken: token });
    const revenueAgg = await oCol.aggregate([
      { $match: { resellerToken: token } },
      { $group: { _id: null, total: { $sum: "$commission" } } }
    ]).toArray();
    const totalCommission = revenueAgg[0]?.total || 0;

    return NextResponse.json({
      slug: r.slug,
      webName: r.webName,
      markup: r.markup,
      active: r.active,
      totalOrders,
      totalCommission,
      orders: orders.map(o => ({
        id: o._id?.toString(),
        type: o.type,
        detail: o.detail,
        charge: o.charge,
        commission: o.commission,
        buyerToken: o.buyerToken?.slice(0, 8) + "…",
        createdAt: o.createdAt,
      }))
    });
  } catch (err) {
    console.error("[reseller/stats]", err);
    return NextResponse.json({ error: "Gagal ambil stats." }, { status: 500 });
  }
}
