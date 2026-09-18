import { NextResponse } from "next/server";
import { balanceLogsCol, otpOrdersCol, usersCol } from "@/lib/db";
import { isAdminRequest } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const monthAgo = new Date(now.getTime() - 30 * 86400000);

  const logs = await balanceLogsCol();

  const [
    missionsClaimed,
    mysteryBoxOpened,
    scratchCardScratched,
    weeklyPrizesClaimed,
    challengeCompleted,
    activeUsersWeek,
    totalUsers,
  ] = await Promise.all([
    logs.countDocuments({ type: "mission_claim", createdAt: { $gte: weekAgo } }),
    logs.countDocuments({ type: "mystery_box", createdAt: { $gte: weekAgo } }),
    logs.countDocuments({ type: "scratch_card", createdAt: { $gte: weekAgo } }),
    logs.countDocuments({ type: "weekly_leaderboard_prize", createdAt: { $gte: weekAgo } }),
    logs.countDocuments({ type: "weekly_challenge", createdAt: { $gte: weekAgo } }),
    (async () => {
      const orders = await otpOrdersCol();
      const res = await orders.distinct("token", { createdAt: { $gte: weekAgo } });
      return res.length;
    })(),
    (await usersCol()).countDocuments({}),
  ]);

  // Reward totals
  const rewardPipeline = [
    { $match: { type: { $in: ["mission_claim", "mystery_box", "scratch_card", "weekly_leaderboard_prize", "weekly_challenge"] }, createdAt: { $gte: monthAgo } } },
    { $group: { _id: "$type", total: { $sum: "$amount" } } },
  ];
  const rewardTotals = await logs.aggregate(rewardPipeline).toArray();
  const rewardMap = {};
  for (const r of rewardTotals) rewardMap[r._id] = r.total;

  return NextResponse.json({
    weekly: {
      missionsClaimed,
      mysteryBoxOpened,
      scratchCardScratched,
      weeklyPrizesClaimed,
      challengeCompleted,
      activeUsersWeek,
    },
    totalUsers,
    rewardMap,
    asOf: now.toISOString(),
  });
}
