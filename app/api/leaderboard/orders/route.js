import { NextResponse } from "next/server";
import { otpOrdersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

function maskToken(token = "") {
  if (!token) return "-";
  if (token.length <= 6) return `${token.slice(0, 3)}***`;
  return `${token.slice(0, 4)}***`;
}

// Peringkat 10 user dengan jumlah pesanan OTP sukses (status "done") terbanyak,
// sepanjang waktu — dipakai untuk kartu "Peringkat 10 User" di dashboard.
export async function GET() {
  try {
    const orders = await otpOrdersCol();

    const top = await orders
      .aggregate([
        { $match: { status: "done" } },
        { $group: { _id: "$token", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
      .toArray();

    return NextResponse.json({
      items: top.map((t, i) => ({
        rank: i + 1,
        token: maskToken(t._id),
        successCount: t.count
      }))
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil peringkat." }, { status: 500 });
  }
}
