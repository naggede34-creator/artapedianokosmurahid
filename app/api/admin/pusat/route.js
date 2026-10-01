import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { ringkasPusat } from "@/lib/penggunaAdmin";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try { return NextResponse.json(await ringkasPusat(), { headers: { "Cache-Control": "no-store" } }); }
  catch (err) { console.error("[admin/pusat]", err?.message || err); return NextResponse.json({ error: "Gagal memuat ringkasan." }, { status: 500 }); }
}
