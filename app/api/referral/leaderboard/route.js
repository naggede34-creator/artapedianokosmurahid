import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

function maskToken(token = "") {
  if (!token) return "-";
  if (token.length <= 8) return token;
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

// Ranking dihitung dari jumlah teman yang MENDAFTAR bulan ini lewat link masing-masing
// user (referredBy), bukan dari total referralCount sepanjang masa.
export async function GET() {
  try {
    const users = await usersCol();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const top = await users
      .aggregate([
        { $match: { referredBy: { $ne: null }, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: "$referredBy", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
      .toArray();

    return NextResponse.json({
      month: startOfMonth.toISOString(),
      items: top.map((t, i) => ({
        rank: i + 1,
        token: maskToken(t._id),
        referralCount: t.count
      }))
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil leaderboard." }, { status: 500 });
  }
}
