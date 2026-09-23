// Panel admin untuk Pembeli Terbanyak: lihat peringkat, cairkan hadiah minggu
// lalu sekarang juga, atau kirim hadiah khusus ke satu peringkat kapan saja.
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSettings } from "@/lib/settings";
import { weekRange, weekKey, topBuyers, prizesFrom, settleWeek, sendPrizeToRank } from "@/lib/leaderboard";
import { weeklyBuyerLeaderboardCol } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const offset = Number(new URL(req.url).searchParams.get("offset")) || 0;
  const settings = await getSettings();
  const { start, end } = weekRange(offset);
  const items = await topBuyers({ start, end, limit: 20 });
  const arsip = await (await weeklyBuyerLeaderboardCol()).findOne({ _id: weekKey(start) });

  return NextResponse.json({
    offset,
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    settled: Boolean(arsip?.settled),
    settledAt: arsip?.settledAt || null,
    settledBy: arsip?.settledBy || null,
    prizes: prizesFrom(settings),
    enabled: settings.leaderboard?.enabled !== false,
    autoPay: settings.leaderboard?.autoPay !== false,
    // Token asli ikut untuk admin — dia memang berhak tahu siapa yang dibayar.
    items
  });
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  if (body.action === "settle") {
    // paksa dipakai kalau admin sengaja mau membayar ulang minggu yang sudah
    // ditandai lunas. Sengaja butuh permintaan terpisah, bukan bawaan: bayar
    // dua kali karena salah tekan bukan hal yang bisa ditarik kembali.
    const hasil = await settleWeek({
      offset: Number(body.offset ?? -1),
      alasan: "admin",
      paksa: body.paksa === true
    });
    if (hasil.alreadySettled) {
      return NextResponse.json(
        { error: "Minggu itu sudah pernah dicairkan. Centang 'bayar ulang' kalau memang disengaja." },
        { status: 409 }
      );
    }
    return NextResponse.json(hasil);
  }

  if (body.action === "prize") {
    const hasil = await sendPrizeToRank({
      offset: Number(body.offset ?? 0),
      rank: body.rank,
      amount: body.amount,
      note: String(body.note || "").slice(0, 120)
    });
    if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: 400 });
    return NextResponse.json(hasil);
  }

  return NextResponse.json({ error: "Action tidak dikenal." }, { status: 400 });
}
