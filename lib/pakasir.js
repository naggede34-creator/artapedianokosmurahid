import axios from "axios";

// ── Pakasir API v2 ────────────────────────────────────────────────────────────
//
// v1 (/api/transactioncreate, /api/transactiondetail, /api/transactioncancel)
// sudah deprecated dan dimatikan 20 Oktober 2026. Semua alur utama di sini
// sudah memakai v2. Fungsi v1 masih disimpan HANYA untuk deposit lama yang
// terlanjur dibuat sebelum migrasi dan belum punya txn_id.
//
// Endpoint v2 (host: https://app.pakasir.com):
//   POST /api/v2/create-transaction/{slug}/{order_id}   2 req/detik
//   GET  /api/v2/transaction-status/{slug}/{txn_id}     1 req / 4 detik per transaksi
//   POST /api/v2/cancel-transaction/{slug}/{txn_id}     2 req/detik
//   GET  /api/v2/payment-fee/{amount}                   publik, tanpa API key
//
// API key dikirim lewat header X-Api-Key, bukan di body seperti v1.
const HOST = process.env.PAKASIR_BASE_URL || "https://app.pakasir.com";
const V1_BASE = `${HOST}/api`;
const V2_BASE = `${HOST}/api/v2`;

const TIMEOUT = 20000;

// Metode pembayaran yang didukung Pakasir beserta batas nominalnya.
export const PAKASIR_METHODS = {
  payment_link: { name: "Payment Link", min: 500, max: 50_000_000 },
  qris: { name: "QRIS", min: 500, max: 10_000_000 },
  bri_va: { name: "BRI Virtual Account", min: 10_000, max: 50_000_000 },
  bni_va: { name: "BNI Virtual Account", min: 10_000, max: 50_000_000 },
  cimb_niaga_va: { name: "CIMB Niaga Virtual Account", min: 10_000, max: 50_000_000 },
  maybank_va: { name: "Maybank Virtual Account", min: 10_000, max: 50_000_000 },
  permata_va: { name: "Permata Virtual Account", min: 10_000, max: 50_000_000 },
  bnc_va: { name: "Bank Neo Commerce Virtual Account", min: 10_000, max: 50_000_000 },
  artha_graha_va: { name: "Artha Graha Virtual Account", min: 10_000, max: 50_000_000 },
  sampoerna_va: { name: "Sahabat Sampoerna Virtual Account", min: 10_000, max: 50_000_000 }
};

// ── Rate limit ────────────────────────────────────────────────────────────────
// create & cancel dibatasi 2 request/detik secara global; antrean sederhana ini
// menjaga jarak antar panggilan supaya tidak kena 429 saat ramai.
const WRITE_GAP_MS = 550;
let lastWriteAt = 0;
let writeChain = Promise.resolve();

function throttleWrite(fn) {
  const run = async () => {
    const wait = lastWriteAt + WRITE_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastWriteAt = Date.now();
    return fn();
  };
  const result = writeChain.then(run, run);
  writeChain = result.catch(() => {});
  return result;
}

// Cek status dibatasi 1x per 4 detik PER TRANSAKSI. Hasil terakhir disimpan
// sebentar supaya polling dari beberapa tab tidak menembus batas itu.
const STATUS_TTL_MS = 4200;
const statusCache = new Map();

function cacheGet(key) {
  const hit = statusCache.get(key);
  if (hit && Date.now() - hit.at < STATUS_TTL_MS) return hit.value;
  return null;
}

function cacheSet(key, value) {
  statusCache.set(key, { at: Date.now(), value });
  // Buang entri lama supaya Map tidak tumbuh tanpa batas di server yang panjang umur.
  if (statusCache.size > 500) {
    for (const [k, v] of statusCache) {
      if (Date.now() - v.at > STATUS_TTL_MS) statusCache.delete(k);
    }
  }
}

function authHeaders(apikey, json = false) {
  return {
    "X-Api-Key": apikey,
    ...(json ? { "Content-Type": "application/json" } : {})
  };
}

function errText(err, fallback) {
  const d = err?.response?.data;
  const msg = d?.message || d?.error || (typeof d === "string" ? d : null);
  return String(msg || err?.message || fallback);
}

// ── v2: buat transaksi ────────────────────────────────────────────────────────
// Bersifat find-or-create: memanggil ulang dengan slug + order_id + body yang
// sama akan mengembalikan transaksi yang itu-itu juga, bukan bikin baru.
export async function createTransaction(project, apikey, orderId, amount, method = "qris") {
  const call = () =>
    axios.post(
      `${V2_BASE}/create-transaction/${encodeURIComponent(project)}/${encodeURIComponent(orderId)}`,
      { method, amount: Math.round(Number(amount)) },
      { headers: authHeaders(apikey, true), timeout: TIMEOUT }
    );

  try {
    const { data } = await throttleWrite(call);
    return data;
  } catch (err) {
    // 429 = kena rate limit; sekali coba ulang setelah jeda sudah cukup.
    if (err?.response?.status === 429) {
      const { data } = await throttleWrite(call);
      return data;
    }
    throw new Error(errText(err, "Gagal membuat transaksi Pakasir."));
  }
}

