import { NextResponse } from "next/server";
import { pembaruanPublik } from "@/lib/pembaruan";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await pembaruanPublik(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Gagal memuat." }, { status: 500 });
  }
}
