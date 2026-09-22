import { NextResponse } from "next/server";
import { rumahOtpConfigured } from "@/lib/rumahotp";
import { otpmaniaConfigured, OTPMANIA_SERVERS } from "@/lib/otpmania";
import { dibananaConfigured } from "@/lib/dibanana";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Server mana saja yang bisa dipakai: API key terisi DAN tidak dimatikan admin.
export async function GET() {
  const toggles = {};
  try {
    const { otpServers } = await getSettings();
    for (const s of Array.isArray(otpServers) ? otpServers : []) toggles[s.id] = s.enabled !== false;
  } catch (err) {
    console.error("[otp/servers]", err?.message || err);
  }

  const available = { rumahotp: rumahOtpConfigured() && toggles.rumahotp !== false };
  for (const s of OTPMANIA_SERVERS) {
    available[s.id] = otpmaniaConfigured() && toggles[s.id] !== false;
  }
  available.dibanana = dibananaConfigured() && toggles.dibanana !== false;
  return NextResponse.json({ available });
}
