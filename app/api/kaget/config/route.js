import { NextResponse } from "next/server";
import { konfigKaget, biayaKaget } from "@/lib/kaget";

export const dynamic = "force-dynamic";

// Batas & status fitur, supaya angka di layar persis sama dengan yang dicek server.
export async function GET() {
  try {
    const k = await konfigKaget();
    return NextResponse.json({ ...k, contohBiaya: biayaKaget(100000, k.biayaPersen) });
  } catch (err) {
    console.error("[kaget:config]", err);
    return NextResponse.json({ error: "Gagal memuat pengaturan Kaget." }, { status: 500 });
  }
}
