import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { maintenance, maintenanceMsg } = await getSettings();
    return NextResponse.json({
      maintenance: !!maintenance,
      maintenanceMsg,
      // Link channel info & grup diskusi Telegram, dipakai tombol CS di semua halaman.
      // Bisa diubah tanpa deploy ulang lewat environment variable di Vercel.
      channelInfo: process.env.TELEGRAM_CHANNEL_1 || "https://t.me/kkaelnokosmurah",
      channelGroup: process.env.TELEGRAM_CHANNEL_2 || "https://t.me/diskusiduniotp"
    });
  } catch (err) {
    console.error(err);
    // Kalau DB lagi bermasalah, jangan sampai malah mengunci seluruh web.
    return NextResponse.json({
      maintenance: false,
      channelInfo: process.env.TELEGRAM_CHANNEL_1 || "https://t.me/kkaelnokosmurah",
      channelGroup: process.env.TELEGRAM_CHANNEL_2 || "https://t.me/diskusiduniotp"
    });
  }
}
