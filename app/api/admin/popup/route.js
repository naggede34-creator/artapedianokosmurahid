import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { daftarAdmin, simpanPopup, hapusPopup, nyalakanPopup } from "@/lib/popupAdmin";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };

export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  try { return NextResponse.json({ items: await daftarAdmin() }, { headers: H }); }
  catch (err) { console.error("[admin/popup]", err?.message || err); return NextResponse.json({ error: "Gagal memuat." }, { status: 500 }); }
}

// POST { aksi: "simpan", id?, judul, teks, gambar, tombolTeks, tombolHref, frekuensi, urutan, mulai, selesai, aktif } | { aksi: "hapus"|"toggle", id }
export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  const b = await req.json().catch(() => ({}));
  try {
    const r = b.aksi === "simpan" ? await simpanPopup(b) : b.aksi === "hapus" ? await hapusPopup(b.id) : b.aksi === "toggle" ? await nyalakanPopup(b.id, b.aktif) : { ok: false, alasan: "Aksi tidak dikenal." };
    return r.ok ? NextResponse.json(r, { headers: H }) : NextResponse.json({ error: r.alasan }, { status: 400 });
  } catch (err) { console.error("[admin/popup]", err?.message || err); return NextResponse.json({ error: "Gagal memproses." }, { status: 500 }); }
}
