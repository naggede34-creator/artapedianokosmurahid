// Client API AustinPay (https://austinstore.id) — dipakai untuk:
//   1. DEPOSIT "QRIS FAST"        — uang MASUK dari pembeli (QRIS dinamis, saldo masuk otomatis).
//   2. WITHDRAW INSTANT           — uang KELUAR ke e-wallet pengguna (penarikan saldo nokos & poin game, tanpa approval manual).
//   3. SALDO & PENARIKAN ADMIN    — melihat saldo akun AustinPay dan menariknya (HANYA dari endpoint admin).
//
// KEAMANAN
//   - API key & API secret WAJIB disimpan lewat Dasbor Admin → Konfigurasi (terenkripsi) atau Environment Variables
//     Vercel. Tidak pernah dikirim ke browser dan tidak ditulis di kode. Siapa pun yang memegangnya bisa
//     memindahkan uang KELUAR dari akun AustinPay.
//   - Bila API secret diisi, SETIAP request ditandatangani HMAC-SHA256 (X-Timestamp + X-Signature) dan API key dikirim
//     lewat header X-API-Key (bukan ?apikey=) agar tidak tercatat di log URL.
//   - AustinPay mewajibkan IP WHITELIST untuk Public API. Vercel tidak punya IP keluar yang tetap — pakai fitur
//     "Static IPs" Vercel, atau isi AUSTINPAY_PROXY (proxy HTTP di VPS ber-IP tetap) lalu daftarkan IP itu di AustinPay.
//
// Semua balasan berbentuk JSON { success: boolean, ... }; kegagalan dilempar sebagai Error dengan `.status` HTTP dan
// `.ambigu = true` bila hasilnya TIDAK PASTI (timeout/putus di tengah) — penting untuk penarikan, lihat lib/wdInstan.js.
import axios from "axios";
import crypto from "node:crypto";
import { cfg } from "@/lib/config";

export const AUSTIN_KEY = "qrisfast";

async function baseUrl() {
  return ((await cfg("AUSTINPAY_BASE_URL")) || "https://austinstore.id").trim().replace(/\/+$/, "");
}
export const austinApiKey = async () => ((await cfg("AUSTINPAY_APIKEY")) || "").trim();
export const austinApiSecret = async () => ((await cfg("AUSTINPAY_APISECRET")) || "").trim();
export async function austinConfigured() {
  return (await austinApiKey()).length > 0;
}

let agenCache = { url: "", agen: null };
async function agenProxy() {
  const url = ((await cfg("AUSTINPAY_PROXY")) || "").trim();
  if (!url) return null;
  if (agenCache.url === url && agenCache.agen) return agenCache.agen;
  try {
    const { HttpsProxyAgent } = await import("https-proxy-agent");
    agenCache = { url, agen: new HttpsProxyAgent(url) };
    return agenCache.agen;
  } catch (e) {
    console.error("[austinpay] proxy tidak bisa dipakai:", e?.message || e);
    return null;
  }
}

/** Tanda tangan HMAC-SHA256 (hex) sesuai dokumentasi: METHOD \n PATH \n BODY \n TIMESTAMP. */
export function tandaTangan(secret, method, path, body, timestamp) {
  return crypto.createHmac("sha256", secret).update(`${method}\n${path}\n${body}\n${timestamp}`).digest("hex");
}

function galat(pesan, status = 0, ekstra = {}) {
  const e = new Error(String(pesan || "Permintaan ke AustinPay gagal.").slice(0, 300));
  e.status = status;
  Object.assign(e, ekstra);
  return e;
}

/**
 * @param method GET | POST
 * @param path   pathname murni, mis. "/api/deposit/create" (tanpa query — yang ditandatangani HANYA path)
 */
