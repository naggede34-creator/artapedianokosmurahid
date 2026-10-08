import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { ringkasBotReseller } from "@/lib/backupReseller";

export const dynamic = "force-dynamic";

// Daftar bot reseller + statistik (tanpa token bot).
export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(await ringkasBotReseller(), { headers: { "Cache-Control": "no-store" } });
}
