import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/apiKeyAuth";
import { getSettings } from "@/lib/settings";
import { listServices, serverEnabled } from "@/lib/otpCatalog";

export const dynamic = "force-dynamic";

// Daftar layanan untuk satu server. Tanpa ?server= akan memakai rumahotp
// supaya integrasi lama tetap jalan apa adanya.
export async function GET(req) {
  const { error } = await resolveApiKey(req);
  if (error) return error;

  const server = new URL(req.url).searchParams.get("server") || "rumahotp";
  try {
    const settings = await getSettings();
    if (!serverEnabled(settings, server)) {
      return NextResponse.json({ error: "This server is currently disabled." }, { status: 503 });
    }
    return NextResponse.json({ server, items: await listServices(server) });
  } catch (err) {
    console.error("[v1/services]", err?.message || err);
    return NextResponse.json({ error: "Failed to fetch services." }, { status: 502 });
  }
}
