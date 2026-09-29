import { NextResponse } from "next/server";
import { rekomendasiLayanan } from "@/lib/rekomendasi";

export const dynamic = "force-dynamic";

// Saran layanan berikutnya sesudah OTP masuk. Hanya nama layanan populer —
// tidak ada data pengguna di dalamnya, jadi tidak butuh token.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const layanan = String(searchParams.get("service") || "").slice(0, 80);
  const daftar = await rekomendasiLayanan({ serviceName: layanan, batas: 4 });
  return NextResponse.json({ rekomendasi: daftar.map((r) => r.nama) });
}
