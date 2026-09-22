// Kirim info stok & harga nokos ke channel Telegram secara terjadwal.
//
// Cara panggil manual/eksternal (cron-job.org, UptimeRobot, dll):
//   GET https://domain-kamu.vercel.app/api/cron/stock-report?secret=ISI_CRON_SECRET
//
// Vercel Cron mengirim header Authorization: Bearer <CRON_SECRET>, jadi dua-duanya
// diterima. Daftar layanan bisa diubah lewat ?services=wa,tg,shopee
import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { buildStockReport, DEFAULT_REPORT_SERVICES } from "@/lib/stockReport";
import { stockReportNotif, sendTelegramChannelNotif } from "@/lib/telegram";
import { serverLabel } from "@/lib/otpServers";

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
  try {
    const raw = new URL(req.url).searchParams.get("services");
    const services = raw
      ? raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 12)
      : DEFAULT_REPORT_SERVICES;

    const settings = await getSettings();
    const groups = await buildStockReport(settings, services.length ? services : DEFAULT_REPORT_SERVICES);
    if (!groups.length) {
      return NextResponse.json({ ok: false, reason: "no-data" }, { status: 200 });
    }
    await sendTelegramChannelNotif(stockReportNotif(groups, { serverName: serverLabel }));
    return NextResponse.json({ ok: true, sent: groups.length });
  } catch (err) {
    console.error("[cron/stock-report]", err?.message || err);
    return NextResponse.json({ ok: false, error: "Gagal mengirim laporan stok." }, { status: 500 });
  }
}
