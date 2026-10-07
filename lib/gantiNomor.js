// Membeli nomor pengganti ke provider yang sama dengan pesanan lama.
// Dipakai dua jalur: tombol "Ganti Nomor" manual (app/api/otp/replace) dan
// jaminan otomatis (lib/jaminan.js). Satu salinan saja: perbedaan kecil antara
// dua salinan adalah cara pengganti yang membeli produk yang salah.
import { createOrder, toEpochMs } from "@/lib/rumahotp";
import { createWarungNokosOrder, getWarungNokosCountries, isWarungNokosServer } from "@/lib/warungnokos";
import { createDibananaOrder, getDibananaPrices } from "@/lib/dibanana";
import { cfg } from "@/lib/config";

/** Apakah pesanan lama punya cukup data untuk dibelikan penggantinya. */
export function bisaDiganti(order) {
  const isWn = isWarungNokosServer(order.server);
  const isBn = order.server === "dibanana";
  return (isWn || isBn)
    ? Boolean(order.serviceId) && order.countryId != null
    : Boolean(order.numberId) && Boolean(order.providerId);
}

/**
 * @param {object} oldOrder
 * @param {{hargaMaks?: number}} [opsi] hargaMaks: pengganti yang modalnya lebih
 *   mahal dari ini ditolak (dianggap tidak tersedia) — jaminan tidak boleh
 *   membeli nomor yang merugikan toko.
 * @returns {Promise<null | {orderId, phoneNumber, expiredMs, extra, modal}>}
 */
export async function beliNomorPengganti(oldOrder, { hargaMaks } = {}) {
  const isWn = isWarungNokosServer(oldOrder.server);
  const isBn = oldOrder.server === "dibanana";
  const terlaluMahal = (harga) => hargaMaks != null && Number(harga) > Number(hargaMaks);

  try {
    if (isBn) {
      // Ambil ulang id produk yang segar, lalu pesan nomor pengganti.
      const providers = await getDibananaPrices({ service: oldOrder.serviceId, country: oldOrder.countryId });
      const p = providers[oldOrder.providerIndex || 0] || providers[0];
      if (!p || terlaluMahal(p.price_idr)) return null;
      const made = await createDibananaOrder({ id: p.id });
      if (!made?.orderId) return null;
      return {
        orderId: made.orderId,
        phoneNumber: made.phoneNumber || "-",
        expiredMs: Date.now() + 19 * 60 * 1000,
        modal: Number(p.price_idr) || null,
        extra: { server: "dibanana", countryId: oldOrder.countryId, providerIndex: oldOrder.providerIndex || 0 }
      };
    }
    if (isWn) {
      // Harga & kunci produk diambil ulang supaya harga modal yang dikirim
      // selalu yang berlaku saat ini.
      const rows = await getWarungNokosCountries(oldOrder.server, oldOrder.serviceId, { countryId: oldOrder.countryId });
      const country = rows.find((c) => String(c.countryId) === String(oldOrder.countryId));
      const entry =
        country?.pricelist.find((p) => String(p.key) === String(oldOrder.providerKey)) || country?.pricelist[0];
      if (!entry || terlaluMahal(entry.price)) return null;
      const made = await createWarungNokosOrder(oldOrder.server, {
        key: entry.key,
        operator: oldOrder.operator || "any",
        modalPrice: entry.price,
        serviceName: oldOrder.serviceName || undefined
      });
      if (!made?.id) return null;
      return {
        orderId: made.id,
        phoneNumber: made.number || "-",
        expiredMs: Date.now() + 20 * 60 * 1000,
        modal: Number(entry.price) || null,
        extra: {
          server: oldOrder.server,
          countryId: String(oldOrder.countryId),
          providerKey: entry.key,
          operator: oldOrder.operator || "any"
        }
      };
    }
    const result = await createOrder((await cfg("RUMAHOTP_APIKEY")), {
      numberId: oldOrder.numberId,
      providerId: oldOrder.providerId,
      operatorId: oldOrder.operatorId
    });
    const data = result?.data || result;
    if (!data?.order_id) return null;
    return {
      orderId: String(data.order_id),
      phoneNumber: data.phone_number || "-",
      expiredMs: toEpochMs(data.expired_at),
      modal: null,
      extra: { server: "rumahotp" }
    };
  } catch {
    return null;
  }
}
