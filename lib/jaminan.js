// Jaminan OTP berbayar: pembeli menambah biaya kecil, dan kalau kode belum
// masuk sesudah beberapa menit, nomornya diganti otomatis.
//
// Aturan uang (semuanya di sini supaya satu tempat yang dibaca):
//   • Biaya ikut dipotong saat beli, di dalam hold yang sama dengan harga nomor.
//   • Biaya HANYA milik toko kalau kode OTP akhirnya masuk. Semua jalur yang
//     mengembalikan uang (batal, kedaluwarsa, penggantian gagal) mengembalikan
//     harga + biaya — jaminan yang tidak menghasilkan kode tidak boleh dibayar.
//   • Penggantian hanya sekali per pesanan, dan hanya kalau modal nomor
//     penggantinya tidak lebih mahal dari modal nomor semula.
import { otpOrdersCol, usersCol } from "@/lib/db";
import { kreditRefund } from "@/lib/saldoDeposit";
import { cfg } from "@/lib/config";
import { logBalance } from "@/lib/ledger";
import { umumkan } from "@/lib/notifyHub";
import { beliNomorPengganti, bisaDiganti } from "@/lib/gantiNomor";
import { tarikKomisi } from "@/lib/resellerKomisi";
import { kirimPushCepat } from "@/lib/webPush";
import { cancelWarungNokosOrder, isWarungNokosServer } from "@/lib/warungnokos";
import { otpPurchaseNotif, otpAutoRefundNotif, otpRefundPublicNotif } from "@/lib/telegram";
import { notifyBotUser, jaminanGantiText, refundText } from "@/lib/shopBot";

const BATAS_UMUR_MATI_MS = 30 * 60 * 1000;
const MIN_BIAYA = 100;
const KELIPATAN = 50;
/** Provider menolak pembatalan sebelum ±3 menit; 4 menit memberi ruang aman. */
export const MENIT_MIN = 4;

/** Biaya jaminan untuk satu harga. 0 = jaminan tidak ditawarkan. */
export function hitungBiayaJaminan(harga, persen) {
  const p = Number(persen);
  const h = Number(harga);
  if (!(p > 0) || !(h > 0)) return 0;
  const mentah = (h * p) / 100;
  return Math.max(MIN_BIAYA, Math.ceil(mentah / KELIPATAN) * KELIPATAN);
}

export async function persenJaminan() {
  const mentah = String((await cfg("JAMINAN_PERSEN")) ?? "").trim();
  const n = mentah === "" ? 10 : Number(mentah);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 0;
}

export async function menitJaminan() {
  const n = Number(String((await cfg("JAMINAN_MENIT")) ?? "").trim() || MENIT_MIN);
  return Math.max(MENIT_MIN, Number.isFinite(n) && n > 0 ? n : MENIT_MIN);
}

/** Info jaminan untuk ditampilkan di UI beli: { aktif, persen, menit, biayaUntuk(harga) } */
export async function infoJaminan() {
  const persen = await persenJaminan();
  return { aktif: persen > 0, persen, menit: await menitJaminan() };
}

