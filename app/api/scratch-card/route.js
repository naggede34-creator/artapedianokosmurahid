import { NextResponse } from "next/server";
import { scratchCardsCol, usersCol, balanceLogsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

const PRIZES = [
  { type: "saldo", amount: 500,   label: "Rp500",   rarity: "common",    weight: 40 },
  { type: "saldo", amount: 1000,  label: "Rp1.000", rarity: "common",    weight: 30 },
  { type: "saldo", amount: 2000,  label: "Rp2.000", rarity: "uncommon",  weight: 15 },
  { type: "saldo", amount: 5000,  label: "Rp5.000", rarity: "rare",      weight: 10 },
  { type: "saldo", amount: 10000, label: "Rp10.000",rarity: "epic",      weight:  4 },
  { type: "poin",  amount: 50,    label: "50 Poin",  rarity: "common",   weight: 20 },
  { type: "poin",  amount: 100,   label: "100 Poin", rarity: "uncommon", weight: 10 },
  { type: "none",  amount: 0,     label: "Coba lagi",rarity: "common",   weight: 25 },
];

function pickPrize() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PRIZES) { r -= p.weight; if (r <= 0) return p; }
  return PRIZES[0];
}

// GET ?token= — get pending scratch card for user
export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ card: null });
  const col = await scratchCardsCol();
  const card = await col.findOne({ token, scratched: false });
  return NextResponse.json({ card: card ? { id: card._id.toString(), depositId: card.depositId, createdAt: card.createdAt } : null });
}

// POST — scratch a card or issue one after deposit
export async function POST(req) {
  const body = await req.json();
  const { token, action, depositId, cardId } = body;
  if (!token) return NextResponse.json({ error: "token diperlukan" }, { status: 400 });

  const col = await scratchCardsCol();

  if (action === "issue") {
    // Issue a new scratch card after deposit — one card per deposit
    if (!depositId) return NextResponse.json({ error: "depositId diperlukan" }, { status: 400 });
    const existing = await col.findOne({ depositId });
    if (existing) return NextResponse.json({ ok: true, alreadyIssued: true });
    await col.insertOne({ token, depositId, scratched: false, createdAt: new Date() });
    return NextResponse.json({ ok: true });
  }

  if (action === "scratch") {
    const { ObjectId } = await import("mongodb");
    let oid;
    try { oid = new ObjectId(cardId); } catch { return NextResponse.json({ error: "cardId tidak valid" }, { status: 400 }); }
    const card = await col.findOne({ _id: oid, token, scratched: false });
    if (!card) return NextResponse.json({ error: "Kartu tidak ditemukan atau sudah digores" }, { status: 404 });

    const prize = pickPrize();
    await col.updateOne({ _id: oid }, { $set: { scratched: true, scratchedAt: new Date(), prize } });

    if (prize.type === "saldo" && prize.amount > 0) {
      const users = await usersCol();
      const logs = await balanceLogsCol();
      await users.updateOne({ token }, { $inc: { balance: prize.amount } });
      await logs.insertOne({ token, amount: prize.amount, type: "scratch_card", note: `Hadiah kartu gores: ${prize.label}`, createdAt: new Date() });
    } else if (prize.type === "poin" && prize.amount > 0) {
      const users = await usersCol();
      await users.updateOne({ token }, { $inc: { points: prize.amount } });
    }

    return NextResponse.json({ ok: true, prize });
  }

  return NextResponse.json({ error: "action tidak dikenal" }, { status: 400 });
}
