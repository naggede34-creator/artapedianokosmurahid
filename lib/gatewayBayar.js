// Pemeriksaan tagihan QRIS Gateway yang sekaligus mengabarkan pemiliknya.
//
// Dipakai tiga jalur yang sama-sama bisa menjadi yang pertama tahu tagihan
// sudah dibayar: webhook AustinPay, callback lama Pakasir, dan penyapu cron.
// `berubah` hanya benar SEKALI per tagihan (klaim atomik di kreditkanTagihan),
// jadi notifikasinya tidak pernah terkirim dua kali walau ketiganya datang
// bersamaan.
import { periksaTagihan } from "@/lib/gateway";
import { gatewayInvoicesCol } from "@/lib/db";
import { sapuCallback } from "@/lib/gatewayCallback";
import { kabariMerchant, kabariAdmin, gwTagihanDibayarNotif } from "@/lib/gatewayNotify";

export async function periksaDanKabari(invoiceId) {
  const col = await gatewayInvoicesCol();
  const sebelum = await col.findOne({ invoiceId });
  if (!sebelum) return { ok: false, tidakDikenal: true };

  const r = await periksaTagihan(invoiceId);
  if (r.ok && r.berubah && r.invoice.status === "paid") {
    kabariMerchant(sebelum.token, r.invoice).catch(() => {});
    kabariAdmin(
      gwTagihanDibayarNotif({
        invoiceId: r.invoice.invoiceId,
        token: sebelum.token,
        amount: r.invoice.amount,
        biaya: r.invoice.biaya,
        diterima: r.invoice.diterima,
        merchantRef: r.invoice.merchantRef
      })
    ).catch(() => {});
  }
  return r;
}

/**
 * Penyapu: tagihan Austin yang masih menunggu diperiksa ke penyedia. Webhook
 * bisa saja tidak sampai, dan halaman merchant yang sudah ditutup tidak lagi
 * memeriksa sendiri — tanpa ini, pembayaran yang masuk baru terlihat setelah
 * merchant membuka halamannya lagi.
 */
export async function sapuTagihanGateway({ maks = 20 } = {}) {
  const col = await gatewayInvoicesCol();
  const daftar = await col
    .find({ status: "pending", createdAt: { $gte: new Date(Date.now() - 6 * 3600_000) } })
    .sort({ createdAt: 1 })
    .limit(maks)
    .toArray();
  let masuk = 0;
  for (const inv of daftar) {
    try {
      const r = await periksaDanKabari(inv.invoiceId);
      if (r.ok && r.berubah && r.invoice.status === "paid") masuk++;
    } catch (e) {
      console.error("[gateway] sapu tagihan:", e?.message || e);
    }
  }
  const callback = await sapuCallback({ maks: 20 }).catch(() => null);
  return { dicek: daftar.length, masuk, callback };
}
