import { NextResponse } from "next/server";
import { jobsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const col = await jobsCol();
    const items = await col
      .find({ active: true })
      .sort({ createdAt: -1 })
      .project({ _id: 1, title: 1, description: 1, reward: 1, maxCompletions: 1, completedCount: 1, proofType: 1, category: 1, imageUrl: 1 })
      .toArray();
    return NextResponse.json({ items: items.map((j) => ({ ...j, id: j._id.toString() })) });
  } catch (err) {
    console.error("[jobs]", err);
    return NextResponse.json({ error: "Gagal memuat job." }, { status: 500 });
  }
}
