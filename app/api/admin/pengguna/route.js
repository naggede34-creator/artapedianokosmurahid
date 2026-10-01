import { NextResponse } from "next/server";
import { adminSah } from "@/lib/adminAuth";
import { daftarPengguna } from "@/lib/penggunaAdmin";

export const dynamic = "force-dynamic";

// GET ?q=&status=semua|dibekukan|aktif|otomatis|baru&urut=terbaru|saldo|deposit|nama&hal=0&ukuran=25
export async function GET(req) {
  if (!(await adminSah(req))) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const u = new URL(req.url).searchParams;
    const d = await daftarPengguna({ q: u.get("q") || "", status: u.get("status") || "semua", urut: u.get("urut") || "terbaru", hal: u.get("hal") || 0, ukuran: u.get("ukuran") || 25 });
    return NextResponse.json(d, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[admin/pengguna]", err?.message || err);
    return NextResponse.json({ error: "Gagal memuat daftar pengguna." }, { status: 500 });
  }
}
