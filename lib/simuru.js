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
      headers: { accept: "application/json" }
    });
  } catch (err) {
    // Error jaringan dari axios menyimpan URL lengkap (termasuk apikey) di err.config.
    // Sengaja dibungkus ulang supaya apikey tidak ikut tercetak di log Vercel.
    const e = new SimuruError(`Tidak bisa terhubung ke Simuru (${err?.code || err?.message || "network"})`, 503);
    e.ambiguous = true;
    throw e;
  }

  const body = res.data;
  if (res.status >= 400 || !body || typeof body !== "object" || body.success === false) {
    const msg =
      (body && typeof body === "object" && body.message) ||
      (res.status === 401 ? "API key Simuru tidak valid." : `Simuru merespons HTTP ${res.status}`);
    throw new SimuruError(msg, res.status, body);
  }
  return body;
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
