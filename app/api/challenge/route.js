import { NextResponse } from "next/server";
import { weeklyChallengesCol, otpOrdersCol, usersCol, balanceLogsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

const WIB = "Asia/Jakarta";
function thisWeek() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: WIB }));
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().slice(0, 10);
}

const WEEKLY_TARGET = 10;
const WEEKLY_REWARD = 5000;

export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token diperlukan." }, { status: 400 });

  const week = thisWeek();
  const weekStart = new Date(week);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [count, record] = await Promise.all([
    (await otpOrdersCol()).countDocuments({ token, status: "success", createdAt: { $gte: weekStart, $lt: weekEnd } }),
    (await weeklyChallengesCol()).findOne({ token, week }),
  ]);

  return NextResponse.json({
    week,
    target: WEEKLY_TARGET,
    reward: WEEKLY_REWARD,
    current: count,
    completed: count >= WEEKLY_TARGET,
    claimed: !!record?.claimed,
    percent: Math.min(100, Math.round((count / WEEKLY_TARGET) * 100)),
    endsAt: weekEnd.toISOString(),
  });
}

export async function POST(req) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token diperlukan." }, { status: 400 });

  const week = thisWeek();
  const weekStart = new Date(week);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const col = await weeklyChallengesCol();
  const existing = await col.findOne({ token, week });
  if (existing?.claimed) return NextResponse.json({ error: "Hadiah sudah diklaim." }, { status: 409 });

  const count = await (await otpOrdersCol()).countDocuments({ token, status: "success", createdAt: { $gte: weekStart, $lt: weekEnd } });
  if (count < WEEKLY_TARGET) return NextResponse.json({ error: `Tantangan belum selesai. Sudah ${count}/${WEEKLY_TARGET} nokos.` }, { status: 400 });

  await col.updateOne({ token, week }, { $set: { claimed: true, claimedAt: new Date() } }, { upsert: true });
  await (await usersCol()).updateOne({ token }, { $inc: { balance: WEEKLY_REWARD } });
  const logs = await balanceLogsCol();
  await logs.insertOne({ token, type: "weekly_challenge", amount: WEEKLY_REWARD, note: "Hadiah Tantangan Mingguan", createdAt: new Date() });

  return NextResponse.json({ ok: true, reward: WEEKLY_REWARD });
}
