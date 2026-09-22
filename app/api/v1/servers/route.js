import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/apiKeyAuth";
import { getSettings } from "@/lib/settings";
import { OTP_SERVERS } from "@/lib/otpServers";

export const dynamic = "force-dynamic";

// Daftar server nokos yang sedang aktif. Server yang dimatikan admin tidak
// muncul di sini dan akan ditolak oleh /v1/order.
export async function GET(req) {
  const { error } = await resolveApiKey(req);
  if (error) return error;

  const settings = await getSettings();
  const list = Array.isArray(settings.otpServers) ? settings.otpServers : [];
  const items = OTP_SERVERS.filter((s) => list.find((x) => x.id === s.key)?.enabled !== false).map((s) => ({
    server: s.key,
    name: s.name,
    badge: s.badge,
    provider: s.provider,
    description: s.desc
  }));
  return NextResponse.json({ items });
}
