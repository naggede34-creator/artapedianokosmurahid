import { NextResponse } from "next/server";
import { getSettings, depositLimits } from "@/lib/settings";
import { simuruConfigured } from "@/lib/simuru";

export const dynamic = "force-dynamic";

const CHANNELS = () => ({
  channelInfo: process.env.TELEGRAM_CHANNEL_1 || "https://t.me/kkaelnokosmurah",
  channelGroup: process.env.TELEGRAM_CHANNEL_2 || "https://t.me/diskusiduniotp"
});

export async function GET() {
  const limits = depositLimits();
  try {
    const { maintenance, maintenanceMsg, depositProviders, depositFeePercent, smm } = await getSettings();
    const providers = { ...depositProviders };
    if (!simuruConfigured()) providers.simuru = false;
    return NextResponse.json({
      maintenance: !!maintenance,
      maintenanceMsg,
      depositProviders: providers,
      depositFeePercent,
      depositMin: limits.min,
      depositMax: limits.max,
      smmEnabled: Boolean(smm?.enabled) && simuruConfigured(),
      ...CHANNELS()
    });
  } catch (err) {
    console.error(err);
    // Kalau DB bermasalah, jangan sampai malah mengunci seluruh web.
    return NextResponse.json({
      maintenance: false,
      depositProviders: { simuru: simuruConfigured(), pakasir: true, rumahotp: false },
      depositFeePercent: { simuru: 0, pakasir: 0, rumahotp: 0.7 },
      depositMin: limits.min,
      depositMax: limits.max,
      smmEnabled: false,
      ...CHANNELS()
    });
  }
}
