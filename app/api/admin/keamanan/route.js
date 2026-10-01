import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { ringkasanKeamanan, pindaiKeamanan } from "@/lib/keamanan";
import { ringkasanAntiCurang } from "@/lib/anticurang";

export const dynamic = "force-dynamic";

// GET  → ringkasan keamanan (kejadian terbaru, status pemindaian) + ringkasan anti-curang game
// POST { aksi: "pindai" } → jalankan pemindaian sekarang
export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    return NextResponse.json({ ...(await ringkasanKeamanan()), game: await ringkasanAntiCurang() });
  } catch (e) {
    console.error("[admin/keamanan]", e?.message || e);
    return NextResponse.json({ error: "Gagal memuat ringkasan keamanan." }, { status: 500 });
  }
}

export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.aksi !== "pindai") return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
  try {
    const hasil = await pindaiKeamanan({ kabarBersih: false });
    return NextResponse.json({ ok: true, ...hasil, ringkasan: await ringkasanKeamanan() });
  } catch (e) {
    console.error("[admin/keamanan pindai]", e?.message || e);
    return NextResponse.json({ error: "Pemindaian gagal." }, { status: 500 });
  }
}
