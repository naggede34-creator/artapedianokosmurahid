import { DEFAULT_SERVER } from "@/lib/otpServers";
import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { listCountries } from "@/lib/otpCatalog";
import { rateSendiri } from "@/lib/otpRate";
import { rwDariReq } from "@/lib/rwKonteks";
import { hargaWeb } from "@/lib/webReseller";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("service_id");
  const server = searchParams.get("server") || DEFAULT_SERVER;
  if (!serviceId) return NextResponse.json({ error: "service_id wajib diisi." }, { status: 400 });

  try {
    const settings = await getSettings();
    const items = await listCountries(settings, server, serviceId);
    // Web reseller: harga yang tampil sudah termasuk markup webnya (harga yang ditagih di order sama persis).
    const web = await rwDariReq(req);
    if (web) for (const it of items) for (const p of it.pricelist || []) p.sell_price = hargaWeb(p.sell_price, web);
    const rate = await rateSendiri(server, serviceId);
    for (const it of items) { const r = rate[String(it.name || "").toLowerCase()]; if (r) it.rate_sendiri = r; }
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[otp/countries]", err?.response?.data || err?.message || err);
    return NextResponse.json({ error: err?.message || "Gagal mengambil daftar negara." }, { status: 502 });
  }
}
