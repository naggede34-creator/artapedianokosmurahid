import { NextResponse } from "next/server";
import { bannersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const placement = searchParams.get("placement") || "homepage";
  const col = await bannersCol();
  const items = await col
    .find({ active: true, placement })
    .sort({ sortOrder: 1, createdAt: -1 })
    .toArray();
  return NextResponse.json({
    items: items.map((b) => ({
      id: b._id.toString(),
      title: b.title,
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl,
      placement: b.placement,
    })),
  });
}
