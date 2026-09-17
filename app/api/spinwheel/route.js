import { NextResponse } from "next/server";
import { usersCol, dailyActivitiesCol, balanceLogsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

function todayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

const PRIZES = [
  { type: "points", amount: 2,  label: "2 Poin",      color: "#45b7d1", weight: 25 },
  { type: "none",   amount: 0,  label: "Coba besok",  color: "#b2bec3", weight: 22 },
  { type: "points", amount: 5,  label: "5 Poin",      color: "#fd9644", weight: 20 },
  { type: "none",   amount: 0,  label: "Nasib...",    color: "#dfe6e9", weight: 18 },
  { type: "points", amount: 10, label: "10 Poin!",    color: "#a29bfe", weight: 8  },
  { type: "points", amount: 3,  label: "3 Poin",      color: "#55efc4", weight: 4  },
  { type: "points", amount: 50, label: "Jackpot! 50 Poin 🏆", color: "#ffd700", weight: 2 },
  { type: "saldo",  amount: 500,label: "Saldo +Rp500 💰", color: "#ff4757", weight: 1  },
];

function pickPrize() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PRIZES) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return PRIZES[0];
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token kosong." }, { status: 400 });

  const acts = await dailyActivitiesCol();
  const today = todayStr();
  const existing = await acts.findOne({ token, type: "spin", date: today });
  return NextResponse.json({
    alreadyPlayed: !!existing,
    prizes: PRIZES.map((p, i) => ({ ...p, index: i }))
  });
}

export async function POST(req) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token kosong." }, { status: 400 });

  const users = await usersCol();
  const user = await users.findOne({ token });
  if (!user) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });

  const acts = await dailyActivitiesCol();
  const today = todayStr();
  const existing = await acts.findOne({ token, type: "spin", date: today });
  if (existing) {
    return NextResponse.json({ alreadyPlayed: true, prize: existing.prize });
  }

  const prize = pickPrize();
  const prizeIndex = PRIZES.indexOf(prize);

  await acts.insertOne({ token, type: "spin", date: today, prize, prizeIndex, createdAt: new Date() });

  if (prize.type === "points" && prize.amount > 0) {
    await users.updateOne({ token }, { $inc: { points: prize.amount } });
  } else if (prize.type === "saldo" && prize.amount > 0) {
    await users.updateOne({ token }, { $inc: { balance: prize.amount } });
    const logs = await balanceLogsCol();
    await logs.insertOne({ token, type: "spinwheel", amount: prize.amount, note: "Hadiah Spin Wheel", createdAt: new Date() });
  }

  return NextResponse.json({ ok: true, alreadyPlayed: false, prize, prizeIndex, prizes: PRIZES.map((p, i) => ({ ...p, index: i })) });
}
