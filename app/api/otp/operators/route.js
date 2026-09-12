import { NextResponse } from "next/server";
import { getOperators } from "@/lib/rumahotp";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const country = searchParams.get("country");
    const providerId = searchParams.get("provider_id");
    if (!country || !providerId) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const data = await getOperators(process.env.RUMAHOTP_APIKEY, country, providerId);
    return NextResponse.json({ items: data.data || data || [] });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal mengambil daftar operator." }, { status: 500 });
  }
}
