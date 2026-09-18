import { NextResponse } from "next/server";
import { missionsCol, otpOrdersCol, depositsCol, dailyActivitiesCol, usersCol } from "@/lib/db";

export const dynamic = "force-dynamic";

const WIB = "Asia/Jakarta";
function today() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: WIB });
}
function thisWeek() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: WIB }));
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().slice(0, 10);
}

const DAILY_MISSIONS = [
  { id: "daily_checkin", type: "daily", name: "Check-in Harian", desc: "Lakukan check-in hari ini", icon: "🗓️", reward: { type: "points", amount: 50 }, target: 1 },
  { id: "daily_otp1", type: "daily", name: "Beli 1 Nokos", desc: "Beli 1 nomor OTP hari ini", icon: "📱", reward: { type: "points", amount: 150 }, target: 1 },
  { id: "daily_otp3", type: "daily", name: "Beli 3 Nokos", desc: "Beli 3 nomor OTP hari ini", icon: "🔥", reward: { type: "saldo", amount: 500 }, target: 3 },
  { id: "daily_deposit", type: "daily", name: "Isi Saldo", desc: "Lakukan deposit hari ini", icon: "💳", reward: { type: "points", amount: 300 }, target: 1 },
  { id: "daily_login", type: "daily", name: "Login Hari Ini", desc: "Kunjungi dashboard hari ini", icon: "⭐", reward: { type: "points", amount: 25 }, target: 1 },
];

const WEEKLY_MISSIONS = [
  { id: "weekly_otp10", type: "weekly", name: "Pemborong Nokos", desc: "Beli 10 nomor OTP minggu ini", icon: "🏆", reward: { type: "saldo", amount: 2000 }, target: 10 },
  { id: "weekly_deposit3", type: "weekly", name: "Rutin Isi Saldo", desc: "Deposit 3x minggu ini", icon: "💰", reward: { type: "saldo", amount: 1500 }, target: 3 },
  { id: "weekly_streak7", type: "weekly", name: "Check-in 7 Hari", desc: "Check-in setiap hari minggu ini", icon: "📅", reward: { type: "saldo", amount: 3000 }, target: 7 },
];

async function getProgress(token) {
  const d = today();
  const w = thisWeek();
  const tEnc = token;

  const [missions, otpOrders, deposits, activities] = await Promise.all([
    (await missionsCol()).find({ token: tEnc, date: { $in: [d, w] } }).toArray(),
    (await otpOrdersCol()).find({
      token: tEnc,
      status: "success",
      createdAt: { $gte: new Date(d) }
    }).toArray(),
    (await depositsCol()).find({
      token: tEnc,
      status: "paid",
      createdAt: { $gte: new Date(d) }
    }).toArray(),
    (await dailyActivitiesCol()).find({ token: tEnc, date: d }).toArray(),
  ]);

  const missionMap = {};
  missions.forEach((m) => { missionMap[m.missionId] = m; });

  const todayOtp = otpOrders.length;
  const todayDeposit = deposits.length;
  const checkedIn = activities.some((a) => a.type === "checkin");

  // Weekly OTP count
  const weekStart = new Date(w);
  const [weeklyOtp, weeklyDeposits, weeklyCheckins] = await Promise.all([
    (await otpOrdersCol()).countDocuments({ token: tEnc, status: "success", createdAt: { $gte: weekStart } }),
    (await depositsCol()).countDocuments({ token: tEnc, status: "paid", createdAt: { $gte: weekStart } }),
    (await dailyActivitiesCol()).countDocuments({ token: tEnc, type: "checkin", createdAt: { $gte: weekStart } }),
  ]);

  function buildMission(def) {
    const record = missionMap[def.id];
    let progress = 0;
    if (def.id === "daily_otp1" || def.id === "daily_otp3") progress = Math.min(def.target, todayOtp);
    else if (def.id === "daily_deposit") progress = Math.min(def.target, todayDeposit);
    else if (def.id === "daily_checkin") progress = checkedIn ? 1 : 0;
    else if (def.id === "daily_login") progress = 1; // always done if they opened app
    else if (def.id === "weekly_otp10") progress = Math.min(def.target, weeklyOtp);
    else if (def.id === "weekly_deposit3") progress = Math.min(def.target, weeklyDeposits);
    else if (def.id === "weekly_streak7") progress = Math.min(def.target, weeklyCheckins);

    return {
      ...def,
      progress,
      completed: progress >= def.target,
      claimed: !!record?.claimed,
      date: def.type === "daily" ? d : w,
    };
  }

  return {
    daily: DAILY_MISSIONS.map(buildMission),
    weekly: WEEKLY_MISSIONS.map(buildMission),
  };
}

export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token diperlukan." }, { status: 400 });
  const data = await getProgress(token);
  return NextResponse.json(data);
}
