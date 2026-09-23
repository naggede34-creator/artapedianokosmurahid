import { NextResponse } from "next/server";
import { usersCol, balanceLogsCol } from "@/lib/db";
import { mergeLegacyPoints } from "@/lib/loyalty";

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
  const { token, itemId } = await req.json().catch(() => ({}));
  if (!token || !itemId) return NextResponse.json({ error: "Data tidak lengkap." }, { status: 400 });

  const item = SHOP_ITEMS[itemId];
  if (!item) return NextResponse.json({ error: "Item tidak ditemukan." }, { status: 404 });

  const users = await usersCol();
  const user = await users.findOne({ token });
  if (!user) return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });

  // Pindahkan dulu poin yang terlanjur tersimpan di field lama, supaya poin
  // dari Misi dan Mystery Box ikut terhitung di sini.
  await mergeLegacyPoints(token);

  // Pemotongan poin dan syarat cukupnya dikerjakan dalam SATU operasi.
  // Versi lama membaca poin dulu, memeriksanya, lalu memotong di langkah
  // terpisah — dua penukaran yang datang bersamaan sama-sama lolos
  // pemeriksaan dan poinnya terpotong dua kali.
  const claimed = await users.findOneAndUpdate(
    { token, points: { $gte: item.pointsCost } },
    { $inc: { points: -item.pointsCost } },
    { returnDocument: "after" }
  );

  if (!claimed) {
    const kini = await users.findOne({ token }, { projection: { points: 1 } });
    const punya = kini?.points || 0;
    return NextResponse.json(
      { error: `Poin tidak cukup. Kamu punya ${punya} poin, butuh ${item.pointsCost} poin.` },
      { status: 400 }
    );
  }

  let newBalance = claimed.balance || 0;

  if (item.reward.type === "saldo") {
    const after = await users.findOneAndUpdate(
      { token },
      { $inc: { balance: item.reward.amount } },
      { returnDocument: "after" }
    );
    newBalance = after?.balance ?? newBalance;

    const logs = await balanceLogsCol();
    await logs.insertOne({
      token,
      type: "points_shop",
      amount: item.reward.amount,
      balanceAfter: newBalance,
      title: `Tukar poin · ${itemId}`,
      note: `Tukar Poin: ${itemId} (${item.pointsCost} poin)`,
      createdAt: new Date()
    });
  }

  return NextResponse.json({
    ok: true,
    reward: item.reward,
    pointsSpent: item.pointsCost,
    pointsLeft: claimed.points || 0,
    newBalance
  });
}
