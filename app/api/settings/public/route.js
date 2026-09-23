import { NextResponse } from "next/server";
import { getSettings, depositLimits, depositDisplay } from "@/lib/settings";
import { PROVIDER_KEYS, DEPOSIT_PROVIDERS } from "@/lib/paymentProviders";
import { warungNokosConfigured } from "@/lib/warungnokos";
import { rumahOtpConfigured } from "@/lib/rumahotp";

export const dynamic = "force-dynamic";

const CHANNELS = () => ({
  channelInfo: process.env.TELEGRAM_CHANNEL_1 || "https://t.me/kkaelnokosmurah"
});

export async function GET() {
  const limits = depositLimits();
  try {
    const settings = await getSettings();
    const { csUsername, maintenance, maintenanceMsg, maintenanceTitle, maintenanceButtonLabel, maintenanceButtonUrl, depositProviders, depositFeePercent, heroChars } = settings;
    const providers = { ...depositProviders };
    if (!warungNokosConfigured()) providers.warungnokos = false;
    if (rumahOtpConfigured()) {
      if (providers.rumahotp === undefined || providers.rumahotp === null) providers.rumahotp = true;
    } else {
      providers.rumahotp = false;
    }
    return NextResponse.json({
      maintenance: !!maintenance,
      csUsername: csUsername || "teatlas",
      maintenanceMsg,
      maintenanceTitle: maintenanceTitle || "Sedang Maintenance",
      maintenanceButtonLabel: maintenanceButtonLabel || "",
      maintenanceButtonUrl: maintenanceButtonUrl || "",
      depositProviders: providers,
      depositFeePercent,
      // Nama & label metode deposit yang diatur admin.
      depositMethods: PROVIDER_KEYS.map((k) => depositDisplay(settings, k)),
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
        warungnokos: warungNokosConfigured(),
        pakasir: true,
        rumahotp: rumahOtpConfigured()
      },
      depositFeePercent: { warungnokos: 0, pakasir: 0, rumahotp: 0.7 },
      depositMethods: DEPOSIT_PROVIDERS.map((p) => ({ key: p.key, name: p.name, badge: "", desc: p.desc, speed: p.speed })),
      csUsername: "teatlas",
      depositMin: limits.min,
      depositMax: limits.max,
      ...CHANNELS()
    });
  }
}
