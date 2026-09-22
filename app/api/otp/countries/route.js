import { NextResponse } from "next/server";
import { getCountries } from "@/lib/rumahotp";
import {
  getOtpmaniaCountries,
  getOtpmaniaPrices,
  isOtpmaniaServer,
  normalizeOtpmaniaPrices,
  otpmaniaServerCode
} from "@/lib/otpmania";
import { DIBANANA_COUNTRIES, getDibananaPrices } from "@/lib/dibanana";
import { getSettings, markupForServer } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Daftar negara OTPMANIA jarang berubah dan dipakai hanya untuk menamai country_id,
// jadi cukup diambil sekali per instance lalu disimpan sebentar.
const COUNTRY_TTL_MS = 10 * 60 * 1000;
let countryCache = { at: 0, map: null };

async function otpmaniaCountryNames() {
  if (countryCache.map && Date.now() - countryCache.at < COUNTRY_TTL_MS) return countryCache.map;
  const list = await getOtpmaniaCountries();
  const map = new Map(list.map((c) => [String(c.id), c.name]));
  countryCache = { at: Date.now(), map };
  return map;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("service_id");
  const server = searchParams.get("server") || "rumahotp";
  if (!serviceId) return NextResponse.json({ error: "service_id wajib diisi." }, { status: 400 });

  try {
    const settings = await getSettings();
    const pct = markupForServer(settings, server);
    const markup = (n) => Math.ceil(Number(n || 0) * (1 + pct / 100));

    if (server === "dibanana") {
      // dibanana tidak punya endpoint daftar negara; harga diambil per negara
      // (5 negara) lalu digabung jadi satu kartu per negara.
      const results = await Promise.allSettled(
        DIBANANA_COUNTRIES.map((c) => getDibananaPrices({ service: serviceId, country: c.code }))
      );
      const items = [];
      results.forEach((r, i) => {
        if (r.status !== "fulfilled") return;
        const c = DIBANANA_COUNTRIES[i];
        const pricelist = r.value
          .filter((p) => Number(p.stock) !== 0)
          .map((p, idx) => ({
            // Index dipakai saat order untuk mengambil ulang id produk yang segar,
            // karena id dari dibanana bersifat opaque dan bisa kedaluwarsa.
            provider_id: `bn:${c.code}:${idx}`,
            provider_name: `Stok ${p.stock ?? "-"}`,
            price: Number(p.price_idr || 0),
            sell_price: markup(p.price_idr),
            success_rate: null,
            stock: p.stock ?? null,
            server,
            country_id: c.code,
            providerIndex: idx
          }));
        if (pricelist.length) {
          items.push({ number_id: `bn:${c.code}`, name: c.name, img: null, iso: c.code.toUpperCase(), pricelist });
        }
      });
      return NextResponse.json({ items });
    }

    if (isOtpmaniaServer(server)) {
      const code = otpmaniaServerCode(server);
      // Satu panggilan untuk seluruh negara; limit baca OTPMANIA hanya 60/menit
      // sehingga memanggil per negara bukan pilihan.
      const [raw, names] = await Promise.all([
        getOtpmaniaPrices({ service: serviceId, server: code }),
        otpmaniaCountryNames().catch(() => new Map())
      ]);

      const items = normalizeOtpmaniaPrices(raw)
        .filter((r) => r.stock === null || r.stock > 0)
        .map((r) => ({
          number_id: `${server}:${r.countryId}`,
          name: names.get(String(r.countryId)) || `Negara ${r.countryId}`,
          img: null,
          pricelist: [
            {
              provider_id: `${server}:${r.countryId}`,
              provider_name: "Otomatis",
              price: r.price,
              sell_price: markup(r.price),
              success_rate: null,
              stock: r.stock,
              server,
              country_id: r.countryId
            }
          ]
        }));
      return NextResponse.json({ items });
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
    return NextResponse.json({ error: err?.message || "Gagal mengambil daftar negara." }, { status: 502 });
  }
}