async function panggil(method, path, { query = null, body = null, timeout = 20000 } = {}) {
  const apikey = await austinApiKey();
  if (!apikey) throw galat("API key AustinPay belum diisi (Dasbor Admin → Konfigurasi).", 0);
  const secret = await austinApiSecret();
  const BASE = await baseUrl();
  const mentah = body ? JSON.stringify(body) : "";
  const kepala = {
    "X-API-Key": apikey,
    Accept: "application/json",
    "User-Agent": "Artapedia/1.0 (+https://artapedia.id)"
  };
  if (mentah) kepala["Content-Type"] = "application/json";
  if (secret) {
    const ts = Date.now().toString();
    kepala["X-Timestamp"] = ts;
    kepala["X-Signature"] = tandaTangan(secret, method, path, mentah, ts);
  }
  const agen = await agenProxy();
  let res;
  try {
    res = await axios.request({
      method,
      url: `${BASE}${path}`,
      params: query || undefined,
      data: mentah || undefined,
      headers: kepala,
      timeout,
      validateStatus: () => true,
      responseType: "text",
      transformResponse: (x) => x,
      ...(agen ? { httpsAgent: agen, proxy: false } : {})
    });
  } catch (err) {
    // Putus/timeout SETELAH permintaan terkirim = hasil tidak pasti (untuk POST yang memindahkan uang).
    throw galat(`Tidak bisa menghubungi AustinPay (${err?.code || err?.message || "jaringan gagal"}).`, 0, { ambigu: method !== "GET" });
  }
  let data = null;
  try { data = JSON.parse(res.data); } catch {}
  if (!data || typeof data !== "object") {
    throw galat(`AustinPay membalas format tak dikenal (HTTP ${res.status}).`, res.status, { ambigu: method !== "GET" && res.status >= 500 });
  }
  if (data.success === false || res.status >= 400) {
    throw galat(data.message || data.error || `AustinPay menolak (HTTP ${res.status}).`, res.status, {
      // 5xx pada POST: server mungkin sempat memprosesnya.
      ambigu: method !== "GET" && res.status >= 500,
      kode: res.status
    });
  }
  return data;
}

// ─────────────────────────── AKUN ───────────────────────────
export async function austinAkun() {
  const d = await panggil("GET", "/api/account");
  const u = d.user || {};
  return { username: u.username || "", email: u.email || "", role: u.role || "", status: u.status || "", saldo: Number(u.wallet?.balance) || 0 };
}

export async function austinTransaksi({ page = 1, limit = 20, type, status } = {}) {
  const d = await panggil("GET", "/api/transactions", { query: { page, limit: Math.min(50, limit), ...(type ? { type } : {}), ...(status ? { status } : {}) } });
  return { data: Array.isArray(d.data) ? d.data : [], meta: d.meta || {} };
}

// ─────────────────────────── DEPOSIT (QRIS FAST) ───────────────────────────
/** amount = nominal yang DIKREDITKAN; `amount` pada balasan = nominal yang HARUS dibayar (sudah + fee + kode unik). */
export async function buatDepositAustin(amount) {
  const d = await panggil("POST", "/api/deposit/create", { body: { amount: Math.floor(Number(amount)) } });
  const x = d.deposit || {};
  return {
    id: String(x.transaction_id || ""),
    uuid: x.id || null,
    total: Number(x.amount) || Number(amount),
    kodeUnik: Number(x.unique_code) || 0,
    fee: Number(x.fee) || 0,
    qrString: x.qr_string || null,
    qrImage: x.qr_image || null,
    expiredAt: x.expired_at || null,
    status: x.status || "pending"
  };
}

export async function cekDepositAustin(transactionId) {
  const d = await panggil("GET", `/api/deposit/check/${encodeURIComponent(transactionId)}`, { timeout: 15000 });
  return { status: String(d.status || "pending").toLowerCase(), pesan: d.message || "" };
}

export async function batalDepositAustin(transactionId) {
  return panggil("POST", `/api/deposit/cancel/${encodeURIComponent(transactionId)}`, { timeout: 15000 });
}

/** paid → completed, pending → pending, expired → expired, cancel(led) → canceled. */
export function normalisasiStatusAustin(raw) {
  const s = String(raw || "").toLowerCase();
  if (["paid", "success", "completed", "settlement"].includes(s)) return "completed";
  if (["expired", "expire"].includes(s)) return "expired";
  if (["cancel", "canceled", "cancelled"].includes(s)) return "canceled";
  if (["failed", "failure", "error", "rejected"].includes(s)) return "failed";
  return "pending";
}

// ─────────────────────────── WITHDRAW INSTANT ───────────────────────────
let cacheDompet = { at: 0, data: null };
const CADANGAN_DOMPET = { DANA: "BBSDN", ShopeePay: "BBSSH" };

/** Daftar wallet instant beserta tipe nomor tujuan. Di-cache 5 menit. */
export async function dompetInstan({ segar = false } = {}) {
  if (!segar && cacheDompet.data && Date.now() - cacheDompet.at < 5 * 60_000) return cacheDompet.data;
  const d = await panggil("GET", "/api/instant-withdraw/wallets", { timeout: 15000 });
  const data = {
    wallets: Array.isArray(d.wallets) ? d.wallets.map(String) : [],
    tipe: d.wallet_types || {},
    bebasNominal: d.wallet_has_open_denom || {}
  };
  cacheDompet = { at: Date.now(), data };
  return data;
}

