// Pencairan hadiah Pembeli Terbanyak mingguan.
//
// Cara panggil manual/eksternal:
//   GET https://domain-kamu.vercel.app/api/cron/weekly-leaderboard?secret=ISI_CRON_SECRET
//
// DIJADWALKAN HARIAN, bukan mingguan. Alasannya: paket Vercel Hobby cuma
// mengizinkan cron sekali sehari, dan cron yang hanya jalan tiap Senin akan
// melewatkan pembayaran seminggu penuh kalau kebetulan gagal sekali. Karena
// settleWeek mengklaim penandanya secara atomik per minggu, memanggilnya tiap
// hari aman: hari-hari sesudah minggu itu lunas tidak melakukan apa-apa.
import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { settleWeek } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // belum diset = terbuka, cocok untuk setup awal saja
  const auth = req.headers.get("authorization") || "";
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

export async function GET(req) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const settings = await getSettings();
  if (settings.leaderboard?.enabled === false || settings.leaderboard?.autoPay === false) {
    return NextResponse.json({ ok: true, skipped: "Pencairan otomatis dimatikan admin." });
  }

  try {
    const hasil = await settleWeek({ offset: -1, alasan: "cron" });
    return NextResponse.json(hasil);
  } catch (err) {
    console.error("[cron/weekly-leaderboard]", err?.message || err);
    return NextResponse.json({ error: err?.message || "Gagal mencairkan hadiah." }, { status: 500 });
  }
}
