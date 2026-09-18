import { NextResponse } from "next/server";
import { getOperators } from "@/lib/rumahotp";
import { getApiKeys } from "@/lib/apiKeys";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get("country");
    const providerId = searchParams.get("provider_id");
    if (!country || !providerId) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const { rumahOtp } = await getApiKeys();
    const data = await getOperators(rumahOtp, country, providerId);
    return NextResponse.json({ items: data.data || data || [] });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal mengambil daftar operator." }, { status: 500 });
  }
}