// ── v2: status transaksi ──────────────────────────────────────────────────────
export async function getTransactionStatus(project, apikey, txnId) {
  const key = `${project}:${txnId}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  try {
    const { data } = await axios.get(
      `${V2_BASE}/transaction-status/${encodeURIComponent(project)}/${encodeURIComponent(txnId)}`,
      { headers: authHeaders(apikey), timeout: TIMEOUT }
    );
    cacheSet(key, data);
    return data;
  } catch (err) {
    if (err?.response?.status === 429) {
      // Kena batas 4 detik — bukan error nyata, cukup beri tahu pemanggil
      // supaya status lama dipertahankan.
      const e = new Error("Terlalu sering cek status, coba lagi sebentar.");
      e.rateLimited = true;
      throw e;
    }
    throw new Error(errText(err, "Gagal mengecek status transaksi Pakasir."));
  }
}

// ── v2: batalkan transaksi ────────────────────────────────────────────────────
export async function cancelTransactionV2(project, apikey, txnId) {
  try {
    const { data } = await throttleWrite(() =>
      axios.post(
        `${V2_BASE}/cancel-transaction/${encodeURIComponent(project)}/${encodeURIComponent(txnId)}`,
        null,
        { headers: authHeaders(apikey), timeout: TIMEOUT }
      )
    );
    return data;
  } catch (err) {
    throw new Error(errText(err, "Gagal membatalkan transaksi Pakasir."));
  }
}

// ── v2: penghitung biaya (publik, tanpa API key) ──────────────────────────────
// Mengembalikan biaya per metode untuk satu nominal, mis. { qris: 394, bri_va: 3500 }.
export async function getPaymentFees(amount) {
  const amt = Math.round(Number(amount) || 0);
  if (!Number.isFinite(amt) || amt <= 0) return null;
  try {
    const { data } = await axios.get(`${V2_BASE}/payment-fee/${amt}`, { timeout: 12000 });
    return data && typeof data === "object" ? data : null;
  } catch (err) {
    console.error("[pakasir] payment-fee gagal:", errText(err, "unknown"));
    return null;
  }
}

// Biaya untuk satu metode saja; null kalau Pakasir tidak bisa dihubungi, supaya
// pemanggil bisa jatuh ke estimasi persen dari pengaturan admin.
export async function getPaymentFee(amount, method = "qris") {
  const fees = await getPaymentFees(amount);
  if (!fees) return null;
  const v = Number(fees[method]);
  return Number.isFinite(v) ? v : null;
}

// ── Normalisasi respons ───────────────────────────────────────────────────────
// Bentuk v1 dan v2 berbeda, jadi pembacaan field-nya dipusatkan di sini.
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
    txnId: pick("txn_id", "transaction_id", "id"),
    qrString: pick("qr_string", "payment_number", "qris_string", "qris", "qr_code"),
    vaNumber: pick("va_number", "virtual_account", "account_number"),
    paymentUrl: pick("payment_link", "payment_url", "url", "checkout_url", "redirect_url"),
    expiredAt: pick("expired_at", "expiry_at", "expired", "expire_at"),
    fee: pick("fee", "admin_fee", "total_fee"),
    total: pick("total_payment", "total_amount", "amount_total", "total"),
    status: pick("status", "transaction_status", "state"),
    completedAt: pick("completed_at"),
    isSandbox: tx.is_sandbox === true,
    raw: tx
  };
}

// Status Pakasir v2 hanya ada tiga: pending, completed, canceled.
export function normalizePakasirStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (["completed", "success", "paid", "settlement", "done"].includes(s)) return "completed";
  if (["canceled", "cancelled", "cancel", "expired", "expire"].includes(s)) return "canceled";
  if (["failed", "failure", "error"].includes(s)) return "failed";
  return "pending";
}

// ── v1 (deprecated) ───────────────────────────────────────────────────────────
// Hanya dipakai untuk deposit lama yang dibuat sebelum migrasi dan tidak punya
// txn_id. Dimatikan Pakasir pada 20 Oktober 2026.
export async function checkTransactionV1(project, apikey, orderId, amount) {
  const { data } = await axios.get(`${V1_BASE}/transactiondetail`, {
    params: { project, order_id: orderId, amount, api_key: apikey },
    timeout: TIMEOUT
  });
  return data;
}

export async function cancelTransactionV1(project, apikey, orderId, amount) {
  const { data } = await axios.post(
    `${V1_BASE}/transactioncancel`,
    { project, order_id: orderId, amount, api_key: apikey },
    { headers: { "Content-Type": "application/json" }, timeout: TIMEOUT }
  );
  return data;
}
