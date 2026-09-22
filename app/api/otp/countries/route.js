import { NextResponse } from "next/server";
import { getCountries } from "@/lib/rumahotp";
import { getSimuruCountries, getSimuruPricelist } from "@/lib/simuru";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Ambil daftar negara+harga Simuru untuk satu layanan. Endpoint per-layanan dipakai
// lebih dulu karena membawa success_rate & harga paling segar; kalau gagal, pricelist
// (kunci service_id + country_id yang sama dengan Buat Order) dipakai sebagai cadangan.
async function simuruRowsFor(serviceId) {
  try {
    const rows = await getSimuruCountries(serviceId);
    if (rows.length) return rows;
  } catch (err) {
    console.error("[otp/countries] simuru per-service gagal, pakai pricelist:", err?.message || err);
  }
  return getSimuruPricelist({ serviceId });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("service_id");
  const server = searchParams.get("server") || "rumahotp";
  if (!serviceId) return NextResponse.json({ error: "service_id wajib diisi." }, { status: 400 });

  try {
    const { markupPercent } = await getSettings();
    const markup = (n) => Math.ceil(Number(n || 0) * (1 + (Number(markupPercent) || 0) / 100));

    if (server === "simuru") {
      const rows = await simuruRowsFor(serviceId);
      // Satu kartu per negara; tiap operator jadi satu baris pilihan di dalamnya.
      const byCountry = new Map();
      for (const r of rows) {
        const cid = r.country_id;
        if (cid === undefined || cid === null) continue;
        const operator = r.operator || "random";
        const entry = {
          provider_id: `s:${cid}:${operator}`,
          provider_name: operator === "any" || operator === "random" ? "Otomatis" : `Operator ${operator}`,
          price: Number(r.price || 0),
          sell_price: markup(r.price),
          success_rate: r.success_rate ?? null,
          stock: null,
          server: "simuru",
          country_id: cid,
          operator
        };
        if (byCountry.has(cid)) {
          byCountry.get(cid).pricelist.push(entry);
        } else {
          byCountry.set(cid, {
            number_id: `s:${cid}`,
            name: r.country_name || `Negara ${cid}`,
            iso: r.country_iso || null,
            img: null,
            pricelist: [entry]
          });
        }
      }
      return NextResponse.json({ items: Array.from(byCountry.values()) });
    }

    const result = await getCountries(process.env.RUMAHOTP_APIKEY, serviceId);
    const list = result?.data || result || [];
    const items = (Array.isArray(list) ? list : []).map((c) => ({
      ...c,
      pricelist: (c.pricelist || []).map((p) => ({
        ...p,
        server: "rumahotp",
        sell_price: markup(p.price)
      }))
    }));
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[otp/countries]", err?.response?.data || err?.message || err);
    const msg = server === "simuru" ? err?.message : null;
    return NextResponse.json({ error: msg || "Gagal mengambil daftar negara." }, { status: 502 });
  }
}
