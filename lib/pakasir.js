import axios from "axios";

// Pakasir punya dua generasi API:
//
//  v1 — /api/transactioncreate, /api/transactiondetail, /api/transactioncancel
//       api_key dikirim di body/query. DEPRECATED, dimatikan 20 Oktober 2026.
//  v2 — /api/v2/create-transaction/{slug}/{order_id}
//       api_key dikirim lewat header X-Api-Key, dibatasi 2 request/detik.
//
// Pembuatan transaksi sudah dipindah ke v2. Cek status dan pembatalan MASIH v1
// karena bentuk endpoint v2 untuk dua hal itu belum ada di dokumentasi yang
// kami pegang — menebak path/response di jalur uang bukan pilihan. Begitu
// dokumentasinya ada, tinggal isi checkTransactionV2 / cancelTransactionV2 di
// bawah lalu naikkan PAKASIR_API_VERSION.
const HOST = process.env.PAKASIR_BASE_URL || "https://app.pakasir.com";
const V1_BASE = `${HOST}/api`;
const V2_BASE = `${HOST}/api/v2`;

// "v2" (default) memakai v2 untuk membuat transaksi. Set ke "v1" kalau perlu
// kembali sementara ke endpoint lama.
const API_VERSION = (process.env.PAKASIR_API_VERSION || "v2").toLowerCase();

// v2 membatasi 2 request/detik. Antrean sederhana ini menjaga jarak antar
// panggilan supaya tidak kena 429 saat banyak user deposit bersamaan.
const MIN_GAP_MS = 550;
let lastCallAt = 0;
let chain = Promise.resolve();

function throttle(fn) {
  const run = async () => {
    const wait = lastCallAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fn();
  };
  // Rantai promise: panggilan berikutnya baru mulai setelah yang sebelumnya
  // selesai menghitung jeda, jadi urutannya tetap terjaga.
  const result = chain.then(run, run);
  chain = result.catch(() => {});
  return result;
}

function errText(err, fallback) {
  const d = err?.response?.data;
  const msg = d?.message || d?.error || d?.errors || (typeof d === "string" ? d : null);
  return String(msg || err?.message || fallback);
}

async function createTransactionV1(project, apikey, orderId, amount, method) {
  const { data } = await axios.post(
    `${V1_BASE}/transactioncreate/${method}`,
    { project, order_id: orderId, amount, api_key: apikey },
    { headers: { "Content-Type": "application/json" }, timeout: 20000 }
  );
  return data;
}

async function createTransactionV2(project, apikey, orderId, amount, method) {
  const { data } = await axios.post(
    `${V2_BASE}/create-transaction/${encodeURIComponent(project)}/${encodeURIComponent(orderId)}`,
    { method, amount },
    {
      headers: { "Content-Type": "application/json", "X-Api-Key": apikey },
      timeout: 20000
    }
  );
  return data;
}

export async function createTransaction(project, apikey, orderId, amount, method = "qris") {
  if (API_VERSION === "v1") {
    return createTransactionV1(project, apikey, orderId, amount, method);
  }
  try {
    return await throttle(() => createTransactionV2(project, apikey, orderId, amount, method));
  } catch (err) {
    const status = err?.response?.status;
    // 429 = kena rate limit; sekali coba ulang setelah jeda sudah cukup.
    if (status === 429) {
      return throttle(() => createTransactionV2(project, apikey, orderId, amount, method));
    }
    throw new Error(errText(err, "Gagal membuat transaksi Pakasir."));
  }
}

export async function checkTransaction(project, apikey, orderId, amount) {
  const { data } = await axios.get(`${V1_BASE}/transactiondetail`, {
    params: { project, order_id: orderId, amount, api_key: apikey },
    timeout: 20000
  });
  return data;
}

export async function cancelTransaction(project, apikey, orderId, amount) {
  const { data } = await axios.post(
    `${V1_BASE}/transactioncancel`,
    { project, order_id: orderId, amount, api_key: apikey },
    { headers: { "Content-Type": "application/json" }, timeout: 20000 }
  );
  return data;
}

// Bentuk respons v1 dan v2 tidak sama persis, jadi pengambilan field-nya
// ditoleransi di satu tempat supaya pemanggil tidak perlu tahu versinya.
export function normalizePakasirTransaction(result) {
  const tx = result?.transaction || result?.data || result?.payment || result || {};
  const pick = (...names) => {
    for (const n of names) {
      const v = tx[n];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return null;
  };
  return {
    qrString: pick("payment_number", "qr_string", "qris_string", "qris", "qr_code"),
    paymentUrl: pick("payment_url", "url", "checkout_url", "redirect_url"),
    expiredAt: pick("expired_at", "expiry_at", "expired", "expire_at"),
    fee: pick("fee", "admin_fee", "total_fee"),
    total: pick("total_payment", "total_amount", "amount_total", "total"),
    status: pick("status", "transaction_status", "state"),
    raw: tx
  };
}

export const PAKASIR_API_VERSION = API_VERSION;
