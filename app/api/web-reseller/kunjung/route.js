import { NextResponse } from "next/server";
import { rwDariReq } from "@/lib/rwKonteks";
import { catatKunjungan } from "@/lib/webReseller";

export const dynamic = "force-dynamic";

// Dipanggil sekali per sesi peramban oleh web reseller. Webnya ditentukan server dari host/cookie, bukan dari body.
export async function POST(req) {
  const web = await rwDariReq(req);
  if (web) await catatKunjungan(web.slug);
  return NextResponse.json({ ok: true });
}
