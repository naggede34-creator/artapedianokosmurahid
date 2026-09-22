import { NextResponse } from "next/server";
import { getCountries } from "@/lib/rumahotp";
import { getSimuruCountries } from "@/lib/simuru";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("service_id");
    const simuruCode = searchParams.get("simuru_code");
    if (!serviceId) return NextResponse.json({ error: "service_id wajib diisi." }, { status: 400 });

    const { markupPercent } = await getSettings();

    const isSimuruOnly = serviceId.startsWith("simuru:");
    const rumahotpCode = isSimuruOnly ? null : serviceId;
    const simCode = simuruCode || (isSimuruOnly ? serviceId.slice(7) : null);

    const [rumahotpResult, simuruResult] = await Promise.allSettled([
      rumahotpCode ? getCountries(process.env.RUMAHOTP_APIKEY, rumahotpCode) : Promise.resolve(null),
      simCode ? getSimuruCountries(simCode) : Promise.resolve(null)
    ]);

    const items = [];

    if (rumahotpCode && rumahotpResult.status === "fulfilled" && rumahotpResult.value) {
      const list = rumahotpResult.value.data || rumahotpResult.value || [];
      for (const c of Array.isArray(list) ? list : []) {
        items.push({
          ...c,
          pricelist: (c.pricelist || []).map((p) => ({
            ...p,
            server: "rumahotp",
            sell_price: Math.ceil(Number(p.price || 0) * (1 + markupPercent / 100))
          }))
        });
      }
    }

    if (simCode && simuruResult.status === "fulfilled" && Array.isArray(simuruResult.value)) {
      // Group by country_id (one row per country, one pricelist item per operator)
      const countryMap = new Map();
      for (const c of simuruResult.value) {
        const cid = c.country_id;
        const priceRaw = Number(c.price || 0);
        const sellPrice = Math.ceil(priceRaw * (1 + markupPercent / 100));
        const providerItem = {
          provider_id: `s:${cid}:${c.operator || "any"}`,
          provider_name: "Server OTO Fast",
          price: priceRaw,
          sell_price: sellPrice,
          success_rate: c.success_rate ?? null,
          stock: null,
          server: "simuru",
          country_id: cid,
          operator: c.operator || "any"
        };
        if (countryMap.has(cid)) {
          countryMap.get(cid).pricelist.push(providerItem);
        } else {
          countryMap.set(cid, {
            number_id: `s:${cid}`,
            name: c.country_name,
            pricelist: [providerItem]
          });
        }
      }
      items.push(...countryMap.values());
    }

    return NextResponse.json({ items });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal mengambil daftar negara." }, { status: 500 });
  }
}
