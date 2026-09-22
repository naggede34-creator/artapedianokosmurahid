import { NextResponse } from "next/server";
import { rumahOtpConfigured } from "@/lib/rumahotp";
import { simuruConfigured } from "@/lib/simuru";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Server mana saja yang bisa dipakai: API key terisi DAN tidak dimatikan admin.
export async function GET() {
  let toggles = {};
  try {
    const { otpServers } = await getSettings();
    for (const s of Array.isArray(otpServers) ? otpServers : []) toggles[s.id] = s.enabled !== false;
  } catch (err) {
    console.error("[otp/servers]", err?.message || err);
  }
  return NextResponse.json({
    available: {
      rumahotp: rumahOtpConfigured() && toggles.rumahotp !== false,
      simuru: simuruConfigured() && toggles.simuru !== false
    }
  });
}
