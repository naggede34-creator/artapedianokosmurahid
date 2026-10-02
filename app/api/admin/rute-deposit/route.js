import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { statusRute } from "@/lib/depositRuteStatus";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  try {
    return NextResponse.json(await statusRute(), { headers: H });
  } catch (err) { console.error("[admin/rute-deposit]", err?.message || err); return NextResponse.json({ error: "Gagal memuat." }, { status: 500, headers: H }); }
}
