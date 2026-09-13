import { NextResponse } from "next/server";
import { broadcastsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const col = await broadcastsCol();
    const list = await col
      .find({ active: { $ne: false } })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
    return NextResponse.json({
      items: list.map((b) => ({
        id: b._id.toString(),
        message: b.message,
        createdAt: b.createdAt
      }))
    });
  } catch (err) {
    console.error(err);
    // Kalau DB bermasalah, jangan sampai broadcast malah mengganggu tampilan web.
    return NextResponse.json({ items: [] });
  }
}
