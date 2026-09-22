// Client API OTPMANIA (https://otpmania.biz.id/api-docs) — dipakai untuk:
//   1. Beli nomor OTP  (getServices, getCountries, getPrices, getNumber, getStatus, cancelActivation)
//   2. Deposit QRIS     (createDeposit, checkDeposit)
//
// API key WAJIB disimpan di environment variable OTPMANIA_APIKEY (server only).
// Jangan pernah dikirim ke browser atau ditulis langsung di kode, karena siapa pun
// yang pegang key ini bisa memakai saldo akun OTPMANIA kamu.
//
// Semua endpoint memakai satu URL dengan query `action`, autentikasi lewat header
// X-API-Key, dan membalas { success, data } atau { success:false, error }.
import axios from "axios";

const BASE_URL = "https://otpmania.biz.id/api/";

// Dua jalur gateway OTPMANIA. Dipakai sebagai dua "server" terpisah saat beli nokos.
export const OTPMANIA_SERVERS = [
  { id: "otpmania_s2", code: "s2", name: "Server Plus" },
  { id: "otpmania_s1", code: "s1", name: "Server Express" }
];

export function otpmaniaServerCode(id) {
  return OTPMANIA_SERVERS.find((s) => s.id === id)?.code || null;
}

export function isOtpmaniaServer(id) {
  return OTPMANIA_SERVERS.some((s) => s.id === id);
}

export class OtpmaniaError extends Error {
  constructor(message, status = 500, body = null) {
    super(message);
    this.name = "OtpmaniaError";
    this.status = status;
    this.body = body;
    // true = tidak ada respons HTTP sama sekali (timeout / jaringan putus), jadi
    // hasil aksinya di sisi OTPMANIA TIDAK diketahui (bisa sudah terproses).
    this.ambiguous = false;
  }
}

function apiKey() {
  return (process.env.OTPMANIA_APIKEY || "").trim();
}

export function otpmaniaConfigured() {
  return apiKey().length > 0;
}

// Ambil field pertama yang ada isinya, karena nama field antar endpoint bisa berbeda.
function pick(obj, names, fallback = null) {
  for (const n of names) {
    const v = obj?.[n];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function request(action, { params = {}, form = null, timeout = 20000 } = {}) {
  const key = apiKey();
  if (!key) throw new OtpmaniaError("OTPMANIA_APIKEY belum diisi di environment variables.", 500);

  let res;
  try {
    res = await axios({
      method: form ? "POST" : "GET",
      url: BASE_URL,
      params: { action, ...params },
      ...(form ? { data: new URLSearchParams(form).toString() } : {}),
      timeout,
      validateStatus: () => true,
      decompress: true,
      maxContentLength: 32 * 1024 * 1024,
      headers: {
        "X-API-Key": key,
        accept: "application/json",
        "accept-encoding": "gzip, deflate",
        "user-agent": "artapedia-nokos/1.0",
        ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {})
      }
    });
  } catch (err) {
    // Error jaringan axios menyimpan config lengkap (termasuk header X-API-Key).
    // Dibungkus ulang supaya key tidak ikut tercetak di log.
    const e = new OtpmaniaError(`Tidak bisa terhubung ke OTPMANIA (${err?.code || err?.message || "network"})`, 503);
    e.ambiguous = true;
    throw e;
  }

  const body = res.data;
  const isJson = body && typeof body === "object";

  if (res.status >= 400 || !isJson || body.success === false) {
    let msg = isJson ? pick(body, ["error", "message"]) : null;
    if (!msg) {
      const h = res.headers || {};
      console.error(
        `[otpmania] ${action} HTTP ${res.status} | server=${h["server"] || "-"} cf-ray=${h["cf-ray"] || "-"} ` +
          `type=${h["content-type"] || "-"} body=${String(isJson ? JSON.stringify(body) : body).slice(0, 300)}`
      );
      if (res.status === 401) msg = "API key OTPMANIA tidak valid.";
      else if (res.status === 403) msg = "OTPMANIA menolak permintaan (403). Cek Scope API key (harus Full) & IP Whitelist di profil OTPMANIA.";
      else if (res.status === 429) msg = "Terlalu banyak permintaan ke OTPMANIA, coba lagi sebentar.";
      else msg = `OTPMANIA merespons HTTP ${res.status}`;
    }
    throw new OtpmaniaError(msg, res.status, isJson ? body : null);
  }
  return body;
}

// Beberapa endpoint membungkus hasilnya di `data`, sebagian mungkin langsung di akar.
function payload(body) {
  return body?.data !== undefined && body?.data !== null ? body.data : body;
}

// Normalkan bentuk daftar: array, atau objek map {kode: nama} / {kode: {...}}.
function toList(raw, { idKeys, nameKeys }) {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (item && typeof item === "object") {
          const id = pick(item, idKeys);
          const name = pick(item, nameKeys, id);
          return id == null ? null : { id: String(id), name: String(name ?? id) };
        }
        return item == null ? null : { id: String(item), name: String(item) };
      })
      .filter(Boolean);
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw)
      .map(([key, value]) => {
        if (value && typeof value === "object") {
          const id = pick(value, idKeys, key);
          const name = pick(value, nameKeys, key);
          return { id: String(id), name: String(name) };
        }
        return { id: String(key), name: String(value ?? key) };
      })
      .filter((x) => x.id !== "");
  }
  return [];
}

