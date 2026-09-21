// Client API VirtuSIM (https://virtusim.com) — dipakai untuk:
//   1. Server "Nokos OTP Fast"  (beli nomor OTP: layanan + negara Indonesia)
//   2. Deposit QRIS otomatis    (metode deposit tambahan)
//
// Semua request GET ke https://virtusim.com/api/v2/json.php?api_key=...&action=...
// API key WAJIB disimpan di environment variable VIRTUSIM_APIKEY (server only).
//
// Endpoint yang tertulis jelas di dokumentasi VirtuSIM:
//   list_country, list_operator, active_order, order, reactive_order
// Nama action lain (services, status, set_status, balance, deposit*) belum ada di
// potongan dokumentasi yang dipakai saat integrasi ini dibuat, jadi semuanya
// dikumpulkan di objek ACTIONS di bawah dan bisa diganti lewat environment variable
// TANPA mengubah kode lain. Cocokkan dengan bagian Service / Transaction / Deposit di
// https://documenter.getpostman.com/view/8450770/2sB2cYbf7Z
import axios from "axios";

const BASE_URL = "https://virtusim.com/api/v2/json.php";

const ACTIONS = {
  balance: process.env.VIRTUSIM_ACTION_BALANCE || "balance",
  services: process.env.VIRTUSIM_ACTION_SERVICES || "services",
  order: "order",
  status: process.env.VIRTUSIM_ACTION_STATUS || "status",
  setStatus: process.env.VIRTUSIM_ACTION_SET_STATUS || "set_status",
  activeOrder: "active_order",
  depositCreate: process.env.VIRTUSIM_ACTION_DEPOSIT || "deposit",
  depositStatus: process.env.VIRTUSIM_ACTION_DEPOSIT_STATUS || "deposit_status",
  depositCancel: process.env.VIRTUSIM_ACTION_DEPOSIT_CANCEL || "deposit_cancel"
};

// Nilai parameter `status` untuk membatalkan pesanan lewat action set_status.
const CANCEL_STATUS_VALUE = process.env.VIRTUSIM_CANCEL_STATUS || "2";

export class VirtusimError extends Error {
  constructor(message, status = 500, body = null) {
    super(message);
    this.name = "VirtusimError";
    this.status = status;
    this.body = body;
    // true = tidak ada respons HTTP sama sekali (timeout / jaringan putus), jadi hasil
    // aksinya di sisi VirtuSIM TIDAK diketahui.
    this.ambiguous = false;
  }
}

function apiKey() {
  return (process.env.VIRTUSIM_APIKEY || "").trim();
}

export function virtusimConfigured() {
  return apiKey().length > 0;
}

// Negara yang dipakai server "Nokos OTP Fast". Default Indonesia.
export function virtusimCountry() {
  return (process.env.VIRTUSIM_COUNTRY || "Indonesia").trim();
}

// Perkiraan masa aktif nomor (menit) kalau VirtuSIM tidak mengirim waktu kedaluwarsa.
export function virtusimTtlMs() {
  const m = Number(process.env.VIRTUSIM_TTL_MINUTES || 20);
  return (Number.isFinite(m) && m > 0 ? m : 20) * 60 * 1000;
}

// ---------------------------------------------------------------- helpers

function pick(obj, names) {
  for (const n of names) {
    if (obj?.[n] !== undefined && obj[n] !== null && obj[n] !== "") return obj[n];
  }
  return null;
}

function toNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function errText(body, fallback) {
  const v = body?.msg ?? body?.message ?? body?.data?.msg ?? body?.data?.message ?? body?.error;
  if (!v) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "object") return v.message || v.msg || JSON.stringify(v);
  return String(v);
}

// data bisa berupa object tunggal, array, atau object berindeks id.
function firstObj(d) {
  if (Array.isArray(d)) return d[0] || {};
  return d && typeof d === "object" ? d : {};
}

function toList(d) {
  if (Array.isArray(d)) return d;
  if (d && typeof d === "object") {
    return Object.entries(d)
      .map(([k, v]) => (v && typeof v === "object" ? { id: k, ...v } : null))
      .filter(Boolean);
  }
  return [];
}

// Waktu dari VirtuSIM bisa epoch (detik / ms) atau string jam WIB tanpa zona.
export function virtusimEpochMs(value) {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).trim();
  if (/^\d{9,10}$/.test(str)) return Number(str) * 1000;
  if (/^\d{12,}$/.test(str)) return Number(str);
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(str)) {
    const n = new Date(str).getTime();
    return Number.isFinite(n) ? n : null;
  }
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    const [, y, mo, d, h, mi, s] = m.map(Number);
    return Date.UTC(y, mo - 1, d, h, mi, s) - 7 * 60 * 60 * 1000; // WIB
  }
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : null;
}

