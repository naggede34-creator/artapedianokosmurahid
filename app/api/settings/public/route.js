import { NextResponse } from "next/server";
import { getSettings, depositLimits } from "@/lib/settings";
import { ruangOtpConfigured } from "@/lib/ruangotp";
import { rumahOtpConfigured } from "@/lib/rumahotp";

export const dynamic = "force-dynamic";

const CHANNELS = () => ({
  channelInfo: process.env.TELEGRAM_CHANNEL_1 || "https://t.me/kkaelnokosmurah"
});

export async function GET() {
  const limits = depositLimits();
  try {
    const { maintenance, maintenanceMsg, maintenanceButtonLabel, maintenanceButtonUrl, depositProviders, depositFeePercent, heroChars } = await getSettings();
    const providers = { ...depositProviders };
    if (!ruangOtpConfigured()) {
      providers.ruangotp_s1 = false;
      providers.ruangotp_s2 = false;
    }
    if (rumahOtpConfigured()) {
      if (providers.rumahotp === undefined || providers.rumahotp === null) providers.rumahotp = true;
    } else {
      providers.rumahotp = false;
    }
    return NextResponse.json({
      maintenance: !!maintenance,
      maintenanceMsg,
      maintenanceButtonLabel: maintenanceButtonLabel || "",
      maintenanceButtonUrl: maintenanceButtonUrl || "",
      depositProviders: providers,
      depositFeePercent,
      depositMin: limits.min,
      depositMax: limits.max,
      heroChars: heroChars || [],
      ...CHANNELS()
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({
      maintenance: false,
      depositProviders: {
        ruangotp_s1: ruangOtpConfigured(),
        ruangotp_s2: ruangOtpConfigured(),
        pakasir: true,
        rumahotp: rumahOtpConfigured()
      },
      depositFeePercent: { ruangotp_s1: 0, ruangotp_s2: 0, pakasir: 0, rumahotp: 0.7 },
      depositMin: limits.min,
      depositMax: limits.max,
      ...CHANNELS()
    });
  }
}
