// Client API SIMURU (https://simuru.com/api-docs) — dipakai untuk:
//   1. Deposit QRIS otomatis   (/deposit/create, /deposit/status)
//   2. Suntik sosmed / SMM     (/smm/platforms, /smm/kinds, /smm/services,
//                               /smm/order/create, /smm/order/status, /smm/refill)
//
// API key WAJIB disimpan di environment variable SIMURU_APIKEY (server only).
// Jangan pernah dikirim ke browser atau ditulis langsung di kode, karena siapa pun
// yang pegang key ini bisa memakai saldo akun Simuru kamu.
import axios from "axios";

const BASE_URL = "https://simuru.com/api";

export class SimuruError extends Error {
  constructor(message, status = 500, body = null) {
    super(message);
    this.name = "SimuruError";
    this.status = status;
    this.body = body;
    // true = tidak ada respons HTTP sama sekali (timeout / jaringan putus), jadi
    // hasil aksinya di sisi Simuru TIDAK diketahui (bisa sudah terproses).
    this.ambiguous = false;
  }
}

function apiKey() {
  return (process.env.SIMURU_APIKEY || "").trim();
}

export function simuruConfigured() {
  return apiKey().length > 0;
}

// Kirim User-Agent browser biasa. Dokumentasi Simuru memakai 403 untuk "tidak punya
// akses ke resource", tapi WAF/CDN di depannya juga bisa membalas 403 untuk
// User-Agent default axios dari IP datacenter seperti Vercel — UA ini menutup
// kemungkinan kedua itu.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const BROWSER_HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-encoding": "gzip, deflate",
  "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "cache-control": "no-cache",
  referer: "https://simuru.com/api-docs",
  "user-agent": UA
};

// Buang apikey dari teks apa pun sebelum masuk log/response diagnostik.
function redactKey(text, key) {
  const s = String(text ?? "");
  return key ? s.split(key).join("***") : s;
}

async function simuruRequest(path, params = {}, { method = "GET", timeout = 20000 } = {}) {
  const key = apiKey();
  if (!key) throw new SimuruError("SIMURU_APIKEY belum diisi di environment variables.", 500);

  let res;
  try {
    res = await axios({
      method,
      url: `${BASE_URL}${path}`,
      params: { ...params, apikey: key },
      timeout,
      validateStatus: () => true,
      decompress: true,
      maxContentLength: 32 * 1024 * 1024,
      maxBodyLength: 32 * 1024 * 1024,
      headers: BROWSER_HEADERS
    });
  } catch (err) {
    // Error jaringan dari axios menyimpan URL lengkap (termasuk apikey) di err.config.
    // Sengaja dibungkus ulang supaya apikey tidak ikut tercetak di log Vercel.
    const e = new SimuruError(`Tidak bisa terhubung ke Simuru (${err?.code || err?.message || "network"})`, 503);
    e.ambiguous = true;
    throw e;
  }

  const body = res.data;
  // Sukses = 2xx (deposit/create membalas 201) DAN body JSON dengan success != false.
  if (res.status >= 400 || !body || typeof body !== "object" || body.success === false) {
    let msg = body && typeof body === "object" ? body.message : null;
    if (!msg) {
      // Tidak ada `message` JSON dari Simuru -> hampir pasti bukan Simuru yang
      // menjawab, melainkan CDN/WAF di depannya. Catat sidik jarinya supaya
      // penyebabnya kelihatan di log, tanpa ikut mencetak apikey.
      const h = res.headers || {};
      console.error(
        `[simuru] ${path} HTTP ${res.status} | server=${h["server"] || "-"} cf-ray=${h["cf-ray"] || "-"} ` +
          `type=${h["content-type"] || "-"} body=${redactKey(
            typeof body === "string" ? body : JSON.stringify(body),
            key
          ).slice(0, 300)}`
      );
      if (res.status === 401) msg = "API key Simuru tidak valid.";
      else if (res.status === 403) msg = "Simuru memblokir permintaan dari server ini (403). Buka Dashboard Admin → cek Simuru untuk detailnya.";
      else if (res.status === 429) msg = "Terlalu banyak permintaan ke Simuru, coba lagi sebentar.";
      else msg = `Simuru merespons HTTP ${res.status}`;
    }
    throw new SimuruError(msg, res.status, body);
  }
  return body;
}

// ---------------------------------------------------------------- Diagnosa

