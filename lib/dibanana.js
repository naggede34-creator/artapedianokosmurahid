// Client API dibanana.id (https://dibanana.id/api/v1) — dipakai untuk server
// nokos "OTP Fast Murah". Semua harga sudah dalam Rupiah.
//
// API key WAJIB disimpan di environment variable DIBANANA_APIKEY (server only).
// Jangan pernah dikirim ke browser atau ditulis langsung di kode.
import axios from "axios";

const BASE_URL = "https://dibanana.id/api/v1";

// Gateway dibanana. "ekonomi" paling murah & jadi default.
export const DIBANANA_SERVER = "ekonomi";

// dibanana tidak punya endpoint daftar negara — pilihannya tetap seperti di dokumentasi.
export const DIBANANA_COUNTRIES = [
  { code: "id", name: "Indonesia", flag: "🇮🇩", dial: "62" },
  { code: "my", name: "Malaysia", flag: "🇲🇾", dial: "60" },
  { code: "sg", name: "Singapura", flag: "🇸🇬", dial: "65" },
  { code: "us", name: "Amerika Serikat", flag: "🇺🇸", dial: "1" },
  { code: "uk", name: "Inggris", flag: "🇬🇧", dial: "44" }
];

export class DibananaError extends Error {
  constructor(message, status = 500, code = null) {
    super(message);
    this.name = "DibananaError";
    this.status = status;
    this.code = code;
    // true = tidak ada respons HTTP sama sekali, jadi hasil aksinya TIDAK diketahui.
    this.ambiguous = false;
  }
}

function apiKey() {
  return (process.env.DIBANANA_APIKEY || "").trim();
}

export function dibananaConfigured() {
  return apiKey().length > 0;
}

async function request(path, { method = "GET", params = {}, body = null, timeout = 20000 } = {}) {
  const key = apiKey();
  if (!key) throw new DibananaError("DIBANANA_APIKEY belum diisi di environment variables.", 500);

  let res;
  try {
    res = await axios({
      method,
      url: `${BASE_URL}${path}`,
      params,
      ...(body ? { data: body } : {}),
      timeout,
      validateStatus: () => true,
      decompress: true,
      headers: {
        // Key dikirim lewat header, jadi tidak ikut tercatat di URL/log.
        Authorization: `Bearer ${key}`,
        accept: "application/json",
        "user-agent": "artapedia-nokos/1.0",
        ...(body ? { "content-type": "application/json" } : {})
      }
    });
  } catch (err) {
    const e = new DibananaError(`Tidak bisa terhubung ke dibanana (${err?.code || err?.message || "network"})`, 503);
    e.ambiguous = true;
    throw e;
  }

  const data = res.data;
  const isJson = data && typeof data === "object";

  if (res.status >= 400 || !isJson || data.ok === false) {
    let msg = isJson ? data.message : null;
    const code = isJson ? data.error || null : null;
    if (!msg) {
      const h = res.headers || {};
      console.error(
        `[dibanana] ${path} HTTP ${res.status} | server=${h["server"] || "-"} cf-ray=${h["cf-ray"] || "-"} ` +
          `type=${h["content-type"] || "-"} body=${String(isJson ? JSON.stringify(data) : data).slice(0, 300)}`
      );
      if (res.status === 401) msg = "API key dibanana tidak valid.";
      else if (res.status === 403) msg = "dibanana menolak permintaan dari server ini (403).";
      else msg = `dibanana merespons HTTP ${res.status}`;
    }
    throw new DibananaError(msg, res.status, code);
  }
  return data;
}

// ---------------------------------------------------------------- Akun

export async function getDibananaBalance() {
  const d = await request("/balance");
  return Number(d.balance || 0);
}

// ---------------------------------------------------------------- Katalog

export async function getDibananaServices(server = DIBANANA_SERVER) {
  const d = await request("/services", { params: { server } });
  return Array.isArray(d.services) ? d.services : [];
}

