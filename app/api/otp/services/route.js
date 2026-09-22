import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { listServices, serverEnabled } from "@/lib/otpCatalog";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const server = new URL(req.url).searchParams.get("server") || "rumahotp";
  try {
    const settings = await getSettings();
    if (!serverEnabled(settings, server)) {
      return NextResponse.json({ error: "Server ini sedang dinonaktifkan admin." }, { status: 503 });
    }
    return NextResponse.json({ items: await listServices(server) });
  } catch (err) {
    console.error("[otp/services]", err?.response?.data || err?.message || err);
    return NextResponse.json({ error: err?.message || "Gagal mengambil daftar layanan." }, { status: 502 });
  }
}
