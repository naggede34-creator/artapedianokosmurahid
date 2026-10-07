import { NextResponse } from "next/server";
import { daftarKagetSaya } from "@/lib/kaget";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });
    return NextResponse.json(await daftarKagetSaya(token));
  } catch (err) {
    console.error("[kaget:saya]", err);
    return NextResponse.json({ error: "Gagal memuat riwayat Kaget." }, { status: 500 });
  }
}