// Menembak beberapa endpoint Simuru dan melaporkan APA yang sebenarnya menjawab.
// Dipakai saat semua request balas 403: kalau body-nya bukan JSON Simuru
// (content-type html / ada header cf-ray), yang memblokir adalah CDN/WAF,
// bukan izin akun. Hanya boleh dipanggil dari route admin.
export async function diagnoseSimuru() {
  const key = apiKey();
  if (!key) return { configured: false, error: "SIMURU_APIKEY belum diisi di environment." };

  const checks = [];
  for (const path of ["/balance", "/services", "/pricelist"]) {
    try {
      const res = await axios({
        method: "GET",
        url: `${BASE_URL}${path}`,
        params: { apikey: key, ...(path === "/pricelist" ? { service_id: "whatsapp" } : {}) },
        timeout: 20000,
        validateStatus: () => true,
        decompress: true,
        headers: BROWSER_HEADERS
      });
      const h = res.headers || {};
      const isJson = res.data && typeof res.data === "object";
      checks.push({
        path,
        status: res.status,
        ok: res.status < 400 && isJson && res.data.success !== false,
        respondedWithJson: isJson,
        simuruMessage: isJson ? res.data.message ?? null : null,
        contentType: h["content-type"] || null,
        server: h["server"] || null,
        cfRay: h["cf-ray"] || null,
        bodySnippet: redactKey(isJson ? JSON.stringify(res.data) : res.data, key).slice(0, 400)
      });
    } catch (err) {
      checks.push({ path, networkError: err?.code || err?.message || "network" });
    }
  }

  const blocked = checks.filter((c) => c.status >= 400);
  const byWaf = blocked.length > 0 && blocked.every((c) => !c.respondedWithJson);
  return {
    configured: true,
    // Panjang & 4 huruf terakhir saja — cukup untuk memastikan key di Vercel tidak
    // terpotong / bukan key lama, tanpa membocorkan keseluruhan key.
    keyLength: key.length,
    keyTail: key.slice(-4),
    verdict: blocked.length === 0
      ? "Semua endpoint Simuru normal."
      : byWaf
      ? "Diblokir CDN/WAF di depan Simuru — respons bukan JSON Simuru. Bukan soal izin akun."
      : "Simuru sendiri yang menolak (respons JSON). Lihat simuruMessage di tiap baris.",
    checks
  };
}

// ---------------------------------------------------------------- Akun

export async function getSimuruBalance() {
  const body = await simuruRequest("/balance");
  return Number(body.data?.balance || 0);
}

// ---------------------------------------------------------------- Deposit

// Maksimal 5 deposit pending bersamaan per API key (aturan Simuru).
export async function createSimuruDeposit({ amount, note }) {
  const body = await simuruRequest(
    "/deposit/create",
    { amount: Math.floor(amount), method: "qris", ...(note ? { note: String(note).slice(0, 255) } : {}) },
    { timeout: 25000 }
  );
  return body.data || {};
}

export async function getSimuruDepositStatus(depositId) {
  const body = await simuruRequest("/deposit/status", { deposit_id: depositId });
  return body.data || {};
}

// Status Simuru: pending | completed | failed | canceled (+ flag is_qris_expired)
export function normalizeSimuruDepositStatus(data) {
  const s = String(data?.status || "").toLowerCase();
  if (s === "completed" || s === "success" || s === "paid") return "completed";
  if (s === "failed") return "failed";
  if (s === "canceled" || s === "cancelled") return "canceled";
  if (s === "expired" || data?.is_qris_expired === true) return "expired";
  return "pending";
}

// ---------------------------------------------------------------- SMM (Suntik)

export async function getSmmPlatforms() {
  const body = await simuruRequest("/smm/platforms");
  return Array.isArray(body.data) ? body.data : [];
}

export async function getSmmKinds(platform) {
  const body = await simuruRequest("/smm/kinds", platform ? { platform } : {});
  return Array.isArray(body.data) ? body.data : [];
}

export async function getSmmServices({ platform, kind, q, featured, limit = 200 } = {}) {
  const params = { limit: Math.min(200, Math.max(1, Number(limit) || 60)) };
  if (platform) params.platform = platform;
  if (kind) params.kind = kind;
  if (q) params.q = q;
  if (featured) params.featured = 1;
  const body = await simuruRequest("/smm/services", params);
  return Array.isArray(body.data) ? body.data : [];
}

export async function createSmmOrder({ serviceId, target, quantity, customComments }) {
  const params = { service_id: serviceId, target };
  if (quantity) params.quantity = quantity;
  if (customComments) params.custom_comments = customComments;
  const body = await simuruRequest("/smm/order/create", params, { timeout: 30000 });
  return { data: body.data || {}, message: body.message };
}

export async function getSmmOrderStatus(orderId) {
  const body = await simuruRequest("/smm/order/status", { order_id: orderId });
  return body.data || {};
}

