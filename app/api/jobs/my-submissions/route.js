import { NextResponse } from "next/server";
import { jobSubmissionsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Token diperlukan." }, { status: 400 });

    const col = await jobSubmissionsCol();
    const items = await col
      .find({ token })
      .sort({ submittedAt: -1 })
      .limit(50)
      .toArray();
    return NextResponse.json({ items: items.map((s) => ({ ...s, id: s._id.toString(), jobId: s.jobId.toString() })) });
  } catch (err) {
    return NextResponse.json({ error: "Gagal memuat." }, { status: 500 });
  }
}
