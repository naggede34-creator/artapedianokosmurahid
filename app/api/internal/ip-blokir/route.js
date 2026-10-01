import { NextResponse } from "next/server";
import { daftarSidikIp } from "@/lib/blokirIp";
import { ambilBanPublik } from "@/lib/tampilanBan";

export const dynamic = "force-dynamic";

// Dibaca middleware untuk tahu IP mana yang diblokir. Hanya berisi sidik bergaram (SHA-256), bukan alamat IP.
export async function GET() {
  try {
    const [h, p] = await Promise.all([daftarSidikIp(), ambilBanPublik().catch(() => null)]);
    return NextResponse.json({ h, p }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[ip-blokir]", err?.message || err);
    return NextResponse.json({ h: [], galat: true }, { status: 500 });
  }
}
