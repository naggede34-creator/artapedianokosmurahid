import { NextResponse } from "next/server";
import { lihatKaget } from "@/lib/kaget";

export const dynamic = "force-dynamic";

// GET /api/kaget/lihat?kid=…&token=…  (token opsional: dipakai untuk tahu apakah ini paket milikmu / sudah kamu ambil)
export async function GET(req) {
  try {
    const sp = new URL(req.url).searchParams;
    const r = await lihatKaget(String(sp.get("kid") || "").toUpperCase(), sp.get("token") || "");
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { ok, ...isi } = r;
    return NextResponse.json(isi);
  } catch (err) {
    console.error("[kaget:lihat]", err);
    return NextResponse.json({ error: "Gagal memuat paket Kaget." }, { status: 500 });
  }
}
