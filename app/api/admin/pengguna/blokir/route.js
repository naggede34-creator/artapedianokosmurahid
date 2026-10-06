import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { ubahBlokir } from "@/lib/penggunaAdmin";

export const dynamic = "force-dynamic";

// POST { token, aksi: "ban" | "unban", alasan, kabari? }
export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    const r = await ubahBlokir({ token: String(b.token || ""), aksi: String(b.aksi || ""), alasan: b.alasan,  kabari: b.kabari !== false, durasiMenit: b.durasiMenit });
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.alasan }, { status: r.status || 400 });
  } catch (err) {
    console.error("[admin/pengguna/blokir]", err?.message || err);
    return NextResponse.json({ error: "Gagal mengubah status blokir." }, { status: 500 });
  }
}