// Membatalkan nomor lama ke provider. true = nomornya BENAR-BENAR batal (uang
// modal kembali ke toko dan pesanan lama boleh dilepas). false = tidak jelas /
// ditolak, jadi jangan membeli nomor kedua: itu berarti membayar dua kali.
async function batalkanDiProvider(order) {
  try {
    if (isWarungNokosServer(order.server)) {
      await cancelWarungNokosOrder(order.server, order.orderId);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Jendela pemulihan: klaim jaminanProses yang lebih tua dari ini dianggap macet. */
export const JAMINAN_MACET_MS = 5 * 60 * 1000;

/**
 * Filter tambahan untuk semua jalur refund: pesanan yang sedang diganti
 * jaminan tidak boleh direfund oleh jalur lain (uang dobel), kecuali klaimnya
 * sudah macet — proses yang mati di tengah tidak boleh menahan uang selamanya.
 */
export function syaratBolehRefund(sekarang = Date.now()) {
  return {
    $or: [
      { jaminanProses: { $ne: true } },
      { jaminanMulaiAt: { $lt: new Date(sekarang - JAMINAN_MACET_MS) } }
    ]
  };
}

/**
 * Dipanggil dari reconcileOtpOrder untuk pesanan yang BELUM ada kodenya.
 * Mengembalikan null kalau tidak ada yang dilakukan, atau
 *   { gantiKe: {orderId, phoneNumber, expiredAt, price}}  — nomor diganti, atau
 *   { refunded: true, newBalance }                        — penggantian gagal, uang kembali penuh.
 */
export async function jalankanJaminan(order, { sudahMati = false } = {}) {
  if (!order?.jaminanBiaya || order.jaminanGanti || order.refunded || order.otpCode) return null;
  if (!bisaDiganti(order)) return null;

  const menit = await menitJaminan();
  const umur = Date.now() - new Date(order.createdAt).getTime();
  if (umur < menit * 60 * 1000) return null;
  // Nomor yang sudah kedaluwarsa lama tidak diganti: pembelinya sudah pergi,
  // dan nomor pengganti yang tidak dilihat siapa pun cuma membuang modal.
  if (sudahMati && umur > BATAS_UMUR_MATI_MS) return null;

  const orders = await otpOrdersCol();
  // Klaim atomik: dua polling yang datang bersamaan, hanya satu yang jalan.
  const klaim = await orders.findOneAndUpdate(
    { orderId: order.orderId, token: order.token, refunded: false, otpCode: null, jaminanGanti: { $ne: true } },
    // jaminanProses menahan jalur refund lain (lihat bolehRefund di orderReconcile)
    // selama nomor lama sudah batal tapi penggantinya belum tersimpan.
    { $set: { jaminanGanti: true, jaminanProses: true, jaminanMulaiAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!klaim) return null;

  const lepasKlaim = () =>
    orders.updateOne(
      { orderId: order.orderId, otpCode: null, refunded: false },
      { $set: { jaminanGanti: false, jaminanProses: false } }
    );

  // Cek terakhir: kalau OTP sempat masuk, batalkan di provider akan ditolak
  // dan kita tidak menyentuh apa-apa.
  const batal = sudahMati ? true : await batalkanDiProvider(order);
  if (!batal) {
    await lepasKlaim();
    return null;
  }

  const fresh = await beliNomorPengganti(order, { hargaMaks: order.basePrice });
  const users = await usersCol();

  if (!fresh) {
    // Tidak ada pengganti. Nomor lama sudah batal, jadi uangnya dikembalikan penuh.
    const dilepas = await orders.findOneAndUpdate(
      { orderId: order.orderId, token: order.token, refunded: false, otpCode: null },
      { $set: { refunded: true, status: "canceled", canceledAt: new Date(), jaminanGagal: true, jaminanProses: false } }
    );
    if (!dilepas) return null;
    const total = order.price + order.jaminanBiaya;
    const u = await kreditRefund(order.token, total, order.depositBagian);
    await tarikKomisi(order.komisiOrderId || order.orderId).catch(() => {});
    await logBalance({
      token: order.token,
      type: "otp_refund",
      amount: total,
      balanceAfter: u?.balance,
      title: `Refund OTP ${order.serviceName || ""} (jaminan: pengganti tidak tersedia)`.trim(),
      ref: order.orderId
    });
    umumkan({
      jenis: "otp_refund",
      admin: otpAutoRefundNotif({
        orderId: order.orderId,
        serviceName: order.serviceName,
        countryName: order.countryName,
        price: total,
        token: order.token,
        reason: "Jaminan OTP: nomor pengganti tidak tersedia, harga + biaya jaminan dikembalikan."
      }),
      publik: otpRefundPublicNotif({
        serviceName: order.serviceName,
        countryName: order.countryName,
        price: total,
        token: order.token,
        reason: "nomor pengganti tidak tersedia"
      })
    }).catch(() => {});
    notifyBotUser(order.token, refundText({ serviceName: order.serviceName, price: total, balance: u?.balance }));
    await kirimPushCepat(order.token, {
      judul: "Saldo dikembalikan 💸",
      isi: `Nomor pengganti ${order.serviceName || ""} tidak tersedia. Rp${total.toLocaleString("id-ID")} (termasuk jaminan) sudah kembali.`,
      url: "/otp",
      tag: `refund-${order.orderId}`
    });
    return { refunded: true, newBalance: u?.balance };
  }

  const baru = {
    orderId: fresh.orderId,
    ...fresh.extra,
    token: order.token,
    serviceId: order.serviceId || null,
    serviceName: order.serviceName,
    countryName: order.countryName,
    phoneNumber: fresh.phoneNumber,
    price: order.price,
    jaminanBiaya: order.jaminanBiaya,
    jaminanGanti: true,
    depositBagian: order.depositBagian ?? null, // pesanan pengganti memakai uang yang sama → refund-nya mengembalikan bagian deposit yang sama
    // Komisi reseller tercatat atas pesanan ASLI; pengganti mewarisi penandanya
    // supaya refund, omzet, dan notifikasinya tetap menemukan komisi itu.
    ...(order.resellerBotId ? { resellerBotId: order.resellerBotId, komisiOrderId: order.komisiOrderId || order.orderId } : {}),
    status: "pending",
    otpCode: null,
    otpMsg: null,
    refunded: false,
    replacedFrom: order.orderId,
    numberId: order.numberId || null,
    providerId: order.providerId || null,
    operatorId: order.operatorId || null,
    basePrice: fresh.modal || order.basePrice,
    createdAt: new Date(),
    expiredAt: fresh.expiredMs ? new Date(fresh.expiredMs) : null
  };
  await orders.insertOne(baru);
  const gantiKe = {
    orderId: baru.orderId,
    phoneNumber: baru.phoneNumber,
    expiredAt: fresh.expiredMs || null,
    price: order.price
  };
  // Pesanan lama dilepas SESUDAH yang baru tersimpan: kalau proses mati di
  // antaranya, yang tersisa adalah dua pesanan aktif — bukan uang yang hilang.
  // Nomor lama sudah batal di provider, jadi polling berikutnya merefundnya;
  // untuk mencegah itu (uang dobel) ditandai refunded di sini.
  await orders.updateOne({ orderId: order.orderId }, { $set: { refunded: true, status: "canceled", diganti: true, gantiKe, canceledAt: new Date(), jaminanProses: false } });

  umumkan({
    admin: otpPurchaseNotif({
      orderId: baru.orderId,
      serviceName: order.serviceName,
      countryName: order.countryName,
      phoneNumber: baru.phoneNumber,
      price: order.price,
      token: order.token
    })
  }).catch(() => {});
  await kirimPushCepat(order.token, {
    judul: "Nomor diganti otomatis 🔁",
    isi: `Jaminan OTP bekerja untuk ${order.serviceName || "pesananmu"}. Buka untuk melihat nomor barunya.`,
    url: "/otp",
    tag: `ganti-${order.orderId}`
  });
  notifyBotUser(
    order.token,
    jaminanGantiText({ serviceName: order.serviceName, countryName: order.countryName, phoneNumber: baru.phoneNumber, orderId: baru.orderId })
  );
  return { gantiKe };
}
