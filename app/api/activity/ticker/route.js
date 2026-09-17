import { NextResponse } from "next/server";
import { otpOrdersCol, smmOrdersCol } from "@/lib/db";

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
    const [otp, smm] = await Promise.all([
      orders
        .find({ status: "done" }, { projection: { token: 1, serviceName: 1, countryName: 1, createdAt: 1 } })
        .sort({ createdAt: -1 })
        .limit(15)
        .toArray(),
      (await smmOrdersCol())
        .find({ status: { $in: ["completed", "processing", "in_progress", "pending"] } }, { projection: { token: 1, platform: 1, kind: 1, createdAt: 1 } })
        .sort({ createdAt: -1 })
        .limit(8)
        .toArray()
    ]);

    const items = [
      ...otp.map((o) => ({
        kind: "otp",
        token: maskToken(o.token),
        serviceName: o.serviceName || "layanan",
        countryName: o.countryName || "",
        createdAt: o.createdAt
      })),
      ...smm.map((o) => ({
        kind: "smm",
        token: maskToken(o.token),
        serviceName: `${o.kind || "paket"} ${o.platform || ""}`.trim(),
        countryName: "",
        createdAt: o.createdAt
      }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json({ items });
  } catch (err) {
    console.error(err);
    // Ticker bukan fitur kritikal — kalau DB bermasalah, jangan sampai ganggu beranda.
    return NextResponse.json({ items: [] });
  }
}