const cacheProduk = new Map(); // wallet → { at, item }
/** Produk "Bebas Nominal" (open_denom) milik satu wallet: { code, min, max, fee, tipeTujuan }. */
export async function produkBebas(wallet) {
  const c = cacheProduk.get(wallet);
  if (c && Date.now() - c.at < 10 * 60_000) return c.item;
  const d = await panggil("GET", "/api/instant-withdraw/products", { query: { wallet }, timeout: 15000 });
  const p = (Array.isArray(d.products) ? d.products : []).find((x) => x.open_denom === true);
  const item = p
    ? { code: String(p.code), min: Number(p.min) || 10000, max: Number(p.max) || 10_000_000, fee: Number(p.fee) || 0, tipeTujuan: p.destination_type || "phone" }
    : CADANGAN_DOMPET[wallet] ? { code: CADANGAN_DOMPET[wallet], min: 10000, max: 10_000_000, fee: 0, tipeTujuan: "phone" } : null;
  if (item) cacheProduk.set(wallet, { at: Date.now(), item });
  return item;
}

/**
 * Kirim penarikan instant bebas-nominal. Saldo AKUN AUSTINPAY (milik admin) dipotong oleh AustinPay.
 * Melempar Error; `.ambigu === true` berarti hasil belum pasti (jangan langsung dikembalikan ke pengguna).
 */
export async function kirimInstan({ wallet, productCode, phone, nominal }) {
  const d = await panggil("POST", "/api/instant-withdraw/create", {
    body: { wallet, product_code: productCode, phone, nominal: Math.floor(Number(nominal)) },
    timeout: 30000
  });
  return { id: String(d.id || ""), status: String(d.status || "processing").toLowerCase(), pesan: d.message || "" };
}

export async function riwayatInstan({ page = 1, limit = 20, status } = {}) {
  const d = await panggil("GET", "/api/instant-withdraw/history", { query: { page, limit: Math.min(50, limit), ...(status ? { status } : {}) }, timeout: 20000 });
  return {
    data: (Array.isArray(d.data) ? d.data : []).map((x) => ({
      id: String(x.id), wallet: x.wallet, phone: x.phone, productCode: x.product_code, nominal: Number(x.nominal) || 0,
      sellPrice: Number(x.sell_price) || 0, status: String(x.status || "").toLowerCase(), pesan: x.provider_response || "", createdAt: x.createdAt, updatedAt: x.updatedAt
    })),
    total: Number(d.total) || 0
  };
}

export function normalisasiStatusInstan(raw) {
  const s = String(raw || "").toLowerCase();
  if (["success", "completed", "paid", "done"].includes(s)) return "sukses";
  if (["failed", "failure", "error", "rejected", "canceled", "cancelled"].includes(s)) return "gagal";
  return "proses";
}

// ─────────────────────────── WITHDRAW BIASA (butuh persetujuan AustinPay) — admin ───────────────────────────
export async function metodeWithdrawAustin() {
  const d = await panggil("GET", "/api/withdraw/methods", { timeout: 15000 });
  return Array.isArray(d.methods) ? d.methods.map(String) : [];
}
export async function buatWithdrawAustin({ amount, method, accountNumber, accountName, note }) {
  const d = await panggil("POST", "/api/withdraw/create", {
    body: { amount: Math.floor(Number(amount)), method, account_number: accountNumber, account_name: accountName, ...(note ? { note } : {}) },
    timeout: 30000
  });
  return { id: d.withdraw_id || null, pesan: d.message || "" };
}

// ─────────────────────────── DIAGNOSA ───────────────────────────
/** Dipakai tombol "Cek Koneksi" di panel admin. Tidak pernah membocorkan key/secret. */
export async function diagnosaAustin() {
  const hasil = { terkonfigurasi: await austinConfigured(), hmac: !!(await austinApiSecret()), proxy: !!((await cfg("AUSTINPAY_PROXY")) || "").trim(), baseUrl: await baseUrl() };
  if (!hasil.terkonfigurasi) return { ...hasil, ok: false, pesan: "API key belum diisi." };
  try {
    const a = await austinAkun();
    return { ...hasil, ok: true, akun: { username: a.username, status: a.status }, saldo: a.saldo, pesan: "Terhubung." };
  } catch (e) {
    const wl = e.status === 403 ? " IP server belum masuk whitelist AustinPay (lihat petunjuk IP di panel)." : e.status === 401 ? " API key/secret/signature ditolak." : "";
    return { ...hasil, ok: false, status: e.status || 0, pesan: `${e.message}${wl}` };
  }
}
