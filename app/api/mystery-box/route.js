import { NextResponse } from "next/server";
import { mysteryBoxCol, usersCol, balanceLogsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

const PRIZES = [
  { id: "p50", type: "points", amount: 50, label: "+50 Poin", prob: 35 },
  { id: "p100", type: "points", amount: 100, label: "+100 Poin", prob: 25 },
  { id: "p200", type: "points", amount: 200, label: "+200 Poin", prob: 15 },
  { id: "s500", type: "saldo", amount: 500, label: "+Rp500 Saldo", prob: 12 },
  { id: "s1000", type: "saldo", amount: 1000, label: "+Rp1.000 Saldo", prob: 8 },
  { id: "s2000", type: "saldo", amount: 2000, label: "+Rp2.000 Saldo", prob: 4 },
  { id: "empty", type: "empty", amount: 0, label: "Coba lagi besok", prob: 1 },
];

function pickPrize() {
  const total = PRIZES.reduce((a, p) => a + p.prob, 0);
  let r = Math.random() * total;
  for (const p of PRIZES) {
    r -= p.prob;
    if (r <= 0) return p;
  }
  return PRIZES[0];
}

const WIB = "Asia/Jakarta";
function today() { return new Date().toLocaleDateString("sv-SE", { timeZone: WIB }); }

export async function POST(req) {
  const { token, orderId } = await req.json();
  if (!token || !orderId) return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 });

  const col = await mysteryBoxCol();

  const existing = await col.findOne({ token, orderId });
  if (existing) {
    return NextResponse.json({ already: true, prize: existing.prize });
  }

  // Max 3 mystery boxes per day
  const todayBoxes = await col.countDocuments({ token, date: today() });
  if (todayBoxes >= 3) {
    return NextResponse.json({ error: "Maksimal 3 mystery box per hari sudah dibuka.", limitReached: true }, { status: 429 });
  }

  const prize = pickPrize();

  await col.insertOne({ token, orderId, prize, date: today(), createdAt: new Date() });

  if (prize.type === "saldo" && prize.amount > 0) {
    await (await usersCol()).updateOne({ token }, { $inc: { balance: prize.amount } });
    const logs = await balanceLogsCol();
    await logs.insertOne({
      token, type: "mystery_box", amount: prize.amount,
      note: `Mystery Box: ${prize.label}`, createdAt: new Date()
    });
  } else if (prize.type === "points" && prize.amount > 0) {
    await (await usersCol()).updateOne({ token }, { $inc: { "loyalty.points": prize.amount } });
  }

  return NextResponse.json({ ok: true, prize });
}
