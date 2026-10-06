// Katalog nokos lintas provider.
//
// Dipakai bersama oleh endpoint web (/api/otp/*) dan API publik (/api/v1/*)
// supaya daftar layanan, negara, dan harga jual selalu identik di dua jalur itu
// — termasuk markup per server yang diatur admin.
import { getWarungNokosServices, getWarungNokosCountries, isWarungNokosServer } from "@/lib/warungnokos";
import { markupForServer } from "@/lib/settings";
import { DEFAULT_SERVER } from "@/lib/otpServers";

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
export async function listServices(server = DEFAULT_SERVER) {
  if (!isWarungNokosServer(server)) return [];
  const list = await getWarungNokosServices(server);
  return sortServices(
    list.map((s) => ({ service_code: s.code, service_name: s.name, service_img: s.img || null, server }))
  );
}

// Daftar negara + pricelist untuk satu layanan di satu server. sell_price sudah
// termasuk markup server, jadi itulah yang ditagih ke saldo user.
export async function listCountries(settings, server, serviceId) {
  const pct = markupForServer(settings, server);
  const markup = (n) => Math.ceil(Number(n || 0) * (1 + pct / 100));

  if (!isWarungNokosServer(server)) return [];

  {
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
}
