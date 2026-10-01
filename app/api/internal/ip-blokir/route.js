import { NextResponse } from "next/server";
import { daftarSidikIp } from "@/lib/blokirIp";

export const dynamic = "force-dynamic";

// Dibaca middleware untuk tahu IP mana yang diblokir. Hanya berisi sidik bergaram (SHA-256), bukan alamat IP.
export async function GET() {
  try {
    return NextResponse.json({ h: await daftarSidikIp() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[ip-blokir]", err?.message || err);
    return NextResponse.json({ h: [], galat: true }, { status: 500 });
  }
}
