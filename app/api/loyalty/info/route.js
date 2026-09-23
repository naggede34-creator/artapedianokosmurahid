import { NextResponse } from "next/server";
import { usersCol } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { resolveBadge, nextBadgeInfo, mergeLegacyPoints } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Kode akun kosong." }, { status: 400 });

    const users = await usersCol();
    // Pindahkan poin yang terlanjur tersimpan di field lama sebelum dibaca,
    // supaya angka yang dilihat user sudah termasuk poin dari Misi dan
    // Mystery Box.
    await mergeLegacyPoints(token);
    const user = await users.findOne({ token });
    if (!user) return NextResponse.json({ error: "Kode akun tidak ditemukan." }, { status: 404 });

    const settings = await getSettings();
    const thresholds = settings.loyalty.badgeThresholds;
    const totalSpent = user.totalSpent || 0;

    return NextResponse.json({
      points: user.points || 0,
      totalSpent,
      cashbackTotal: user.cashbackTotal || 0,
      badge: resolveBadge(totalSpent, thresholds),
      next: nextBadgeInfo(totalSpent, thresholds),
      badgeThresholds: thresholds,
      pointRupiahValue: settings.loyalty.pointRupiahValue,
      minRedeemPoints: settings.loyalty.minRedeemPoints,
      cashbackDepositPercent: settings.loyalty.cashbackDepositPercent,
      pointsPerRupiah: settings.loyalty.pointsPerRupiah
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
