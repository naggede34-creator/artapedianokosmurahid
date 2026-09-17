import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);

    const users = await usersCol();
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = q ? { $or: [{ token: { $regex: safe, $options: "i" } }, { name: { $regex: safe, $options: "i" } }] } : {};
    const [items, total, agg] = await Promise.all([
      users.find(filter).sort({ createdAt: -1 }).limit(limit).toArray(),
      users.countDocuments({}),
      users
        .aggregate([{ $group: { _id: null, totalBalance: { $sum: "$balance" } } }])
        .toArray()
    ]);

    return NextResponse.json({
      items: items.map((u) => ({
        token: u.token,
        name: u.name || null,
        balance: u.balance || 0,
        depositTotal: u.depositTotal || 0,
        referralCount: u.referralCount || 0,
        referralEarnings: u.referralEarnings || 0,
        createdAt: u.createdAt
      })),
      total,
      totalBalance: agg[0]?.totalBalance || 0
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengambil daftar user." }, { status: 500 });
  }
}
