import { NextResponse } from "next/server";
import { usersCol, balanceLogsCol } from "@/lib/db";

export const dynamic = "force-dynamic";

const SHOP_ITEMS = {
  v500:       { pointsCost: 180, reward: { type: "saldo", amount: 500 } },
  v1000:      { pointsCost: 340, reward: { type: "saldo", amount: 1000 } },
  v2000:      { pointsCost: 650, reward: { type: "saldo", amount: 2000 } },
  v5000:      { pointsCost: 1500, reward: { type: "saldo", amount: 5000 } },
  spin1:      { pointsCost: 80,  reward: { type: "spin", amount: 1 } },
  discount10: { pointsCost: 120, reward: { type: "discount", amount: 10 } },
  cashback5:  { pointsCost: 200, reward: { type: "cashback", amount: 5 } },
};

export async function POST(req) {
  const { token, itemId } = await req.json();
  if (!token || !itemId) return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 });

  const item = SHOP_ITEMS[itemId];
  if (!item) return NextResponse.json({ error: "Item tidak ditemukan." }, { status: 404 });

  const users = await usersCol();
  const user = await users.findOne({ token });
  if (!user) return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });

  const currentPoints = user.loyalty?.points || 0;
  if (currentPoints < item.pointsCost) {
    return NextResponse.json({ error: `Poin tidak cukup. Kamu punya ${currentPoints} poin, butuh ${item.pointsCost} poin.` }, { status: 400 });
  }

  await users.updateOne({ token }, { $inc: { "loyalty.points": -item.pointsCost } });

  if (item.reward.type === "saldo") {
    await users.updateOne({ token }, { $inc: { balance: item.reward.amount } });
    const logs = await balanceLogsCol();
    await logs.insertOne({
      token, type: "points_shop", amount: item.reward.amount,
      note: `Tukar Poin: ${itemId} (${item.pointsCost} poin)`, createdAt: new Date()
    });
  }

  const updatedUser = await users.findOne({ token });
  return NextResponse.json({
    ok: true,
    reward: item.reward,
    pointsSpent: item.pointsCost,
    pointsLeft: updatedUser?.loyalty?.points || 0,
    newBalance: updatedUser?.balance || 0,
  });
}
