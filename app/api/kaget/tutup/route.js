import { NextResponse } from "next/server";
import { tutupKaget } from "@/lib/kaget";

export const dynamic = "force-dynamic";

// Pembuat menutup paketnya lebih awal; bagian yang belum diambil langsung kembali ke saldonya.
export async function POST(req) {
  try {
    const b = await req.json().catch(() => ({}));
    if (!b.token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });
    const r = await tutupKaget({ kid: String(b.kid || "").toUpperCase(), token: String(b.token) });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ dikembalikan: r.dikembalikan });
  } catch (err) {
    console.error("[kaget:tutup]", err);
    return NextResponse.json({ error: "Gagal menutup Kaget." }, { status: 500 });
  }
}
