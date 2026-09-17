// Dipanggil oleh cron (app/api/cron/cleanup/route.js) tiap 5 menit.
// Prinsip: JANGAN PERNAH hapus riwayat transaksi yang sudah terjadi.
// Yang dilakukan:
//  1. Rekonsiliasi pesanan OTP "pending" yang sudah kedaluwarsa (refund kalau perlu).
//  2. Cek ulang deposit yang masih pending / baru dibatalkan / kedaluwarsa dalam 3 jam
//     terakhir — kalau ternyata dibayar, saldo tetap dikreditkan.
//  3. Sinkron status pesanan Suntik Sosmed yang belum final (refund otomatis).
//  4. Hapus deposit gagal/tidak dibayar yang sudah > 24 jam & gambar QR lama.
//  5. Hapus broadcast lama yang sudah nonaktif.
import { otpOrdersCol, depositsCol, broadcastsCol, smmOrdersCol } from "@/lib/db";
import { reconcileOtpOrder } from "@/lib/orderReconcile";
import { syncDeposit } from "@/lib/depositService";
import { syncSmmOrder } from "@/lib/smmService";

const OTP_PENDING_FALLBACK_MS = 30 * 60 * 1000;
const DEPOSIT_RECHECK_MS = 3 * 60 * 60 * 1000;
const DEPOSIT_STALE_MS = 24 * 60 * 60 * 1000;
const BROADCAST_STALE_MS = 30 * 24 * 60 * 60 * 1000;
const SMM_SYNC_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 40;

export async function runCleanup() {
  const now = new Date();
  const result = {
    otpReconciled: 0,
    otpRefunded: 0,
    depositsChecked: 0,
    depositsCredited: 0,
    smmSynced: 0,
    smmSettled: 0,
    depositsDeleted: 0,
    broadcastsDeleted: 0,
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

  // 3. Suntik sosmed yang belum final
  try {
    const smm = await smmOrdersCol();
    const open = await smm
      .find({
        settled: { $ne: true },
        providerOrderId: { $ne: null },
        createdAt: { $gte: new Date(now.getTime() - SMM_SYNC_WINDOW_MS) },
        $or: [{ lastSyncAt: null }, { lastSyncAt: { $exists: false } }, { lastSyncAt: { $lte: new Date(now.getTime() - 4 * 60 * 1000) } }]
      })
      .sort({ lastSyncAt: 1 })
      .limit(MAX_PER_RUN)
      .toArray();
    for (const o of open) {
      try {
        const r = await syncSmmOrder(o);
        result.smmSynced++;
        if (r?.settled) result.smmSettled++;
      } catch (err) {
        result.errors.push(`smm ${o.id}: ${err?.message || err}`);
      }
    }
  } catch (err) {
    result.errors.push(`smm sync: ${err?.message || err}`);
  }

  // 4. Deposit lama yang tidak pernah dibayar + gambar QR lama
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

  // 5. Broadcast lama
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
