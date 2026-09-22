import { NextResponse } from "next/server";
import { getPaymentFees } from "@/lib/pakasir";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Biaya pasti dari Pakasir untuk satu nominal (API publik v2, tanpa API key).
// Dipakai halaman deposit supaya angka "biaya admin" yang dilihat user adalah
// angka sebenarnya, bukan tebakan persen.
//
// Kalau Pakasir tidak bisa dihubungi, fees dikembalikan null dan halaman deposit
// otomatis kembali memakai estimasi persen dari pengaturan admin.
export async function GET(req) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`${ip}:depfee`, 30, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
  }

  const amount = Math.floor(Number(new URL(req.url).searchParams.get("amount") || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount wajib diisi." }, { status: 400 });
  }

  const fees = await getPaymentFees(amount);
  if (!fees) return NextResponse.json({ amount, fees: null, pakasir: null });

  const qris = Number(fees.qris);
  return NextResponse.json({
    amount,
    fees,
    pakasir: Number.isFinite(qris) ? qris : null
  });
}
