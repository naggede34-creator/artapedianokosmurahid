import axios from "axios";

const BASE_URL = "https://www.rumahotp.io/api";

export function rumahOtpConfigured() {
  return Boolean(process.env.RUMAHOTP_APIKEY);
}

async function rumahOtpGet(apikey, endpoint, params = {}) {
  const { data } = await axios.get(`${BASE_URL}${endpoint}`, {
    params,
    headers: { "x-apikey": apikey, accept: "application/json" },
    timeout: 20000
  });
  return data;
}

export async function getServices(apikey) {
  return rumahOtpGet(apikey, "/v2/services");
}

export async function getCountries(apikey, serviceId) {
  return rumahOtpGet(apikey, "/v2/countries", { service_id: serviceId });
}

export async function getOperators(apikey, country, providerId) {
  return rumahOtpGet(apikey, "/v2/operators", { country, provider_id: providerId });
}

export async function createOrder(apikey, { numberId, providerId, operatorId }) {
  return rumahOtpGet(apikey, "/v2/orders", {
    number_id: numberId,
    provider_id: providerId,
    operator_id: operatorId
  });
}

export async function checkOrderStatus(apikey, orderId) {
  return rumahOtpGet(apikey, "/v1/orders/get_status", { order_id: orderId });
}

export async function setOrderStatus(apikey, orderId, status) {
  return rumahOtpGet(apikey, "/v1/orders/set_status", { order_id: orderId, status });
}

// --- Deposit (QRIS / e-wallet / USDT) otomatis via RumahOTP ----------------
// Dicocokkan ke dokumentasi resmi: https://rumahotp.web.id/developer/api
//   GET /v2/deposit/create      -> query: amount (Number), payment_id (String:
//                                  "qris", "usdt-bep-20", "usdt-trc-20",
//                                  "usdt-polygon", "usdt-erc-20"). TIDAK ada
//                                  parameter order_id/reference sama sekali —
//                                  RumahOTP generate ID transaksinya sendiri
//                                  (field "id" di respons, format "RO...").
//   GET /v2/deposit/get_status  -> query: deposit_id (BUKAN order_id!), diisi
//                                  dengan "id" yang dibalikin waktu create.
//   GET /v1/deposit/cancel      -> query: deposit_id (sama seperti get_status).
// Maksimal 3 deposit pending bersamaan per akun RumahOTP; permintaan create
// baru akan ditolak kalau sudah ada 3 yang masih pending/belum selesai.
//
// Nama field respons (data.*):
//   id,                       // ID transaksi RumahOTP -> WAJIB disimpan sbg
//                             // providerRef, dipakai lagi utk get_status/cancel
//   status,                   // "success" | "pending" | "cancel"
//   method,                   // "qris" | "usdt-trc-20" | dst (tidak selalu ada)
//   total, fee, diterima,     // total dibayar, biaya admin, nominal bersih (IDR)
//   amount,                   // alias "total" pada sebagian respons (mis. qris v1)
//   currency: { type, total, fee, diterima }, // detail dlm mata uang metode itu
//                             // (USD utk USDT, tapi bisa juga IDR utk qris)
//   qr_string, qr_image,      // qr_image sudah berupa URL gambar siap pakai
//   created_at, created_at_ts, expired_at, expired_at_ts, // sebagian respons
//   created, expired,         // pakai nama ini (unix ms) di respons lain
//   brand: { name, icon, nns, type, app, org },            // khusus e-wallet
//   reference: { id, name, rrn, terminal, mid, nmid, mpan, cpan } // khusus e-wallet
export async function createDeposit(apikey, { amount, paymentId = "qris" }) {
  return rumahOtpGet(apikey, "/v2/deposit/create", {
    amount,
    payment_id: paymentId
  });
}

export async function checkDeposit(apikey, depositId) {
  return rumahOtpGet(apikey, "/v2/deposit/get_status", { deposit_id: depositId });
}

export async function cancelDeposit(apikey, depositId) {
  return rumahOtpGet(apikey, "/v1/deposit/cancel", { deposit_id: depositId });
}

// RumahOTP kadang balikin waktu (created_at/expired_at) sebagai string jam WIB
// TANPA info zona waktu, mis. "2025-11-09 22:57:51". Kalau string itu di-parse
// langsung pakai `new Date(...)`, hasilnya tergantung zona waktu runtime yang
// mem-parsing (browser HP user vs server) — kalau beda-beda, deposit yang baru
// saja dibuat bisa langsung keitung "kedaluwarsa" padahal belum lewat waktunya.
// Fungsi ini menormalkan SEMUA bentuk waktu dari RumahOTP (angka epoch ms,
// angka epoch ms dalam bentuk string, ATAU string jam WIB) jadi epoch ms yang
// pasti benar, supaya kode lain (dan frontend) tinggal pakai `new Date(ms)`
// tanpa perlu menebak zona waktu lagi.
export function toEpochMs(value) {
  if (value === null || value === undefined || value === "") return null;

  const str = String(value).trim();

  // Sudah berupa epoch ms (angka atau angka dalam bentuk string, mis. "1775022582129")
  if (/^\d{12,}$/.test(str)) {
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
  }

  // Kalau string-nya SUDAH ada info zona waktu eksplisit (diakhiri "Z", atau ada
  // offset "+07:00"/"-0500" dst — umum dipakai provider lain kayak Pakasir yang
  // pakai format ISO 8601 lengkap), JANGAN dipaksa dianggap WIB — percaya parsing
  // standarnya karena zona waktunya sudah jelas tertulis di string itu sendiri.
  const hasExplicitTz = /Z$|[+-]\d{2}:?\d{2}$/.test(str);
  if (hasExplicitTz) {
    const n = new Date(str).getTime();
    return Number.isFinite(n) ? n : null;
  }

  // Format "YYYY-MM-DD HH:mm:ss" ala WIB (UTC+7) tanpa info zona waktu sama sekali
  // (ini polanya RumahOTP). Dianggap eksplisit sebagai WIB (bukan diserahkan ke
  // `new Date()` yang parsingnya tergantung zona waktu runtime) supaya hasilnya
  // konsisten di server maupun di HP user manapun.
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    const [, y, mo, d, h, mi, s] = m.map(Number);
    return Date.UTC(y, mo - 1, d, h, mi, s) - 7 * 60 * 60 * 1000;
  }

  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : null;
}
