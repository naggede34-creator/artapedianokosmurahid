import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSettings, serverDisplay } from "@/lib/settings";
import { buildStockReport, DEFAULT_REPORT_SERVICES } from "@/lib/stockReport";
import { stockReportNotif, sendTelegramChannelNotif } from "@/lib/telegram";

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
    const channel = settings.telegramChannelId || process.env.TELEGRAM_CHANNEL_ID || "";
    return NextResponse.json({
      services,
      groups,
      // Ditampilkan di panel admin supaya ketahuan kalau Channel ID belum tersimpan.
      channel,
      channelSource: settings.telegramChannelId ? "pengaturan" : channel ? "env" : "kosong",
      botConfigured: Boolean(settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN),
      text: stockReportNotif(groups, { serverName: (key) => serverDisplay(settings, key).name })
    });
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
    const channel = settings.telegramChannelId || process.env.TELEGRAM_CHANNEL_ID || "";
    const botToken = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
    if (!channel) {
      return NextResponse.json(
        {
          error:
            "Channel ID Telegram masih kosong di pengaturan yang tersimpan. Buka Pengaturan Situs, isi Channel ID, lalu tekan Simpan Pengaturan Situs sampai muncul 'Pengaturan tersimpan.'"
        },
        { status: 400 }
      );
    }
    if (!botToken) {
      return NextResponse.json(
        { error: "Bot token Telegram belum diisi. Isi dulu di Pengaturan Situs." },
        { status: 400 }
      );
    }
    const groups = await buildStockReport(settings, services);
    if (!groups.length) {
      return NextResponse.json({ error: "Tidak ada data stok yang bisa diambil dari provider." }, { status: 502 });
    }
    await sendTelegramChannelNotif(stockReportNotif(groups, { serverName: (key) => serverDisplay(settings, key).name }));
    return NextResponse.json({ ok: true, sent: groups.length, services });
  } catch (err) {
    console.error("[admin/stock-report:send]", err?.message || err);
    return NextResponse.json({ error: "Gagal mengirim laporan stok." }, { status: 502 });
  }
}
