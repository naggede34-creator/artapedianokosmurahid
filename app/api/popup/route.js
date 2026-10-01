import { NextResponse } from "next/server";
import { popupPublik } from "@/lib/popupAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json({ items: await popupPublik() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "no-store" } }); }
}
