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

export async function cancelDeposit(apikey, orderId) {
  return rumahOtpGet(apikey, "/v1/deposit/cancel", { order_id: orderId });
}
