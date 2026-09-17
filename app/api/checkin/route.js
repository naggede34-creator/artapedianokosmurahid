import { NextResponse } from "next/server";
import { usersCol, dailyActivitiesCol } from "@/lib/db";

export const dynamic = "force-dynamic";

function todayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token kosong." }, { status: 400 });

  const acts = await dailyActivitiesCol();
  const today = todayStr();
  const existing = await acts.findOne({ token, type: "checkin", date: today });

  // Hitung streak
  let streak = 1;
  if (existing) {
    streak = existing.streak || 1;
  } else {
    const yday = await acts.findOne({ token, type: "checkin", date: yesterday() });
    if (yday) streak = (yday.streak || 1) + 1;
    else streak = 1;
  }

  return NextResponse.json({ alreadyDone: !!existing, streak, points: streakPoints(streak) });
}

function streakPoints(streak) {
  if (streak >= 30) return 30;
  if (streak >= 14) return 20;
  if (streak >= 7) return 15;
  if (streak >= 3) return 10;
  return 5;
}

export async function POST(req) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token kosong." }, { status: 400 });

  const users = await usersCol();
  const user = await users.findOne({ token });
  if (!user) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });

  const acts = await dailyActivitiesCol();
  const today = todayStr();
  const existing = await acts.findOne({ token, type: "checkin", date: today });
  if (existing) return NextResponse.json({ alreadyDone: true, streak: existing.streak, points: streakPoints(existing.streak) });

  const yday = await acts.findOne({ token, type: "checkin", date: yesterday() });
  const streak = yday ? (yday.streak || 1) + 1 : 1;
  const points = streakPoints(streak);

  await acts.insertOne({ token, type: "checkin", date: today, streak, points, createdAt: new Date() });
  await users.updateOne({ token }, { $inc: { points } });

  return NextResponse.json({ ok: true, alreadyDone: false, streak, points });
}
