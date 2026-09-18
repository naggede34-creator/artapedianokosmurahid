import { NextResponse } from "next/server";
import { getSmmPlatforms, simuruConfigured } from "@/lib/simuru";
import { getSettings } from "@/lib/settings";
import { sellPrice } from "@/lib/smmService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { smm } = await getSettings();
    if (!smm?.enabled || !await simuruConfigured()) {
      return NextResponse.json({ enabled: false, items: [] });
    }
    const list = await getSmmPlatforms();
    return NextResponse.json({
      enabled: true,
      items: list
        .filter((p) => p?.platform)
        .map((p) => ({
          platform: p.platform,
          total: Number(p.total) || 0,
          minPrice: sellPrice(p.min_price, smm.markupPercent),
          pricePer: Number(p.price_per) || 1000
        }))
        .sort((a, b) => b.total - a.total)
    });
  } catch (err) {
    console.error("[smm/platforms]", err?.message);
    return NextResponse.json({ error: "Daftar platform belum bisa dimuat. Coba lagi sebentar." }, { status: 502 });
  }
}
