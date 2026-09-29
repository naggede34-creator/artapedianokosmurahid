// Program kreator: pengajuan yang menunggu dan daftar kreator aktif.
import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { daftarAdmin, putuskanKreator } from "@/lib/afiliasi";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json(await daftarAdmin());
}

export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!rateLimit("admin-afiliasi", 60, 60_000)) return NextResponse.json({ error: "Terlalu cepat." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  if (!b.token) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });
  const r = await putuskanKreator({ token: String(b.token), aksi: String(b.aksi || ""), persen: b.persen, alasan: b.alasan });
  return NextResponse.json(r.ok ? { ok: true } : { error: r.alasan }, { status: r.ok ? 200 : 400 });
}