export async function listSmmOrders(limit = 20) {
  const body = await simuruRequest("/smm/orders", { limit });
  return Array.isArray(body.data) ? body.data : [];
}

export async function requestSmmRefill(orderId) {
  // Dokumentasi mencantumkan GET, contoh curl-nya POST. Coba GET dulu, lalu POST.
  try {
    const body = await simuruRequest("/smm/refill", { order_id: orderId });
    return body.message || "Refill diajukan.";
  } catch (err) {
    if (err.status !== 405) throw err;
    const body = await simuruRequest("/smm/refill", { order_id: orderId }, { method: "POST" });
    return body.message || "Refill diajukan.";
  }
}

// Status final SMM menurut dokumentasi Simuru.
export const SMM_FINAL_STATUSES = ["completed", "canceled", "cancelled", "refunded", "partial", "error"];

export function normalizeSmmStatus(raw) {
  const s = String(raw || "").toLowerCase().replace(/\s+/g, "_");
  if (s === "cancelled") return "canceled";
  if (s === "inprogress") return "in_progress";
  return s || "processing";
}

// ---------------------------------------------------------------- OTP (Server OTO Fast)

// Katalog harga lengkap (±16 ribu baris layanan × negara) dalam SATU request.
// Tiap baris: { service_id, service_name, country_id, country_name, country_iso, operator, price }.
// Pasangan service_id + country_id inilah yang dikirim saat membuat order, jadi
// memakai pricelist menghilangkan error "Service not found" akibat slug yang tidak cocok.
export async function getSimuruPricelist({ serviceId, countryId } = {}) {
  const params = {};
  if (serviceId) params.service_id = serviceId;
  if (countryId) params.country_id = countryId;
  const body = await simuruRequest("/pricelist", params, { timeout: 45000 });
  return Array.isArray(body.data) ? body.data : [];
}

// Simuru menyarankan sinkronisasi tiap 5–15 menit; response-nya sendiri di-cache 60 detik.
// Cache in-memory ini menahan satu salinan per instance serverless supaya daftar
// layanan tidak menarik 2,4 MB pada tiap pembukaan sheet.
const PRICELIST_TTL_MS = 5 * 60 * 1000;
let pricelistCache = { at: 0, rows: null, promise: null };

export async function getSimuruPricelistCached() {
  const now = Date.now();
  if (pricelistCache.rows && now - pricelistCache.at < PRICELIST_TTL_MS) return pricelistCache.rows;
  if (pricelistCache.promise) return pricelistCache.promise;

  pricelistCache.promise = getSimuruPricelist()
    .then((rows) => {
      pricelistCache = { at: Date.now(), rows, promise: null };
      return rows;
    })
    .catch((err) => {
      pricelistCache.promise = null;
      // Kalau masih punya salinan lama, pakai itu daripada menggagalkan halaman.
      if (pricelistCache.rows) return pricelistCache.rows;
      throw err;
    });
  return pricelistCache.promise;
}

// Operator yang bisa dipilih untuk satu kombinasi layanan + negara. Memilih
// operator yang tepat menaikkan peluang SMS masuk. Sebagian provider tidak
// mendukung pemilihan; saat itu supportsSelection false dan order memakai "random".
export async function getSimuruOperators(serviceId, countryId) {
  const body = await simuruRequest(
    `/services/${encodeURIComponent(serviceId)}/countries/${encodeURIComponent(countryId)}/operators`
  );
  const d = body.data || {};
  return {
    supportsSelection: d.supports_selection === true,
    operators: Array.isArray(d.operators) ? d.operators : []
  };
}

export async function getSimuruCountries(serviceId) {
  const body = await simuruRequest(`/services/${encodeURIComponent(serviceId)}/countries`);
  return Array.isArray(body.data) ? body.data : [];
}

export async function createSimuruOtpOrder({ serviceId, countryId, operator = "random" }) {
  const body = await simuruRequest("/order/create", {
    service_id: serviceId,
    country_id: countryId,
    operator: operator || "random"
  }, { timeout: 30000 });
  return body.data || body;
}

export async function checkSimuruOtpStatus(orderId) {
  const body = await simuruRequest("/orders/active/detail", { order_id: orderId });
  return body.data || body;
}

export async function cancelSimuruOtpOrder(orderId) {
  const body = await simuruRequest("/order/cancel", { order_id: orderId });
  return body;
}

// Status OTP Simuru: "active" = menunggu/pending, sisanya terminal.
export const OTP_SIMURU_TERMINAL = ["expired", "canceled", "cancelled", "completed", "done"];
