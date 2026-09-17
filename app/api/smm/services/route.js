import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { fetchAndCacheServices, toPublicService } from "@/lib/smmService";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const sp = new URL(req.url).searchParams;
    const platform = (sp.get("platform") || "").slice(0, 60);
    const kind = (sp.get("kind") || "").slice(0, 60);
    const q = (sp.get("q") || "").slice(0, 80);
    if (!platform) return NextResponse.json({ error: "Platform wajib dipilih." }, { status: 400 });

    const { smm } = await getSettings();
    if (!smm?.enabled) return NextResponse.json({ items: [] });

    const docs = await fetchAndCacheServices({ platform, kind, q });
    return NextResponse.json({ items: docs.map((d) => toPublicService(d, smm.markupPercent)) });
  } catch (err) {
    console.error("[smm/services]", err?.message);
    return NextResponse.json({ error: "Layanan belum bisa dimuat. Coba lagi sebentar." }, { status: 502 });
  }
}
