// Membeli nomor pengganti ke provider yang sama dengan pesanan lama.
// Dipakai dua jalur: tombol "Ganti Nomor" manual (app/api/otp/replace) dan
// jaminan otomatis (lib/jaminan.js). Satu salinan saja: perbedaan kecil antara
// dua salinan adalah cara pengganti yang membeli produk yang salah.
import { createWarungNokosOrder, getWarungNokosCountries, isWarungNokosServer } from "@/lib/warungnokos";

/** Apakah pesanan lama punya cukup data untuk dibelikan penggantinya. */
export function bisaDiganti(order) {
  return isWarungNokosServer(order.server) && Boolean(order.serviceId) && order.countryId != null;
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
  const terlaluMahal = (harga) => hargaMaks != null && Number(harga) > Number(hargaMaks);

  try {
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
    return null;
  } catch {
    return null;
  }
}
