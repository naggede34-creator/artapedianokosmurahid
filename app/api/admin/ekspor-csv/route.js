import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { buatCsv, JENIS_EKSPOR } from "@/lib/ekspor";

export const dynamic = "force-dynamic";

// GET ?jenis=deposit|pesanan|penarikan|mutasi&dari=YYYY-MM-DD&sampai=YYYY-MM-DD&penyedia=&status=  → file CSV (maks 50.000 baris)
export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const u = new URL(req.url).searchParams;
  const jenis = String(u.get("jenis") || "");
  if (!JENIS_EKSPOR.includes(jenis)) return NextResponse.json({ error: "Jenis ekspor tidak dikenal." }, { status: 400 });
  try {
    const r = await buatCsv(jenis, { dari: u.get("dari"), sampai: u.get("sampai"), penyedia: u.get("penyedia"), status: u.get("status") });
    const nama = `artapedia-${jenis}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(r.csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nama}"`, "X-Baris": String(r.baris), "X-Terpotong": r.terpotong ? "1" : "0", "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[admin/ekspor-csv]", err?.message || err);
    return NextResponse.json({ error: "Gagal membuat CSV." }, { status: 500 });
  }
}
