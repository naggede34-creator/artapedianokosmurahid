import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { listCountries } from "@/lib/otpCatalog";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("service_id");
  const server = searchParams.get("server") || "rumahotp";
  if (!serviceId) return NextResponse.json({ error: "service_id wajib diisi." }, { status: 400 });

  try {
    const settings = await getSettings();
    return NextResponse.json({ items: await listCountries(settings, server, serviceId) });
  } catch (err) {
    console.error("[otp/countries]", err?.response?.data || err?.message || err);
    return NextResponse.json({ error: err?.message || "Gagal mengambil daftar negara." }, { status: 502 });
  }
}
