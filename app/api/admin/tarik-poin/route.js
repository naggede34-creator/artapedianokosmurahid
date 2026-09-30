import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { daftarTarikAdmin, putusTarik } from "@/lib/game/dompet";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const status = new URL(req.url).searchParams.get("status") || "menunggu";
  return NextResponse.json(await daftarTarikAdmin({ status }));
}

export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { aksi, id, catatan, refBayar } = await req.json().catch(() => ({}));
  const r = await putusTarik(String(id || ""), String(aksi || ""), { catatan, refBayar });
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.alasan || "Gagal." }, { status: 400 });
}
