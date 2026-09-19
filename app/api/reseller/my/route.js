import { NextResponse } from "next/server";
import { resellersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (!token) return NextResponse.json({ reseller: null });
    const col = await resellersCol();
    const r = await col.findOne({ token });
    if (!r) return NextResponse.json({ reseller: null });
    return NextResponse.json({
      reseller: {
        slug: r.slug,
        webName: r.webName,
        markup: r.markup,
        active: r.active,
        logo: r.logo || null,
        description: r.description || "",
        totalOrders: r.totalOrders || 0,
        totalRevenue: r.totalRevenue || 0,
        createdAt: r.createdAt,
      }
    });
  } catch (err) {
    console.error("[reseller/my]", err);
    return NextResponse.json({ reseller: null });
  }
}
