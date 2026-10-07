import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { daftarKagetAdmin, tutupKaget, konfigKaget } from "@/lib/kaget";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!await adminSah(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const [data, konfig] = await Promise.all([
    daftarKagetAdmin({ status: sp.get("status") || "", q: sp.get("q") || "", limit: Number(sp.get("limit")) || 50 }),
    konfigKaget()
  ]);
  return NextResponse.json({ ...data, konfig });
}

// Tutup paksa paket aktif (mis. penyalahgunaan). Sisa yang belum diambil kembali ke pembuatnya; yang sudah diambil tidak ditarik.
export async function POST(req) {
  if (!await adminSah(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.aksi !== "tutup") return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
  const r = await tutupKaget({ kid: String(b.kid || "").toUpperCase(), admin: true });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, dikembalikan: r.dikembalikan });
}
