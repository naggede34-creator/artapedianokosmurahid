import { NextResponse } from "next/server";
import { usersCol, balanceLogsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

const WELCOME_BONUS = 500;

export async function POST(req) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token kosong." }, { status: 400 });

  const users = await usersCol();
  const user = await users.findOne({ token });
  if (!user) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });

  if (user.welcomeBonusGiven) {
    return NextResponse.json({ alreadyReceived: true, bonus: WELCOME_BONUS });
  }

  await users.updateOne({ token }, { $inc: { balance: WELCOME_BONUS }, $set: { welcomeBonusGiven: true } });

  const logs = await balanceLogsCol();
  await logs.insertOne({
    token,
    type: "welcome_bonus",
    amount: WELCOME_BONUS,
    note: "Bonus selamat datang untuk pengguna baru",
    createdAt: new Date()
  });

  return NextResponse.json({ ok: true, alreadyReceived: false, bonus: WELCOME_BONUS });
}
