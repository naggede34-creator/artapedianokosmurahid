import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSettings } from "@/lib/settings";
import { buildStockReport, DEFAULT_REPORT_SERVICES } from "@/lib/stockReport";
import { stockReportNotif, sendTelegramChannelNotif } from "@/lib/telegram";
import { serverLabel } from "@/lib/otpServers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseServices(input) {
  if (!input) return DEFAULT_REPORT_SERVICES;
  const list = (Array.isArray(input) ? input : String(input).split(","))
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
  return list.length ? list : DEFAULT_REPORT_SERVICES;
}

// Preview: admin bisa lihat isi laporan sebelum mengirim ke channel.
export async function GET(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const services = parseServices(new URL(req.url).searchParams.get("services"));
    const settings = await getSettings();
    const groups = await buildStockReport(settings, services);
    return NextResponse.json({ services, groups, text: stockReportNotif(groups, { serverName: serverLabel }) });
  } catch (err) {
    console.error("[admin/stock-report:preview]", err?.message || err);
    return NextResponse.json({ error: "Gagal menyusun laporan stok." }, { status: 502 });
  }
}

export async function POST(req) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const services = parseServices(body.services);
    const settings = await getSettings();
    if (!settings.telegramChannelId && !process.env.TELEGRAM_CHANNEL_ID) {
      return NextResponse.json(
        { error: "Channel ID Telegram belum diisi. Isi dulu di Pengaturan Situs." },
        { status: 400 }
      );
    }
    const groups = await buildStockReport(settings, services);
    if (!groups.length) {
      return NextResponse.json({ error: "Tidak ada data stok yang bisa diambil dari provider." }, { status: 502 });
    }
    await sendTelegramChannelNotif(stockReportNotif(groups, { serverName: serverLabel }));
    return NextResponse.json({ ok: true, sent: groups.length, services });
  } catch (err) {
    console.error("[admin/stock-report:send]", err?.message || err);
    return NextResponse.json({ error: "Gagal mengirim laporan stok." }, { status: 502 });
  }
}
