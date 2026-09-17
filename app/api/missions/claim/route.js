import { NextResponse } from "next/server";
import { missionsCol, usersCol, balanceLogsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

const WIB = "Asia/Jakarta";
function today() { return new Date().toLocaleDateString("sv-SE", { timeZone: WIB }); }
function thisWeek() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: WIB }));
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().slice(0, 10);
}

const ALL_MISSIONS = {
  daily_checkin: { reward: { type: "points", amount: 50 }, target: 1 },
  daily_otp1: { reward: { type: "points", amount: 150 }, target: 1 },
  daily_otp3: { reward: { type: "saldo", amount: 500 }, target: 3 },
  daily_deposit: { reward: { type: "points", amount: 300 }, target: 1 },
  daily_login: { reward: { type: "points", amount: 25 }, target: 1 },
  weekly_otp10: { reward: { type: "saldo", amount: 2000 }, target: 10 },
  weekly_deposit3: { reward: { type: "saldo", amount: 1500 }, target: 3 },
  weekly_streak7: { reward: { type: "saldo", amount: 3000 }, target: 7 },
};

export async function POST(req) {
  const { token, missionId, progress } = await req.json();
  if (!token || !missionId) return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 });

  const def = ALL_MISSIONS[missionId];
  if (!def) return NextResponse.json({ error: "Misi tidak ditemukan." }, { status: 404 });

  const isWeekly = missionId.startsWith("weekly_");
  const date = isWeekly ? thisWeek() : today();

  const col = await missionsCol();
  const existing = await col.findOne({ token, missionId, date });
  if (existing?.claimed) return NextResponse.json({ error: "Hadiah misi sudah diklaim." }, { status: 409 });

  if (!progress || progress < def.target) {
    return NextResponse.json({ error: "Misi belum selesai." }, { status: 400 });
  }

  await col.updateOne(
    { token, missionId, date },
    { $set: { claimed: true, claimedAt: new Date() } },
    { upsert: true }
  );

  const users = await usersCol();
  const { reward } = def;

  if (reward.type === "saldo") {
    await users.updateOne({ token }, { $inc: { balance: reward.amount } });
    const logs = await balanceLogsCol();
    await logs.insertOne({
      token, type: "mission_reward", amount: reward.amount,
      note: `Hadiah misi: ${missionId}`, createdAt: new Date()
    });
  } else if (reward.type === "points") {
    await users.updateOne({ token }, { $inc: { "loyalty.points": reward.amount } });
  }

  return NextResponse.json({ ok: true, reward });
}