// ---------------------------------------------------------------- Akun

export async function getOtpmaniaBalance() {
  const d = payload(await request("getBalance"));
  return num(pick(d, ["balance", "saldo", "amount"])) ?? 0;
}

// ---------------------------------------------------------------- Katalog

export async function getOtpmaniaServices() {
  const d = payload(await request("getServices"));
  return toList(d, {
    idKeys: ["service", "code", "slug", "id", "service_code"],
    nameKeys: ["name", "service_name", "title", "label"]
  });
}

export async function getOtpmaniaCountries() {
  const d = payload(await request("getCountries"));
  return toList(d, {
    idKeys: ["country", "id", "country_id", "code"],
    nameKeys: ["name", "country_name", "title", "rus", "eng"]
  });
}

// Harga untuk kombinasi layanan × negara × server. Tanpa `country`, sebagian
// gateway membalas seluruh negara sekaligus — itu yang dipakai untuk mengisi
// daftar negara tanpa memanggil endpoint ini berkali-kali (limit 60 req/menit).
export async function getOtpmaniaPrices({ service, country, server }) {
  const params = { service, server };
  if (country !== undefined && country !== null && country !== "") params.country = country;
  return payload(await request("getPrices", { params }));
}

export async function getOtpmaniaAvailability({ service, country, server }) {
  const d = payload(await request("getAvailability", { params: { service, country, server } }));
  return num(pick(d, ["count", "stock", "available", "qty"]));
}

// Ubah respons harga jadi daftar seragam { countryId, price, stock }.
// Menangani dua bentuk: satu baris untuk satu negara, atau map negara -> harga.
export function normalizeOtpmaniaPrices(raw, { countryHint } = {}) {
  const rows = [];
  const priceKeys = ["price", "cost", "harga", "amount"];
  const stockKeys = ["count", "stock", "available", "qty"];

  const pushRow = (countryId, value) => {
    if (value && typeof value === "object") {
      const price = num(pick(value, priceKeys));
      if (price === null || price <= 0) return;
      rows.push({ countryId: String(countryId), price, stock: num(pick(value, stockKeys)) });
    } else {
      const price = num(value);
      if (price !== null && price > 0) rows.push({ countryId: String(countryId), price, stock: null });
    }
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const cid = pick(item, ["country", "country_id", "id"], countryHint);
      if (cid != null) pushRow(cid, item);
    }
    return rows;
  }

  if (raw && typeof raw === "object") {
    // Satu baris berharga langsung (respons untuk satu negara).
    const direct = num(pick(raw, priceKeys));
    if (direct !== null) {
      const cid = pick(raw, ["country", "country_id", "id"], countryHint);
      if (cid != null) pushRow(cid, raw);
      return rows;
    }
    // Map negara -> harga / { price, count }.
    for (const [key, value] of Object.entries(raw)) pushRow(key, value);
  }
  return rows;
}

// ---------------------------------------------------------------- Order

export async function createOtpmaniaOrder({ service, country, operator = "any", server }) {
  const body = await request("getNumber", {
    form: { service, country: String(country), operator: operator || "any", server },
    timeout: 30000
  });
  const d = payload(body);
  const id = pick(d, ["id", "activation_id", "activationId", "order_id", "no"]);
  const number = pick(d, ["number", "phone", "phone_number", "phoneNumber", "msisdn"]);
  return {
    id: id == null ? null : String(id),
    number: number == null ? null : String(number),
    price: num(pick(d, ["price", "cost", "harga"])),
    expiredAt: pick(d, ["expired_at", "expires_at", "expiry", "expired"]),
    raw: d
  };
}

// Status OTPMANIA mengikuti gaya SMS-Activate: STATUS_WAIT_CODE (menunggu),
// STATUS_OK (kode masuk), STATUS_CANCEL (dibatalkan). Kode bisa datang sebagai
// field tersendiri atau menempel di string "STATUS_OK:123456".
export async function getOtpmaniaStatus(id) {
  const d = payload(await request("getStatus", { params: { id } }));

  let rawStatus = typeof d === "string" ? d : pick(d, ["status", "state"], "");
  let code = typeof d === "object" ? pick(d, ["code", "sms_code", "otp", "otp_code"]) : null;
  let text = typeof d === "object" ? pick(d, ["sms", "text", "message", "full_sms", "sms_text"]) : null;

  const s = String(rawStatus || "");
  if (s.includes(":")) {
    const [head, ...rest] = s.split(":");
    rawStatus = head;
    if (!code) code = rest.join(":").trim() || null;
  }

  return {
    status: normalizeOtpmaniaStatus(rawStatus),
    rawStatus: String(rawStatus || ""),
    code: code == null ? null : String(code),
    sms: text == null ? null : String(text),
    raw: d
  };
}

