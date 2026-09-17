import { NextResponse } from "next/server";
import { getSmmKinds } from "@/lib/simuru";
import { getSettings } from "@/lib/settings";
import { sellPrice } from "@/lib/smmService";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const platform = new URL(req.url).searchParams.get("platform") || "";
    if (!platform) return NextResponse.json({ error: "Platform wajib dipilih." }, { status: 400 });
    const { smm } = await getSettings();
    if (!smm?.enabled) return NextResponse.json({ items: [] });
    const list = await getSmmKinds(platform);
    return NextResponse.json({
      items: list
        .filter((k) => k?.kind)
        .map((k) => ({
          kind: k.kind,
          total: Number(k.total) || 0,
          minPrice: sellPrice(k.min_price, smm.markupPercent),
          speedLabel: k.speed_label || null,
          avgCompletion: k.avg_completion ?? null
        }))
    });
  } catch (err) {
    console.error("[smm/kinds]", err?.message);
    return NextResponse.json({ error: "Kategori belum bisa dimuat. Coba lagi sebentar." }, { status: 502 });
  }
}