async function request(action, params = {}, { timeout = 20000 } = {}) {
  const key = apiKey();
  if (!key) throw new VirtusimError("VIRTUSIM_APIKEY belum diisi di environment variables.", 500);

  let res;
  try {
    res = await axios.get(BASE_URL, {
      params: { api_key: key, action, ...params },
      timeout,
      validateStatus: () => true,
      headers: { accept: "application/json" }
    });
  } catch (err) {
    // Error axios menyimpan URL lengkap (termasuk api_key) — dibungkus ulang supaya
    // key tidak tercetak di log.
    const e = new VirtusimError(`Tidak bisa terhubung ke VirtuSIM (${err?.code || "network"})`, 503);
    e.ambiguous = true;
    throw e;
  }

  let body = res.data;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      /* biarkan, ditangani di bawah */
    }
  }
  if (res.status >= 400 || !body || typeof body !== "object") {
    throw new VirtusimError(res.status === 401 ? "API key VirtuSIM tidak valid." : `VirtuSIM merespons HTTP ${res.status}`, res.status, null);
  }
  if (body.status === false || body.success === false) {
    throw new VirtusimError(errText(body, "Permintaan ditolak VirtuSIM."), res.status || 400, body);
  }
  return body;
}

// ---------------------------------------------------------------- Akun

export async function getVirtusimBalance() {
  const body = await request(ACTIONS.balance);
  const d = firstObj(body.data ?? body);
  return toNum(pick(d, ["balance", "saldo"])) ?? 0;
}

// ---------------------------------------------------------------- Layanan

export async function getVirtusimCountries() {
  const body = await request("list_country");
  return toList(body.data ?? body);
}

export async function getVirtusimOperators(country = virtusimCountry()) {
  const body = await request("list_operator", { country });
  return Array.isArray(body.data) ? body.data : [];
}

// Daftar layanan (WhatsApp, Telegram, dst) untuk satu negara, sudah dinormalisasi:
// [{ id, name, price, stock, img }]
export async function getVirtusimServices({ country = virtusimCountry() } = {}) {
  const body = await request(ACTIONS.services, { country });
  return toList(body.data ?? body)
    .map((s) => {
      const id = pick(s, ["id", "service_id", "code", "service"]);
      let name = pick(s, ["name", "service_name", "title", "app"]);
      if (!name) {
        const alt = pick(s, ["service"]);
        if (alt && Number.isNaN(Number(alt))) name = alt;
      }
      return {
        id: id !== null ? String(id) : null,
        name: name ? String(name) : null,
        price: toNum(pick(s, ["price", "cost", "harga", "rate"])),
        stock: toNum(pick(s, ["stock", "count", "qty", "quantity", "available", "total"])),
        img: pick(s, ["img", "image", "icon", "logo"])
      };
    })
    .filter((s) => s.id && s.name && s.price && s.price > 0);
}

// WhatsApp selalu paling atas, sisanya tetap urutan asli dari VirtuSIM.
export function isWhatsapp(name = "") {
  return /whats\s*app|^wa$|^wa\b/i.test(String(name).trim());
}

export function sortWhatsappFirst(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ra = isWhatsapp(a.item.name) ? 0 : 1;
      const rb = isWhatsapp(b.item.name) ? 0 : 1;
      return ra !== rb ? ra - rb : a.index - b.index;
    })
    .map((x) => x.item);
}

// ---------------------------------------------------------------- Transaksi

function parseOrder(d, fallbackId) {
  const id = pick(d, ["id", "order_id", "trx_id", "transaction_id"]);
  const number = pick(d, ["number", "phone", "phone_number", "msisdn"]);
  let sms = pick(d, ["sms", "otp", "otp_code", "code", "message", "text"]);
  if (Array.isArray(sms)) sms = sms.map((x) => (typeof x === "object" ? pick(x, ["sms", "text", "message", "code"]) : x)).filter(Boolean).join(" ");
  const rawStatus = pick(d, ["status", "state", "status_text"]);
  return {
    id: String(id ?? fallbackId ?? ""),
    number: number ? String(number) : null,
    price: toNum(pick(d, ["price", "cost"])),
    expiredAt: virtusimEpochMs(pick(d, ["expired_at", "expires_at", "expired", "expire_at", "expire"])),
    sms: sms ? String(sms) : null,
    rawStatus: rawStatus !== null ? String(rawStatus) : null
  };
}

