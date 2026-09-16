// Dipanggil oleh cron (app/api/cron/cleanup/route.js) tiap 5 menit.
// Prinsip: JANGAN PERNAH hapus riwayat pesanan OTP (done/refunded/expired) — itu
// riwayat transaksi asli yang harus tetap kelihatan user di halaman Riwayat.
// Yang dibersihkan cuma dua jenis data yang benar-benar tidak berguna lagi:
//  1. Pesanan OTP "pending" yang macet & sudah kedaluwarsa tapi tidak pernah
//     direkonsiliasi (user tidak sempat buka lagi halaman statusnya) — ini
//     DIREKONSILIASI ulang (dicek ke provider, di-refund kalau perlu), BUKAN dihapus.
//  2. Deposit yang gagal/tidak pernah dibayar & sudah sangat lama (>24 jam) — aman
//     dihapus karena credited selalu false dan QR-nya sudah lama kedaluwarsa.
//  3. Broadcast (banner promo) yang sudah nonaktif/selesai & sudah lama — cuma teks
//     banner, tidak ada nilai riwayat buat user.
import { otpOrdersCol, depositsCol, broadcastsCol } from "@/lib/db";
import { reconcileOtpOrder } from "@/lib/orderReconcile";

const OTP_PENDING_FALLBACK_MS = 30 * 60 * 1000; // 30 menit kalau expiredAt tidak ada
const DEPOSIT_STALE_MS = 24 * 60 * 60 * 1000; // 24 jam
const BROADCAST_STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari
const MAX_RECONCILE_PER_RUN = 40; // jaga-jaga supaya satu run cron tidak kebanjiran panggilan API provider

export async function runCleanup() {
  const now = new Date();
  const result = { otpReconciled: 0, otpRefunded: 0, depositsDeleted: 0, broadcastsDeleted: 0, errors: [] };

  // 1. Rekonsiliasi pesanan OTP pending yang sudah kedaluwarsa & belum pernah dicek ulang.
  try {
    const orders = await otpOrdersCol();
    const fallbackCutoff = new Date(now.getTime() - OTP_PENDING_FALLBACK_MS);
    const stalePending = await orders
      .find({
        status: "pending",
        refunded: false,
        $or: [{ expiredAt: { $ne: null, $lte: now } }, { expiredAt: null, createdAt: { $lte: fallbackCutoff } }]
      })
      .limit(MAX_RECONCILE_PER_RUN)
      .toArray();

    for (const order of stalePending) {
      try {
        const r = await reconcileOtpOrder(order);
        result.otpReconciled++;
        if (r.refunded) result.otpRefunded++;
      } catch (err) {
        result.errors.push(`reconcile ${order.orderId}: ${err?.message || err}`);
      }
    }
  } catch (err) {
    result.errors.push(`otp query: ${err?.message || err}`);
  }

  // 2. Hapus deposit gagal/kedaluwarsa yang sudah sangat lama.
  try {
    const deposits = await depositsCol();
    const cutoff = new Date(now.getTime() - DEPOSIT_STALE_MS);
    const del = await deposits.deleteMany({
      credited: { $ne: true },
      status: { $nin: ["completed", "success"] },
      createdAt: { $lte: cutoff }
    });
    result.depositsDeleted = del.deletedCount || 0;
  } catch (err) {
    result.errors.push(`deposit cleanup: ${err?.message || err}`);
  }

  // 3. Hapus broadcast lama yang sudah nonaktif/kedaluwarsa.
  try {
    const broadcasts = await broadcastsCol();
    const cutoff = new Date(now.getTime() - BROADCAST_STALE_MS);
    const del = await broadcasts.deleteMany({
      createdAt: { $lte: cutoff },
      $or: [{ active: false }, { endAt: { $ne: null, $lte: now } }]
    });
    result.broadcastsDeleted = del.deletedCount || 0;
  } catch (err) {
    result.errors.push(`broadcast cleanup: ${err?.message || err}`);
  }

  return result;
}
