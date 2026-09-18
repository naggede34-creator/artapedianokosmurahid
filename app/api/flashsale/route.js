import { NextResponse } from "next/server";
import { flashSalesCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const col = await flashSalesCol();
  const now = new Date();
  const sale = await col.findOne({
    active: true,
    startAt: { $lte: now },
    endAt: { $gt: now }
  }, { sort: { createdAt: -1 } });

  if (!sale) return NextResponse.json({ active: false });

  return NextResponse.json({
    active: true,
    id: sale._id.toString(),
    title: sale.title || "Flash Sale!",
    description: sale.description || "",
    discountPercent: sale.discountPercent || 0,
    endAt: sale.endAt,
    serviceFilter: sale.serviceFilter || null,
  });
}
