import { NextResponse } from "next/server";
import { broadcastsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const col = await broadcastsCol();
    const now = new Date();
    const list = await col
      .find({
        active: { $ne: false },
        $and: [
          { $or: [{ startAt: null }, { startAt: { $exists: false } }, { startAt: { $lte: now } }] },
          { $or: [{ endAt: null }, { endAt: { $exists: false } }, { endAt: { $gte: now } }] }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
    return NextResponse.json({
      items: list.map((b) => ({
        id: b._id.toString(),
        message: b.message,
        endAt: b.endAt || null,
        createdAt: b.createdAt
      }))
    });
  } catch (err) {
    console.error(err);
    // Kalau DB bermasalah, jangan sampai broadcast malah mengganggu tampilan web.
    return NextResponse.json({ items: [] });
  }
}
