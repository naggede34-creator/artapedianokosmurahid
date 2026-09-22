// Katalog nokos lintas provider.
//
// Dipakai bersama oleh endpoint web (/api/otp/*) dan API publik (/api/v1/*)
// supaya daftar layanan, negara, dan harga jual selalu identik di dua jalur itu
// — termasuk markup per server yang diatur admin.
import { getServices, getCountries } from "@/lib/rumahotp";
import { getWarungNokosServices, getWarungNokosCountries, isWarungNokosServer } from "@/lib/warungnokos";
import { DIBANANA_COUNTRIES, getDibananaServices, getDibananaPrices } from "@/lib/dibanana";
import { markupForServer } from "@/lib/settings";

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

  if (isWarungNokosServer(server)) {
    const list = await getWarungNokosServices(server);
    return sortServices(
      list.map((s) => ({ service_code: s.code, service_name: s.name, service_img: s.img || null, server }))
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

  if (isWarungNokosServer(server)) {
    const rows = await getWarungNokosCountries(server, serviceId);
    return rows
      .map((c) => ({
        number_id: `${server}:${c.countryId}`,
        name: c.name,
        img: null,
        dial_code: c.prefix,
        flag: c.flag || null,
        // Stok null = provider tidak melaporkannya, bukan berarti kosong.
        pricelist: c.pricelist
          .filter((p) => p.stock === null || p.stock > 0)
          .map((p, idx) => ({
            // `key` dari klien WarungNokos sudah cukup untuk order — disimpan apa
            // adanya supaya alur order tidak perlu tahu versi API-nya.
            provider_id: p.key,
            provider_name: p.label || (idx === 0 ? "Paket Termurah" : `Paket ${idx + 1}`),
            price: p.price,
            sell_price: markup(p.price),
            success_rate: p.rate ?? null,
            stock: p.stock,
            cheapest: idx === 0,
            server,
            country_id: c.countryId,
            country_name: c.name
          }))
          .sort((a, b) => a.price - b.price)
      }))
      .filter((c) => c.pricelist.length > 0);
  }

  const result = await getCountries(process.env.RUMAHOTP_APIKEY, serviceId);
  const list = result?.data || result || [];
  return (Array.isArray(list) ? list : []).map((c) => ({
    ...c,
    pricelist: (c.pricelist || []).map((p) => ({ ...p, server: "rumahotp", sell_price: markup(p.price) }))
  }));
}
