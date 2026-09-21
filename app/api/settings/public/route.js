import { NextResponse } from "next/server";
import { getSettings, depositLimits } from "@/lib/settings";
import { simuruConfigured } from "@/lib/simuru";
import { rumahOtpConfigured } from "@/lib/rumahotp";
import { virtusimConfigured } from "@/lib/virtusim";

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
    if (!virtusimConfigured()) providers.virtusim = false;
    // Aktifkan rumahotp jika API key tersedia; nonaktifkan jika tidak ada key
    if (rumahOtpConfigured()) {
      if (providers.rumahotp === undefined || providers.rumahotp === null) providers.rumahotp = true;
    } else {
      providers.rumahotp = false;
    }
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
        rumahotp: rumahOtpConfigured(),
        virtusim: virtusimConfigured()
      },
      depositFeePercent: { simuru: 0, pakasir: 0, rumahotp: 0.7, virtusim: 0 },
      depositMin: limits.min,
      depositMax: limits.max,
      smmEnabled: false,
      ...CHANNELS()
    });
  }
}
