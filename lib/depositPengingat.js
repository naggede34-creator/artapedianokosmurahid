// Pengingat QRIS hampir kedaluwarsa: sekali per deposit, N menit sebelum habis (DEPOSIT_PENGINGAT_MENIT, 0 = mati).
// Dikirim sebagai push web + pesan bot Telegram (bila akunnya tersambung ke bot). Klaim atomik (`diingatkan`) mencegah ganda.
import { depositsCol } from "@/lib/db";
import { cfgAngka } from "@/lib/config";
import { kirimPushCepat } from "@/lib/webPush";
import { notifyBotUser } from "@/lib/shopBot";

let terakhir = 0;
let berjalan = false;

export async function pengingatDeposit({ jeda = 0, maks = 20 } = {}) {
  const kini = Date.now();
  if (berjalan || (jeda && kini - terakhir < jeda)) return { dilewati: true };
  terakhir = kini; berjalan = true;
  const hasil = { dikirim: 0 };
  try {
    const menit = Math.max(0, Math.min(30, Math.round(await cfgAngka("DEPOSIT_PENGINGAT_MENIT", 5))));
    if (!menit) return hasil;
    const col = await depositsCol();
    const calon = await col
      .find({ status: "pending", credited: { $ne: true }, diingatkan: { $ne: true }, expiredAt: { $gt: kini, $lte: kini + menit * 60000 } }, { projection: { qrImage: 0 } })
      .limit(maks).toArray();
    for (const d of calon) {
      const klaim = await col.findOneAndUpdate({ orderId: d.orderId, diingatkan: { $ne: true }, status: "pending" }, { $set: { diingatkan: true } });
      if (!klaim) continue;
      const sisa = Math.max(1, Math.round((Number(d.expiredAt) - Date.now()) / 60000));
      const rp = `Rp${Number(d.totalAmount ?? d.amount).toLocaleString("id-ID")}`;
      await kirimPushCepat(d.token, {
        judul: "⏰ QRIS hampir kedaluwarsa",
        isi: `Deposit ${rp} habis dalam ±${sisa} menit. Bayar sekarang atau buat QRIS baru.`,
        url: "/deposit",
        tag: `dep-ingat-${d.orderId}`
      });
      notifyBotUser(d.token, `⏰ <b>QRIS hampir kedaluwarsa</b>\nDeposit <b>${rp}</b> habis dalam ±${sisa} menit.\nSelesaikan pembayaran atau buat QRIS baru.`);
      hasil.dikirim++;
    }
  } catch (e) {
    console.error("[pengingat deposit]", e?.message || e);
  } finally { berjalan = false; }
  return hasil;
}
