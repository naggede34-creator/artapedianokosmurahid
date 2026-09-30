import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { pembaruanAdmin, ubahPembaruan } from "@/lib/pembaruan";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json(await pembaruanAdmin());
}

export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { aksi, ...d } = await req.json().catch(() => ({}));
  const r = await ubahPembaruan(String(aksi || ""), d);
  return r.ok ? NextResponse.json({ ok: true, id: r.id }) : NextResponse.json({ error: r.alasan || "Gagal." }, { status: 400 });
}