// Pesan nomor baru. `operator` boleh "any" (dari list_operator).
export async function createVirtusimOrder({ serviceId, operator = "any" }) {
  const body = await request(ACTIONS.order, { service: serviceId, operator }, { timeout: 30000 });
  const order = parseOrder(firstObj(body.data ?? body));
  if (!order.id) throw new VirtusimError("Respons VirtuSIM tidak lengkap, coba lagi.", 502, body);
  return order;
}

export async function getVirtusimActiveOrders() {
  try {
    const body = await request(ACTIONS.activeOrder);
    return toList(body.data ?? body).map((o) => parseOrder(o));
  } catch (err) {
    if (/no active/i.test(err?.message || "")) return [];
    throw err;
  }
}

// Status satu pesanan. Kalau action status gagal, coba cari di daftar active_order.
export async function getVirtusimOrder(id) {
  try {
    const body = await request(ACTIONS.status, { id });
    return parseOrder(firstObj(body.data ?? body), id);
  } catch (err) {
    if (err.ambiguous) throw err;
    const list = await getVirtusimActiveOrders().catch(() => null);
    const found = list?.find((o) => String(o.id) === String(id));
    if (found) return found;
    throw err;
  }
}

// Status VirtuSIM -> label yang dimengerti lib/orderReconcile.js.
// Kode numerik sengaja dianggap "pending": nilainya tidak tertulis di dokumentasi,
// jadi keputusan sukses ditentukan dari ADA-nya kode SMS, dan kedaluwarsa dari waktu.
export function normalizeVirtusimOrderStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (s.includes("cancel")) return "canceled";
  if (s.includes("expire") || s.includes("timeout") || s.includes("time out")) return "expired";
  if (s.includes("refund")) return "refunded";
  return "pending";
}

export async function cancelVirtusimOrder(id) {
  const body = await request(ACTIONS.setStatus, { id, status: CANCEL_STATUS_VALUE });
  return errText(body, "");
}

// ---------------------------------------------------------------- Deposit

export async function createVirtusimDeposit({ amount }) {
  const method = process.env.VIRTUSIM_DEPOSIT_METHOD || "qris";
  const body = await request(ACTIONS.depositCreate, { method, amount: Math.floor(amount) }, { timeout: 25000 });
  const d = firstObj(body.data ?? body);
  const id = pick(d, ["id", "deposit_id", "trx_id", "order_id", "transaction_id"]);
  return {
    id: id !== null ? String(id) : null,
    qrString: pick(d, ["qr_string", "qris", "qris_string", "payment_number", "qr_code", "qris_content"]),
    qrImage: pick(d, ["qr_image", "qr_image_url", "qr_url", "qrcode", "qris_image", "qr_base64"]),
    paymentUrl: pick(d, ["payment_url", "checkout_url", "payment_link", "url"]),
    fee: toNum(pick(d, ["fee", "admin_fee", "biaya_admin", "total_fee"])),
    total: toNum(pick(d, ["total", "total_amount", "amount_total", "pay_amount", "total_pembayaran"])),
    expiredAt: virtusimEpochMs(pick(d, ["expired_at", "expires_at", "expired", "expire_at", "expire"]))
  };
}

// Mengembalikan status ter-normalisasi: pending | completed | canceled | expired | failed
export async function getVirtusimDepositStatus(id) {
  const body = await request(ACTIONS.depositStatus, { id });
  const d = firstObj(body.data ?? body);
  return normalizeVirtusimDepositStatus(d);
}

// Hanya kata yang jelas yang dianggap lunas. Angka/kode yang tidak dikenal = pending,
// supaya saldo tidak pernah dikreditkan karena salah tafsir.
export function normalizeVirtusimDepositStatus(d) {
  if (d?.paid === true || d?.is_paid === true) return "completed";
  const s = String(pick(d, ["status", "state", "status_text"]) || "").toLowerCase();
  if (["success", "completed", "complete", "paid", "done", "settlement", "berhasil", "sukses"].includes(s)) return "completed";
  if (s.includes("expire")) return "expired";
  if (s.includes("cancel")) return "canceled";
  if (s === "failed" || s === "failure" || s === "error") return "failed";
  return "pending";
}

export async function cancelVirtusimDeposit(id) {
  const body = await request(ACTIONS.depositCancel, { id });
  return errText(body, "");
}
