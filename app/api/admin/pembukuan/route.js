import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { ringkasanBulan, tambahPengeluaran, hapusPengeluaran, bulanValid, KATEGORI } from "@/lib/pembukuan";

export const dynamic = "force-dynamic";
const H = { "Cache-Control": "no-store" };
const bulanIni = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 7);

// GET ?bulan=YYYY-MM → ringkasan; POST { aksi: "tambah" | "hapus", ... }
export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  const b = new URL(req.url).searchParams.get("bulan") || bulanIni();
  if (!bulanValid(b)) return NextResponse.json({ error: "Format bulan: YYYY-MM." }, { status: 400, headers: H });
  try { return NextResponse.json({ ...(await ringkasanBulan(b)), kategori: KATEGORI }, { headers: H }); }
  catch (e) { console.error("[admin/pembukuan]", e?.message || e); return NextResponse.json({ error: "Gagal memuat." }, { status: 500, headers: H }); }
}

export async function POST(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: H });
  const b = await req.json().catch(() => ({}));
  const r = b.aksi === "tambah" ? await tambahPengeluaran(b) : b.aksi === "hapus" ? await hapusPengeluaran(b.id) : { ok: false, alasan: "Aksi tidak dikenal." };
  return r.ok ? NextResponse.json(r, { headers: H }) : NextResponse.json({ error: r.alasan }, { status: 400, headers: H });
}
