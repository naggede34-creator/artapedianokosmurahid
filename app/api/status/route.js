import { NextResponse } from "next/server";
import { statusLayanan } from "@/lib/statusLayanan";

// Tanpa `dynamic = "force-dynamic"`: di Next 15 itu menimpa Cache-Control buatan sendiri jadi "no-store". GET handler memang tidak di-cache bawaan.

// Publik, tanpa login. Hanya angka ringkas per layanan — tidak ada nama penyedia, kunci, maupun data pengguna.
export async function GET() {
  try { return NextResponse.json(await statusLayanan(), { headers: { "Cache-Control": "public, max-age=15, s-maxage=15" } }); }
  catch (e) { console.error("[status]", e?.message || e); return NextResponse.json({ error: "Gagal memuat status." }, { status: 500, headers: { "Cache-Control": "no-store" } }); }
}