export function normalizeOtpmaniaStatus(raw) {
  const s = String(raw || "").toUpperCase().replace(/[\s-]+/g, "_");
  if (!s) return "pending";
  if (s.includes("OK") || s.includes("RECEIVED") || s.includes("SUCCESS") || s.includes("DONE")) return "done";
  if (s.includes("CANCEL") || s.includes("REJECT")) return "canceled";
  if (s.includes("EXPIR") || s.includes("TIMEOUT")) return "expired";
  if (s.includes("REFUND")) return "refund";
  return "pending";
}

// Status yang sudah final (tidak akan berubah lagi).
export const OTPMANIA_TERMINAL = ["canceled", "expired", "refund", "refunded"];

// cancelActivation = batal + refund otomatis di sisi OTPMANIA.
export async function cancelOtpmaniaOrder(id) {
  const body = await request("cancelActivation", { form: { id: String(id) } });
  return pick(payload(body), ["message", "status"], "Pesanan dibatalkan.");
}

// ---------------------------------------------------------------- Deposit

export async function createOtpmaniaDeposit({ amount }) {
  const d = payload(await request("createDeposit", { form: { amount: String(Math.floor(amount)) }, timeout: 25000 }));
  return {
    id: pick(d, ["transaction_id", "transactionId", "id", "trx_id", "code"]),
    qrString: pick(d, ["qr_string", "qris", "qr", "qris_string", "qr_content", "payment_number"]),
    qrImage: pick(d, ["qr_image", "qris_image", "qr_url", "image", "qr_image_url"]),
    paymentUrl: pick(d, ["payment_url", "checkout_url", "url"]),
    amount: num(pick(d, ["amount", "nominal"])),
    total: num(pick(d, ["total", "total_amount", "amount_total", "pay_amount"])),
    fee: num(pick(d, ["fee", "admin_fee", "biaya"])),
    expiredAt: pick(d, ["expired_at", "expires_at", "expiry", "expired"]),
    raw: d
  };
}

export async function getOtpmaniaDepositStatus(transactionId) {
  const d = payload(await request("checkDeposit", { params: { transaction_id: transactionId } }));
  return {
    status: normalizeOtpmaniaDepositStatus(pick(d, ["status", "state"])),
    rawStatus: String(pick(d, ["status", "state"], "")),
    amount: num(pick(d, ["amount", "nominal", "total"])),
    raw: d
  };
}

export function normalizeOtpmaniaDepositStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (["success", "completed", "paid", "settled", "done", "berhasil"].some((k) => s.includes(k))) return "completed";
  if (s.includes("cancel") || s.includes("batal")) return "canceled";
  if (s.includes("expire") || s.includes("kedaluwarsa")) return "expired";
  if (s.includes("fail") || s.includes("gagal")) return "failed";
  return "pending";
}

// ---------------------------------------------------------------- Diagnosa

// Menembak endpoint baca dan melaporkan APA yang sebenarnya dibalas, supaya
// bentuk respons bisa dicocokkan tanpa menebak. Hanya dipanggil dari route admin.
export async function diagnoseOtpmania() {
  const key = apiKey();
  if (!key) return { configured: false, error: "OTPMANIA_APIKEY belum diisi di environment." };

  const probes = [
    { label: "getBalance", action: "getBalance", params: {} },
    { label: "getServices", action: "getServices", params: {} },
    { label: "getCountries", action: "getCountries", params: {} },
    { label: "getPrices (wa/6/s2)", action: "getPrices", params: { service: "wa", country: "6", server: "s2" } },
    { label: "getPrices (wa, tanpa country)", action: "getPrices", params: { service: "wa", server: "s2" } }
  ];

  const checks = [];
  for (const p of probes) {
    try {
      const res = await axios({
        method: "GET",
        url: BASE_URL,
        params: { action: p.action, ...p.params },
        timeout: 20000,
        validateStatus: () => true,
        decompress: true,
        headers: { "X-API-Key": key, accept: "application/json", "user-agent": "artapedia-nokos/1.0" }
      });
      const h = res.headers || {};
      const isJson = res.data && typeof res.data === "object";
      checks.push({
        probe: p.label,
        status: res.status,
        ok: res.status < 400 && isJson && res.data.success !== false,
        respondedWithJson: isJson,
        apiError: isJson ? pick(res.data, ["error", "message"]) : null,
        contentType: h["content-type"] || null,
        server: h["server"] || null,
        cfRay: h["cf-ray"] || null,
        // Cuplikan dipakai untuk mencocokkan nama field; key tidak pernah ikut
        // karena dikirim lewat header, bukan URL.
        bodySnippet: String(isJson ? JSON.stringify(res.data) : res.data).slice(0, 700)
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
        ? "Semua endpoint OTPMANIA normal."
        : byCdn
        ? "Diblokir CDN/WAF di depan OTPMANIA — respons bukan JSON. Bukan soal izin akun."
        : "OTPMANIA sendiri yang menolak. Lihat apiError di tiap baris (cek Scope harus Full & IP Whitelist).",
    checks
  };
}
