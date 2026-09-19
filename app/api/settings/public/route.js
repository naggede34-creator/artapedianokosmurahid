import { NextResponse } from "next/server";
import { getSettings, depositLimits } from "@/lib/settings";
import { simuruConfigured } from "@/lib/simuru";
import { rumahOtpConfigured } from "@/lib/rumahotp";

export const dynamic = "force-dynamic";

const CHANNELS = () => ({
  channelInfo: process.env.TELEGRAM_CHANNEL_1 || "https://t.me/kkaelnokosmurah",
  channelGroup: process.env.TELEGRAM_CHANNEL_2 || "https://t.me/diskusiduniotp"
});

export async function GET() {
  const limits = depositLimits();
  try {
    const { maintenance, maintenanceMsg, depositProviders, depositFeePercent, smm, heroChars } = await getSettings();
    const providers = { ...depositProviders };
    if (!simuruConfigured()) providers.simuru = false;
    // Aktifkan rumahotp otomatis jika API key tersedia dan admin belum set eksplisit
    if (providers.rumahotp === undefined && rumahOtpConfigured()) providers.rumahotp = true;
    return NextResponse.json({
      maintenance: !!maintenance,
      maintenanceMsg,
      depositProviders: providers,
      depositFeePercent,
      depositMin: limits.min,
      depositMax: limits.max,
      smmEnabled: Boolean(smm?.enabled) && simuruConfigured(),
      heroChars: heroChars || [],
      ...CHANNELS()
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({
      maintenance: false,
      depositProviders: {
        simuru: simuruConfigured(),
        pakasir: true,
        rumahotp: rumahOtpConfigured()
      },
      depositFeePercent: { simuru: 0, pakasir: 0, rumahotp: 0.7 },
      depositMin: limits.min,
      depositMax: limits.max,
      smmEnabled: false,
      ...CHANNELS()
    });
  }
}
