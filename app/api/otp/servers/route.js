import { NextResponse } from "next/server";
import { rumahOtpConfigured } from "@/lib/rumahotp";
import { warungNokosConfigured } from "@/lib/warungnokos";
import { dibananaConfigured } from "@/lib/dibanana";
import { getSettings, serverDisplay } from "@/lib/settings";
import { OTP_SERVERS } from "@/lib/otpServers";

export const dynamic = "force-dynamic";

// Apakah kredensial providernya sudah terisi. Server tanpa kredensial tidak
// pernah bisa dipakai walaupun admin menyalakannya.
function providerReady(key) {
  if (key === "rumahotp") return rumahOtpConfigured();
  if (key === "dibanana") return dibananaConfigured();
  if (key.startsWith("warungnokos")) return warungNokosConfigured();
  return false;
}

// Daftar server beserta nama, label, dan keterangan yang diatur admin, plus
// status ketersediaannya. Halaman beli nokos memakai ini sebagai sumber utama
// supaya perubahan dari dashboard admin langsung terlihat tanpa deploy ulang.
export async function GET() {
  let settings = null;
  try {
    settings = await getSettings();
  } catch (err) {
    console.error("[otp/servers]", err?.message || err);
  }

  const available = {};
  const items = OTP_SERVERS.map((s) => {
    const d = settings
      ? serverDisplay(settings, s.key)
      : { key: s.key, name: s.name, badge: s.badge, desc: s.desc, provider: s.provider, enabled: true, offlineMsg: "" };
    available[s.key] = providerReady(s.key) && d.enabled;
    return {
      key: s.key,
      name: d.name,
      badge: d.badge,
      desc: d.desc,
      provider: d.provider || s.provider,
      available: available[s.key],
      offlineMsg: d.offlineMsg || ""
    };
  });

  return NextResponse.json({ available, items });
}
