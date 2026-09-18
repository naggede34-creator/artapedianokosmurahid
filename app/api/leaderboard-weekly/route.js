import { NextResponse } from "next/server";
import { otpOrdersCol, usersCol, balanceLogsCol, userNotificationsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

const PRIZES = [
  { rank: 1, amount: 5000, label: "Rp5.000" },
  { rank: 2, amount: 3000, label: "Rp3.000" },
  { rank: 3, amount: 1000, label: "Rp1.000" },
];

function getWeekRange() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const day = now.getDay(); // 0=Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);
  return { start: monday, end: sunday };
}

// GET ?token= — leaderboard + user rank + claimable prize
export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  const { start, end } = getWeekRange();

  const col = await otpOrdersCol();
  const pipeline = [
    { $match: { status: "completed", createdAt: { $gte: start, $lt: end } } },
    { $group: { _id: "$token", count: { $sum: 1 }, totalSpent: { $sum: "$price" } } },
    { $sort: { count: -1, totalSpent: -1 } },
    { $limit: 20 },
  ];
  const raw = await col.aggregate(pipeline).toArray();
  const items = raw.map((r, i) => ({
    rank: i + 1,
    token: r._id,
    maskedToken: r._id ? r._id.slice(0, 4) + "****" + r._id.slice(-4) : "???",
    count: r.count,
    totalSpent: r.totalSpent,
    prize: PRIZES.find((p) => p.rank === i + 1) || null,
  }));

  let userRank = null, userPrize = null, claimable = false;
  if (token) {
    const idx = items.findIndex((it) => it.token === token);
    if (idx >= 0) {
      userRank = idx + 1;
      userPrize = items[idx].prize;
      // Check if not yet claimed this week
      const logs = await balanceLogsCol();
      const weekKey = start.toISOString().slice(0, 10);
      const claimed = await logs.findOne({ token, type: "weekly_leaderboard_prize", weekKey });
      claimable = !!userPrize && !claimed;
    }
  }

  return NextResponse.json({
    items: items.map((it) => ({ ...it, token: undefined, maskedToken: it.maskedToken })),
    weekStart: start.toISOString(),
    userRank,
    userPrize,
    claimable,
  });
}

// POST { token } — claim weekly leaderboard prize
export async function POST(req) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "token diperlukan" }, { status: 400 });

  const { start } = getWeekRange();
  const weekKey = start.toISOString().slice(0, 10);

  const col = await otpOrdersCol();
  const pipeline = [
    { $match: { status: "completed", createdAt: { $gte: start, $lt: new Date(start.getTime() + 7 * 86400000) } } },
    { $group: { _id: "$token", count: { $sum: 1 }, totalSpent: { $sum: "$price" } } },
    { $sort: { count: -1, totalSpent: -1 } },
    { $limit: 3 },
  ];
  const top3 = await col.aggregate(pipeline).toArray();
  const idx = top3.findIndex((r) => r._id === token);
  if (idx < 0) return NextResponse.json({ error: "Kamu tidak masuk top 3 minggu ini." }, { status: 400 });

  const prize = PRIZES[idx];
  const logs = await balanceLogsCol();
  const existing = await logs.findOne({ token, type: "weekly_leaderboard_prize", weekKey });
  if (existing) return NextResponse.json({ error: "Sudah diklaim minggu ini." }, { status: 400 });

  const users = await usersCol();
  await users.updateOne({ token }, { $inc: { balance: prize.amount } });
  await logs.insertOne({ token, amount: prize.amount, type: "weekly_leaderboard_prize", weekKey, note: `Hadiah leaderboard mingguan peringkat #${idx + 1}`, createdAt: new Date() });

  const notif = await userNotificationsCol();
  await notif.insertOne({ token, type: "reward", title: "🏆 Hadiah Leaderboard!", body: `Selamat! Kamu peringkat #${idx + 1} pembeli terbanyak minggu ini. +${prize.label} masuk saldo.`, read: false, createdAt: new Date() });

  return NextResponse.json({ ok: true, rank: idx + 1, prize });
}
