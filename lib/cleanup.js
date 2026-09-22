// Dipanggil oleh cron (app/api/cron/cleanup/route.js) tiap 5 menit.
// Prinsip: JANGAN PERNAH hapus riwayat transaksi yang sudah terjadi.
// Yang dilakukan:
//  1. Rekonsiliasi pesanan OTP "pending" yang sudah kedaluwarsa (refund kalau perlu).
//  2. Cek ulang deposit yang masih pending / baru dibatalkan / kedaluwarsa dalam 3 jam.
//  4. Hapus deposit gagal/tidak dibayar yang sudah > 24 jam & gambar QR lama.
//  5. Hapus broadcast lama yang sudah nonaktif.
//  6. AUTO-CLEAN: Hapus notifikasi yang sudah dibaca > 30 hari.
//  7. AUTO-CLEAN: Hapus scratch card lama yang sudah digunakan > 14 hari.
import { otpOrdersCol, depositsCol, broadcastsCol, userNotificationsCol, scratchCardsCol } from "@/lib/db";
import { reconcileOtpOrder } from "@/lib/orderReconcile";
import { syncDeposit } from "@/lib/depositService";

const OTP_PENDING_FALLBACK_MS = 30 * 60 * 1000;
const DEPOSIT_RECHECK_MS = 3 * 60 * 60 * 1000;
const DEPOSIT_STALE_MS = 24 * 60 * 60 * 1000;
const BROADCAST_STALE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 40;

export async function runCleanup() {
  const now = new Date();
  const result = {
    otpReconciled: 0,
    otpRefunded: 0,
    depositsChecked: 0,
    depositsCredited: 0,
    depositsDeleted: 0,
    broadcastsDeleted: 0,
    notifDeleted: 0,
    scratchDeleted: 0,
    errors: []
  };

  // 1. OTP pending kedaluwarsa
  try {
    const orders = await otpOrdersCol();
    const fallbackCutoff = new Date(now.getTime() - OTP_PENDING_FALLBACK_MS);
    const stalePending = await orders
      .find({
        status: "pending",
        refunded: { $ne: true },
        $or: [{ expiredAt: { $ne: null, $lte: now } }, { expiredAt: null, createdAt: { $lte: fallbackCutoff } }]
      })
      .limit(MAX_PER_RUN)
      .toArray();
    for (const order of stalePending) {
      try {
        const r = await reconcileOtpOrder(order);
        result.otpReconciled++;
        if (r.refunded) result.otpRefunded++;
      } catch (err) {
        result.errors.push(`otp ${order.orderId}: ${err?.message || err}`);
      }
    }
  } catch (err) {
    result.errors.push(`otp query: ${err?.message || err}`);
  }

  // 2. Deposit yang mungkin sudah dibayar
  try {
    const deposits = await depositsCol();
    const recent = await deposits
      .find({
        credited: { $ne: true },
        status: { $in: ["pending", "canceled", "expired"] },
        createdAt: { $gte: new Date(now.getTime() - DEPOSIT_RECHECK_MS), $lte: new Date(now.getTime() - 30 * 1000) }
      })
      .project({ qrImage: 0 })
      .sort({ createdAt: -1 })
      .limit(MAX_PER_RUN)
      .toArray();
    for (const dep of recent) {
      try {
        const r = await syncDeposit(dep);
        result.depositsChecked++;
        if (r.credit) result.depositsCredited++;
      } catch (err) {
        result.errors.push(`deposit ${dep.orderId}: ${err?.message || err}`);
      }
    }
  } catch (err) {
    result.errors.push(`deposit recheck: ${err?.message || err}`);
  }

  // 3. Deposit lama yang tidak pernah dibayar + gambar QR lama
  try {
    const deposits = await depositsCol();
    const cutoff = new Date(now.getTime() - DEPOSIT_STALE_MS);
    const del = await deposits.deleteMany({
      credited: { $ne: true },
      status: { $nin: ["completed", "success"] },
      createdAt: { $lte: cutoff }
    });
    result.depositsDeleted = del.deletedCount || 0;
    await deposits.updateMany({ createdAt: { $lte: cutoff }, qrImage: { $exists: true } }, { $unset: { qrImage: "" } });
  } catch (err) {
    result.errors.push(`deposit cleanup: ${err?.message || err}`);
  }

  // 4. Broadcast lama
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

  // 5. AUTO-CLEAN: notifikasi yang sudah dibaca > 30 hari
  try {
    const notifs = await userNotificationsCol();
    const notifCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const del = await notifs.deleteMany({ read: true, createdAt: { $lte: notifCutoff } });
    result.notifDeleted = del.deletedCount || 0;
  } catch (err) {
    result.errors.push(`notif cleanup: ${err?.message || err}`);
  }

  // 6. AUTO-CLEAN: scratch card yang sudah digunakan > 14 hari
  try {
    const scratches = await scratchCardsCol();
    const scratchCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const del = await scratches.deleteMany({ status: "scratched", createdAt: { $lte: scratchCutoff } });
    result.scratchDeleted = del.deletedCount || 0;
  } catch (err) {
    result.errors.push(`scratch cleanup: ${err?.message || err}`);
  }

  return result;
}
