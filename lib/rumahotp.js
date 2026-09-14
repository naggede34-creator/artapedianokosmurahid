import axios from "axios";

const BASE_URL = "https://www.rumahotp.io/api";

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
//   GET /v2/deposit/create     -> amount (Number), payment_id (String: "qris",
//                                 "usdt-bep-20", "usdt-trc-20", "usdt-polygon",
//                                 "usdt-erc-20")
//   GET /v2/deposit/get_status -> dipanggil pakai order_id
//   GET /v1/deposit/cancel     -> dipanggil pakai order_id
//
// Nama field respons sudah dikonfirmasi dari contoh JSON asli:
//   { success, data: {
//       id,                       // ID transaksi RumahOTP -> disimpan sbg providerRef
//       status,                   // "success" | "pending" | "cancel"
//       method,                   // "qris" | "usdt-trc-20" | dst (tidak selalu ada)
//       total, fee, diterima,     // total dibayar, biaya admin, nominal bersih (IDR)
//       amount,                   // alias "total" pada sebagian respons (mis. qris)
//       currency: { type, total, fee, diterima }, // muncul khusus metode USDT (USD)
//       qr_string, qr_image,      // qr_image sudah berupa URL gambar siap pakai
//       created_at, created_at_ts, expired_at, expired_at_ts, // sebagian respons
//       created, expired,         // pakai nama ini (unix ms) di respons lain
//       brand: { name, icon, nns, type, app, org },
//       reference: { id, name, rrn, terminal, mid, nmid, mpan, cpan } // khusus e-wallet
//   } }
// Karena beberapa nama field ternyata berbeda antar metode/versi respons, kode di
// app/api/deposit/* tetap pakai pickField() dengan daftar kemungkinan nama di atas.
export async function createDeposit(apikey, { amount, orderId, paymentId = "qris" }) {
  return rumahOtpGet(apikey, "/v2/deposit/create", {
    amount,
    payment_id: paymentId,
    order_id: orderId
  });
}

export async function checkDeposit(apikey, orderId) {
  return rumahOtpGet(apikey, "/v2/deposit/get_status", { order_id: orderId });
}

// Pengecekan status deposit RumahOTP butuh tahu ID transaksi mana yang harus dipakai
// buat parameter "order_id" di endpoint get_status. Kita punya DUA kandidat ID:
//  - orderId: ID yang KITA generate & kirim sendiri waktu create ("DP...")
//  - providerRef: ID transaksi yang DIBALIKIN RumahOTP sendiri (field "id", "RO...")
// Dokumentasi resminya tidak menjelaskan endpoint ini query berdasarkan ID yang mana,
// jadi supaya status-check tidak pernah gagal total (dan saldo user nyangkut karena
// tidak pernah terdeteksi "completed"), coba orderId kita dulu (nilai yang pasti
// valid karena itu yang kita submit sendiri), baru fallback ke providerRef kalau
// hasil pertama kelihatan tidak berisi data transaksi yang valid.
export async function checkDepositSmart(apikey, orderId, providerRef) {
  let first;
  try {
    first = await checkDeposit(apikey, orderId);
  } catch (e) {
    first = null;
  }
  const firstData = first?.data || first;
  const firstLooksValid = first && first.success !== false && firstData && (firstData.status || firstData.id);
  if (firstLooksValid) return first;

  if (providerRef && providerRef !== orderId) {
    try {
      const second = await checkDeposit(apikey, providerRef);
      const secondData = second?.data || second;
      if (second && second.success !== false && secondData && (secondData.status || secondData.id)) {
        return second;
      }
      if (second) return second;
    } catch (e) {
      // biarkan, pakai hasil pertama (atau lempar error kalau pertama juga gagal total) di bawah
    }
  }

  if (first) return first;
  throw new Error("Gagal memeriksa status deposit RumahOTP.");
}

export async function cancelDeposit(apikey, orderId) {
  return rumahOtpGet(apikey, "/v1/deposit/cancel", { order_id: orderId });
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

  // Format "YYYY-MM-DD HH:mm:ss" ala WIB (UTC+7) tanpa info zona waktu.
  // Dianggap eksplisit sebagai WIB (bukan diserahkan ke `new Date()` yang
  // parsingnya tergantung zona waktu runtime) supaya hasilnya konsisten di
  // server maupun di HP user manapun.
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    const [, y, mo, d, h, mi, s] = m.map(Number);
    return Date.UTC(y, mo - 1, d, h, mi, s) - 7 * 60 * 60 * 1000;
  }

  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : null;
}
