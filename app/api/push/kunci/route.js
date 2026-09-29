import { NextResponse } from "next/server";
import { ambilVapid } from "@/lib/webPush";

export const dynamic = "force-dynamic";

// Kunci PUBLIK VAPID untuk pushManager.subscribe. Aman dibuka: memang publik.
export async function GET() {
  try {
    const v = await ambilVapid();
    return NextResponse.json({ publik: v.publik });
  } catch (err) {
    console.error("[push/kunci]", err?.message || err);
    return NextResponse.json({ error: "Push belum bisa dipakai." }, { status: 503 });
  }
}
