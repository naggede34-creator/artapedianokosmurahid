// Papan peringkat "Pembeli Terbanyak" minggu berjalan.
//
// Perhitungannya ada di lib/leaderboard.js, dipakai bersama cron mingguan dan
// panel admin. Dulu endpoint ini menulis pipeline-nya sendiri dan menyaring
// status: "completed" — padahal pesanan OTP yang berhasil berstatus "done",
// jadi papannya SELALU kosong tanpa satu pun pesan error.
//
// Hadiah TIDAK lagi diklaim manual. Pencairannya otomatis tiap minggu lewat
// /api/cron/weekly-leaderboard, karena hadiah yang harus diklaim sendiri
// berakhir hangus untuk orang yang tidak kebetulan membuka halaman ini.
import { NextResponse } from "next/server";
import { weeklyBuyerLeaderboardCol } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { weekRange, weekKey, topBuyers, prizesFrom } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    const settings = await getSettings();
    const { start, end } = weekRange(0);
    const prizes = prizesFrom(settings);

    const peringkat = await topBuyers({ start, end, limit: 20 });

    // Peringkat sendiri dicari SEBELUM tokennya dibuang dari jawaban.
    let userRank = null;
    let userPrize = null;
    let userCount = 0;
    if (token) {
      const punya = peringkat.find((p) => p.token === token);
      if (punya) {
        userRank = punya.rank;
        userCount = punya.count;
        userPrize = prizes.find((p) => p.rank === punya.rank)?.amount || 0;
      }
    }

    // Pemenang minggu lalu, supaya papannya tidak terasa kosong tiap Senin pagi
    // dan orang bisa melihat hadiahnya memang benar-benar dibagikan.
    const lalu = weekRange(-1);
    const arsip = await (await weeklyBuyerLeaderboardCol()).findOne({ _id: weekKey(lalu.start) });

    return NextResponse.json({
      enabled: settings.leaderboard?.enabled !== false,
      // Token tidak pernah ikut keluar — yang tampil cuma versi tersamarnya.
      items: peringkat.map((p) => ({
        rank: p.rank,
        maskedToken: p.maskedToken,
        count: p.count,
        totalSpent: p.totalSpent,
        prize: prizes.find((x) => x.rank === p.rank)?.amount || 0
      })),
      prizes,
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      userRank,
      userCount,
      userPrize,
      lastWeek: arsip?.winners?.length
        ? { weekKey: arsip._id, winners: arsip.winners.map((w) => ({ rank: w.rank, count: w.count, amount: w.amount })) }
        : null
    });
  } catch (err) {
    console.error("[leaderboard-weekly]", err?.message || err);
    return NextResponse.json({ enabled: true, items: [], prizes: [], userRank: null }, { status: 200 });
  }
}
