import { NextResponse } from "next/server";
import { ambilBanPublik } from "@/lib/tampilanBan";

export const dynamic = "force-dynamic";

// Publik: dipakai layar ban di sisi klien. Tidak berisi data sensitif.
export async function GET() {
  try { return NextResponse.json(await ambilBanPublik(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ aktif: false }, { headers: { "Cache-Control": "no-store" } }); }
}
