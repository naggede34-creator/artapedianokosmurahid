// Callback ke URL merchant saat tagihan QRIS Gateway dibayar.
//
// Dikirim sebagai POST JSON bertanda tangan HMAC-SHA256 (header
// X-Artapedia-Signature, kunci = API key merchant). Gagal tidak membatalkan
// apa pun — tagihan tetap lunas dan saldo tetap masuk; callback hanyalah kabar
// ke sistem merchant. Yang gagal diulang bertahap oleh penyapu cron.
import crypto from "node:crypto";
import { gatewayInvoicesCol, gatewayAccountsCol } from "@/lib/db";
import { kirimAman } from "@/lib/callbackAman";

// Jeda sebelum percobaan ke-2, 3, dst. (menit). Setelah habis, ditandai "gagal".
const JEDA_MENIT = [1, 5, 15, 60, 360];

export function badanCallback(inv) {
  return {
    invoice_id: inv.invoiceId,
    status: "paid",
    amount: inv.amount,
    pay_amount: inv.bayar || inv.amount,
    net_amount: inv.diterima,
    merchant_ref: inv.merchantRef || "",
    paid_at: inv.paidAt ? new Date(inv.paidAt).toISOString() : new Date().toISOString()
  };
}

export const tandaTanganCallback = (apiKey, mentah) => crypto.createHmac("sha256", String(apiKey)).update(mentah).digest("hex");

/** Satu percobaan kirim untuk satu tagihan. Mencatat hasilnya di dokumen tagihan. */
export async function kirimCallback(invoiceId) {
  const col = await gatewayInvoicesCol();
  // Klaim atomik: dua pemanggil (jalur bayar & penyapu) tidak mengirim bersamaan.
  const inv = await col.findOneAndUpdate(
    { invoiceId, status: "paid", callbackUrl: { $nin: ["", null] }, callbackStatus: { $in: ["menunggu"] }, callbackKunci: { $ne: true } },
    { $set: { callbackKunci: true, callbackKunciAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!inv) return { dilewati: true };

  const akun = await (await gatewayAccountsCol()).findOne({ token: inv.token }, { projection: { apiKey: 1 } });
  const mentah = JSON.stringify(badanCallback(inv));
  const hasil = await kirimAman(inv.callbackUrl, mentah, {
    "x-artapedia-signature": tandaTanganCallback(akun?.apiKey || "", mentah),
    "x-artapedia-event": "invoice.paid"
  }).catch((e) => ({ ok: false, alasan: String(e?.message || "gagal").slice(0, 80) }));

  const percobaan = (inv.callbackPercobaan || 0) + 1;
  const set = { callbackKunci: false, callbackPercobaan: percobaan, callbackTerakhirAt: new Date(), callbackHasil: hasil.ok ? `HTTP ${hasil.status}` : (hasil.alasan || `HTTP ${hasil.status || "?"}`) };
  if (hasil.ok) set.callbackStatus = "terkirim";
  else if (hasil.permanen || percobaan > JEDA_MENIT.length) set.callbackStatus = "gagal";
  else set.callbackSelanjutnyaAt = new Date(Date.now() + JEDA_MENIT[percobaan - 1] * 60_000);
  await col.updateOne({ invoiceId }, { $set: set });
  return { ok: hasil.ok, percobaan, hasil: set.callbackHasil };
}

/** Dipanggil sekali saat tagihan baru lunas: tandai menunggu, lalu coba kirim langsung. */
export async function jadwalkanCallback(inv) {
  if (!inv?.callbackUrl) return;
  const col = await gatewayInvoicesCol();
  await col.updateOne(
    { invoiceId: inv.invoiceId, callbackStatus: { $exists: false } },
    { $set: { callbackStatus: "menunggu", callbackPercobaan: 0, callbackSelanjutnyaAt: new Date() } }
  );
  await kirimCallback(inv.invoiceId).catch((e) => console.error("[gateway/callback]", e?.message || e));
}

/** Penyapu: ulangi callback yang gagal dan sudah waktunya. */
export async function sapuCallback({ maks = 20 } = {}) {
  const col = await gatewayInvoicesCol();
  // Kunci yang tertinggal (proses mati di tengah kirim) dibuka setelah 3 menit.
  await col.updateMany({ callbackKunci: true, callbackKunciAt: { $lt: new Date(Date.now() - 3 * 60_000) } }, { $set: { callbackKunci: false } });
  const daftar = await col.find({ status: "paid", callbackStatus: "menunggu", callbackSelanjutnyaAt: { $lte: new Date() } }).limit(maks).toArray();
  let terkirim = 0;
  for (const inv of daftar) {
    const r = await kirimCallback(inv.invoiceId).catch(() => null);
    if (r?.ok) terkirim++;
  }
  return { dicoba: daftar.length, terkirim };
}
