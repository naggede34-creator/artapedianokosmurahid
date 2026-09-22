// Katalog nokos lintas provider.
//
// Dipakai bersama oleh endpoint web (/api/otp/*) dan API publik (/api/v1/*)
// supaya daftar layanan, negara, dan harga jual selalu identik di dua jalur itu
// — termasuk markup per server yang diatur admin.
import { getServices, getCountries } from "@/lib/rumahotp";
import {
  getOtpmaniaServices,
  getOtpmaniaCountries,
  getOtpmaniaPrices,
  isOtpmaniaServer,
  normalizeOtpmaniaPrices,
  otpmaniaServerCode
} from "@/lib/otpmania";
import { DIBANANA_COUNTRIES, getDibananaServices, getDibananaPrices } from "@/lib/dibanana";
import { markupForServer } from "@/lib/settings";

// Nama negara OTPMANIA jarang berubah dan hanya dipakai untuk menamai country_id,
// jadi cukup diambil sekali per instance lalu disimpan sebentar.
const COUNTRY_TTL_MS = 10 * 60 * 1000;
let countryCache = { at: 0, map: null };

export async function otpmaniaCountryNames() {
  if (countryCache.map && Date.now() - countryCache.at < COUNTRY_TTL_MS) return countryCache.map;
  const list = await getOtpmaniaCountries();
  const map = new Map(list.map((c) => [String(c.id), c.name]));
  countryCache = { at: Date.now(), map };
  return map;
}

export function serverEnabled(settings, id) {
  const list = Array.isArray(settings?.otpServers) ? settings.otpServers : [];
  return list.find((s) => s.id === id)?.enabled !== false;
}

// WhatsApp selalu di urutan pertama — layanan paling sering dicari.
function sortServices(items) {
  return items.sort((a, b) => {
    const wa = (x) => (/whats\s*app|^wa$/i.test(x.service_name) || x.service_code === "wa" ? 0 : 1);
    return wa(a) - wa(b) || a.service_name.localeCompare(b.service_name, "id");
  });
}

// Daftar aplikasi untuk satu server. Bentuk item sengaja sama untuk semua server
// (service_code, service_name, service_img) supaya UI & API-nya identik.
export async function listServices(server = "rumahotp") {
  if (server === "dibanana") {
    const list = await getDibananaServices();
    return sortServices(
      list.map((s) => ({ service_code: s.code, service_name: s.name || s.code, service_img: null, server }))
    );
  }

  if (isOtpmaniaServer(server)) {
    const list = await getOtpmaniaServices();
    return sortServices(
      list.map((s) => ({ service_code: s.id, service_name: s.name, service_img: null, server }))
    );
  }

  const result = await getServices(process.env.RUMAHOTP_APIKEY);
  const list = result?.data || result?.services || result || [];
  return (Array.isArray(list) ? list : []).map((s) => ({ ...s, server: "rumahotp" }));
}

// Daftar negara + pricelist untuk satu layanan di satu server. sell_price sudah
// termasuk markup server, jadi itulah yang ditagih ke saldo user.
export async function listCountries(settings, server, serviceId) {
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
      // dibanana mengurutkan dari termurah; tier pertama ditandai supaya UI bisa
      // menyorotnya, dan stok dipakai untuk bar ketersediaan.
      const rows = r.value.filter((p) => Number(p.stock) !== 0);
      const maxStock = Math.max(1, ...rows.map((p) => Number(p.stock) || 0));
      const pricelist = rows.map((p, idx) => ({
        // Index dipakai saat order untuk mengambil ulang id produk yang segar,
        // karena id dari dibanana bersifat opaque dan bisa kedaluwarsa.
        provider_id: `bn:${c.code}:${idx}`,
        provider_name: idx === 0 ? "Paket Termurah" : `Paket ${idx + 1}`,
        price: Number(p.price_idr || 0),
        sell_price: markup(p.price_idr),
        success_rate: null,
        stock: p.stock ?? null,
        stockRatio: Math.min(1, (Number(p.stock) || 0) / maxStock),
        cheapest: idx === 0,
        server,
        country_id: c.code,
        providerIndex: idx
      }));
      if (pricelist.length) {
        items.push({
          number_id: `bn:${c.code}`,
          name: c.name,
          img: null,
          flag: c.flag,
          dial_code: c.dial,
          iso: c.code.toUpperCase(),
          pricelist
        });
      }
    });
    return items;
  }

  if (isOtpmaniaServer(server)) {
    const code = otpmaniaServerCode(server);
    // Satu panggilan untuk seluruh negara; limit baca OTPMANIA hanya 60/menit
    // sehingga memanggil per negara bukan pilihan.
    const [raw, names] = await Promise.all([
      getOtpmaniaPrices({ service: serviceId, server: code }),
      otpmaniaCountryNames().catch(() => new Map())
    ]);

    return normalizeOtpmaniaPrices(raw)
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
  }

  const result = await getCountries(process.env.RUMAHOTP_APIKEY, serviceId);
  const list = result?.data || result || [];
  return (Array.isArray(list) ? list : []).map((c) => ({
    ...c,
    pricelist: (c.pricelist || []).map((p) => ({ ...p, server: "rumahotp", sell_price: markup(p.price) }))
  }));
}
