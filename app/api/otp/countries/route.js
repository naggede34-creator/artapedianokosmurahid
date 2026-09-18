import { NextResponse } from "next/server";
import { getCountries } from "@/lib/rumahotp";
import { getSettings } from "@/lib/settings";
import { getApiKeys } from "@/lib/apiKeys";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("service_id");
    if (!serviceId) return NextResponse.json({ error: "service_id wajib diisi." }, { status: 400 });

    const [{ markupPercent }, { rumahOtp }] = await Promise.all([getSettings(), getApiKeys()]);
    const data = await getCountries(rumahOtp, serviceId);
    const items = (data.data || data || []).map((c) => ({
      ...c,
      pricelist: (c.pricelist || []).map((p) => ({
        ...p,
        sell_price: Math.ceil(Number(p.price || 0) * (1 + markupPercent / 100))
      }))
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error(err?.response?.data || err);
    return NextResponse.json({ error: "Gagal mengambil daftar negara." }, { status: 500 });
  }
}
