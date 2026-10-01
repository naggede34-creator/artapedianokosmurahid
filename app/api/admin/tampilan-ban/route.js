import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { ambilBanAdmin, simpanBan, resetBan } from "@/lib/tampilanBan";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  try { return NextResponse.json(await ambilBanAdmin(), { headers: H }); }
  catch (err) { console.error("[admin/tampilan-ban]", err?.message || err); return NextResponse.json({ error: "Gagal memuat." }, { status: 500 }); }
}

// POST { aksi: "simpan", ...field } | { aksi: "reset" }
export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  const b = await req.json().catch(() => ({}));
  try {
    const r = b.aksi === "reset" ? await resetBan() : b.aksi === "simpan" ? await simpanBan(b) : { ok: false, alasan: "Aksi tidak dikenal." };
    return r.ok ? NextResponse.json(r, { headers: H }) : NextResponse.json({ error: r.alasan }, { status: 400 });
  } catch (err) { console.error("[admin/tampilan-ban]", err?.message || err); return NextResponse.json({ error: "Gagal memproses." }, { status: 500 }); }
}
