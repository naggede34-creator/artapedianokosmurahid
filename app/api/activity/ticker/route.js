import { NextResponse } from "next/server";
import { otpOrdersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

// Kode akun ditutupi sebagian — ticker cuma buat social proof, bukan buat
// mengekspos data akun user lain.
function maskToken(token = "") {
  if (!token) return "••••";
  if (token.length <= 6) return `••${token.slice(-2)}`;
  return `••••${token.slice(-4)}`;
}

export async function GET() {
  try {
    const orders = await otpOrdersCol();
    const list = await orders
      .find({ status: "done" }, { projection: { token: 1, serviceName: 1, countryName: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    return NextResponse.json({
      items: list.map((o) => ({
        token: maskToken(o.token),
        serviceName: o.serviceName || "layanan",
        countryName: o.countryName || "",
        createdAt: o.createdAt
      }))
    });
  } catch (err) {
    console.error(err);
    // Ticker bukan fitur kritikal — kalau DB bermasalah, jangan sampai ganggu beranda.
    return NextResponse.json({ items: [] });
  }
}
