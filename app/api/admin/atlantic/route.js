// Diagnosa koneksi Atlantic dari sisi server. Tidak pernah membocorkan API key —
// hanya melaporkan apa yang dibalas Atlantic (atau Cloudflare di depannya).
import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { diagnoseAtlantic } from "@/lib/atlantic";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!await adminSah(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return NextResponse.json(await diagnoseAtlantic());
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Gagal diagnosa." }, { status: 502 });
  }
}
