import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { sendTelegramNotif, pointsRedeemedNotif } from "@/lib/telegram";
import { logBalance } from "@/lib/ledger";

export async function POST(req) {
  try {
    const { token, points } = await req.json().catch(() => ({}));
    const pts = Math.floor(Number(points));
    if (!token) return NextResponse.json({ error: "Kode akun tidak valid." }, { status: 400 });
    if (!Number.isFinite(pts) || pts <= 0) {
      return NextResponse.json({ error: "Jumlah poin tidak valid." }, { status: 400 });
    }

    const settings = await getSettings();
    const minRedeem = settings.loyalty.minRedeemPoints || 1;
    if (pts < minRedeem) {
      return NextResponse.json({ error: `Minimal tukar ${minRedeem.toLocaleString("id-ID")} poin.` }, { status: 400 });
    }

    const rupiahValue = Math.floor(pts * (settings.loyalty.pointRupiahValue || 0));
    if (rupiahValue <= 0) {
      return NextResponse.json({ error: "Nilai tukar poin belum diatur, hubungi admin." }, { status: 400 });
    }

    const users = await usersCol();
    // Klaim atomik: hanya berhasil kalau poin user masih cukup SAAT update dieksekusi,
    // supaya dua klik/redeem bersamaan tidak sama-sama lolos memotong poin yang sama.
    const updated = await users.findOneAndUpdate(
      { token, points: { $gte: pts } },
      { $inc: { points: -pts, balance: rupiahValue } },
      { returnDocument: "after" }
    );
    if (!updated) {
      const current = await users.findOne({ token });
      if (!current) return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });
      return NextResponse.json({ error: "Poin kamu tidak cukup." }, { status: 400 });
    }

    await logBalance({
      token,
      type: "points",
      amount: rupiahValue,
      balanceAfter: updated.balance,
      title: `Tukar ${pts.toLocaleString("id-ID")} poin`
    });

    sendTelegramNotif(
      pointsRedeemedNotif({
        token,
        points: pts,
        rupiah: rupiahValue,
        newBalance: updated.balance,
        remainingPoints: updated.points
      })
    );

    return NextResponse.json({ ok: true, points: updated.points, balance: updated.balance, rupiah: rupiahValue });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal menukar poin." }, { status: 500 });
  }
}
