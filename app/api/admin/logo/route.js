import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { simpanLogo, hapusLogo, ringkasLogo } from "@/lib/logo";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  return NextResponse.json({ logo: await ringkasLogo() }, { headers: H });
}

// POST { jenis: "utama"|"ikon", data: "data:image/...;base64,..." } | { jenis, hapus: true }
export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  const b = await req.json().catch(() => ({}));
  try {
    const r = b.hapus ? await hapusLogo(b.jenis) : await simpanLogo(b.jenis, b.data);
    if (!r.ok) return NextResponse.json({ error: r.alasan }, { status: 400, headers: H });
    return NextResponse.json({ ok: true, logo: await ringkasLogo() }, { headers: H });
  } catch (err) {
    console.error("[admin/logo]", err?.message || err);
    return NextResponse.json({ error: "Gagal menyimpan logo." }, { status: 500, headers: H });
  }
}
