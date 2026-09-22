import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/apiKeyAuth";
import { getSettings } from "@/lib/settings";
import { listCountries, serverEnabled } from "@/lib/otpCatalog";

export const dynamic = "force-dynamic";

// Daftar negara + harga jual final (sell_price) untuk satu layanan di satu server.
// sell_price sudah termasuk markup, jadi itulah nominal yang akan dipotong.
export async function GET(req) {
  const { error } = await resolveApiKey(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("service_id") || searchParams.get("serviceId");
  const server = searchParams.get("server") || "rumahotp";
  if (!serviceId) return NextResponse.json({ error: "service_id is required." }, { status: 400 });

  try {
    const settings = await getSettings();
    if (!serverEnabled(settings, server)) {
      return NextResponse.json({ error: "This server is currently disabled." }, { status: 503 });
    }
    return NextResponse.json({ server, items: await listCountries(settings, server, serviceId) });
  } catch (err) {
    console.error("[v1/countries]", err?.message || err);
    return NextResponse.json({ error: "Failed to fetch countries." }, { status: 502 });
  }
}
