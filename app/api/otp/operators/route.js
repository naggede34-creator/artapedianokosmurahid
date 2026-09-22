import { NextResponse } from "next/server";
import { getOperators } from "@/lib/rumahotp";
import { isWarungNokosServer } from "@/lib/warungnokos";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const server = searchParams.get("server") || "rumahotp";

  // Selain RumahOTP tidak ada pemilihan operator; ordernya memakai operator "any".
  if (isWarungNokosServer(server) || server === "dibanana") return NextResponse.json({ items: [] });

  try {
    const country = searchParams.get("country");
    const providerId = searchParams.get("provider_id");
    if (!country || !providerId) return NextResponse.json({ error: "Parameter kurang." }, { status: 400 });

    const data = await getOperators(process.env.RUMAHOTP_APIKEY, country, providerId);
    return NextResponse.json({ items: data.data || data || [] });
  } catch (err) {
    console.error("[otp/operators]", err?.response?.data || err?.message || err);
    // Gagal ambil operator bukan alasan menggagalkan pembelian.
    return NextResponse.json({ items: [] });
  }
}