// Daftar produk (tier harga) untuk satu layanan × negara, diurutkan dari termurah.
// Field `id` bersifat opaque & bisa kedaluwarsa, jadi selalu diambil ulang saat order.
export async function getDibananaPrices({ service, country = "id", server = DIBANANA_SERVER }) {
  const d = await request("/prices", { params: { service, country, server } });
  return Array.isArray(d.providers) ? d.providers : [];
}

// ---------------------------------------------------------------- Order

export async function createDibananaOrder({ id, operator }) {
  const body = { id };
  if (operator) body.operator = operator;
  const d = await request("/order", { method: "POST", body, timeout: 30000 });
  return {
    orderId: d.order_id != null ? String(d.order_id) : null,
    phoneNumber: d.phone_number || null,
    price: Number(d.price_idr || 0),
    status: d.status || "pending"
  };
}

export async function getDibananaStatus(orderId) {
  const d = await request("/status", { params: { order_id: orderId } });
  return {
    status: normalizeDibananaStatus(d.status),
    rawStatus: String(d.status || ""),
    // otp_code_2 terisi setelah resend; pakai yang mana pun yang sudah ada.
    code: d.otp_code || d.otp_code_2 || null,
    sms: d.full_sms || null,
    expiresIn: Number(d.expires_in || 0)
  };
}

export async function cancelDibananaOrder(orderId) {
  const d = await request("/cancel", { method: "POST", body: { order_id: Number(orderId) } });
  return d.message || "Pesanan dibatalkan.";
}

export function normalizeDibananaStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (s === "received") return "done";
  if (s === "cancelled" || s === "canceled" || s === "resend_cancelled") return "canceled";
  if (s === "expired") return "expired";
  if (s === "refunded") return "refund";
  return "pending";
}

// Status yang sudah final di sisi dibanana.
export const DIBANANA_TERMINAL = ["canceled", "expired", "refund", "refunded"];

// ---------------------------------------------------------------- Diagnosa

// Menembak endpoint baca dan melaporkan apa yang sebenarnya dibalas. Admin-only.
export async function diagnoseDibanana() {
  const key = apiKey();
  if (!key) return { configured: false, error: "DIBANANA_APIKEY belum diisi di environment." };

  const probes = [
    { label: "balance", path: "/balance", params: {} },
    { label: "services (ekonomi)", path: "/services", params: { server: "ekonomi" } },
    { label: "prices (wa/id/ekonomi)", path: "/prices", params: { service: "wa", country: "id", server: "ekonomi" } }
  ];

  const checks = [];
  for (const p of probes) {
    try {
      const res = await axios({
        method: "GET",
        url: `${BASE_URL}${p.path}`,
        params: p.params,
        timeout: 20000,
        validateStatus: () => true,
        decompress: true,
        headers: { Authorization: `Bearer ${key}`, accept: "application/json", "user-agent": "artapedia-nokos/1.0" }
      });
      const h = res.headers || {};
      const isJson = res.data && typeof res.data === "object";
      checks.push({
        probe: p.label,
        status: res.status,
        ok: res.status < 400 && isJson && res.data.ok !== false,
        respondedWithJson: isJson,
        apiError: isJson ? res.data.error || res.data.message || null : null,
        contentType: h["content-type"] || null,
        server: h["server"] || null,
        cfRay: h["cf-ray"] || null,
        bodySnippet: String(isJson ? JSON.stringify(res.data) : res.data).slice(0, 600)
      });
    } catch (err) {
      checks.push({ probe: p.label, networkError: err?.code || err?.message || "network" });
    }
  }

  const blocked = checks.filter((c) => c.status >= 400);
  const byCdn = blocked.length > 0 && blocked.every((c) => !c.respondedWithJson);
  return {
    configured: true,
    keyLength: key.length,
    keyTail: key.slice(-4),
    verdict:
      blocked.length === 0
        ? "Semua endpoint dibanana normal."
        : byCdn
        ? "Diblokir CDN/WAF di depan dibanana — respons bukan JSON."
        : "dibanana sendiri yang menolak. Lihat apiError di tiap baris.",
    checks
  };
}
