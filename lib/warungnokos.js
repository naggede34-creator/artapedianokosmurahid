// Client API WarungNokos (https://warungnokos.web.id) — dipakai untuk:
//   1. Beli nomor OTP (dua sistem API terpisah = dua "server" di web ini)
//   2. Deposit QRIS
//
// API key WAJIB disimpan di environment variable WARUNGNOKOS_APIKEY (server only).
// Jangan pernah dikirim ke browser atau ditulis langsung di kode, karena siapa pun
// yang pegang key ini bisa memakai saldo akun WarungNokos kamu.
//
// WarungNokos punya DUA sistem API yang bentuk datanya berbeda jauh:
//
//   Server Plus (H2H utama, /api/otp/*)
//     order pakai number_id + provider_id + operator_id, id transaksi trxId
//
//   Server Express (Server 2, /api/warkosv3/*)
//     alur negara → layanan → produk; order pakai country_id + service_id +
//     product_id, id transaksi trxId. Daftar layanannya PER NEGARA.
//
// Keduanya dibungkus di sini supaya sisa aplikasi tidak perlu tahu bedanya:
// tiap pilihan harga diberi satu field `key` yang isinya cukup untuk order.
import axios from "axios";
import { cfg } from "@/lib/config";

// Dibaca tiap panggilan supaya perubahan dari web langsung berlaku.
async function baseUrl() {
  return ((await cfg("WARUNGNOKOS_BASE_URL")) || "https://warungnokos.web.id").trim().replace(/\/+$/, "");
}

// Dua server nokos. id dipakai di seluruh aplikasi & tersimpan di DB.
export const WARUNGNOKOS_SERVERS = [
  { id: "warungnokos_s1", api: "otp", name: "Server Plus" },
  { id: "warungnokos_s2", api: "warkosv3", name: "Server Express" }
];

export function warungNokosApi(id) {
  return WARUNGNOKOS_SERVERS.find((s) => s.id === id)?.api || null;
}

export function isWarungNokosServer(id) {
  return WARUNGNOKOS_SERVERS.some((s) => s.id === id);
}

// Status akhir pesanan — setelah ini tidak perlu ditanya lagi ke provider.
export const WARUNGNOKOS_TERMINAL = ["completed", "canceled", "expired", "failed"];

export class WarungNokosError extends Error {
  constructor(message, status = 500, body = null) {
    super(message);
    this.name = "WarungNokosError";
    this.status = status;
    this.body = body;
    // true = tidak ada respons HTTP sama sekali (timeout / jaringan putus), jadi
    // hasil aksinya di sisi WarungNokos TIDAK diketahui (bisa sudah terproses).
    this.ambiguous = false;
  }
}

async function apiKey() {
  return ((await cfg("WARUNGNOKOS_APIKEY")) || "").trim();
}

export async function warungNokosConfigured() {
  return (await apiKey()).length > 0;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pick(obj, names, fallback = null) {
  for (const n of names) {
    const v = obj?.[n];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}

const toList = (v) => (Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : []);

async function request(method, path, { params, data, timeout = 25000 } = {}) {
  const key = await apiKey();
  const BASE = await baseUrl();
  if (!key) throw new WarungNokosError("WARUNGNOKOS_APIKEY belum diisi (Dasbor Admin → Konfigurasi, atau Environment Variables Vercel)", 500);

  let res;
  try {
    res = await axios({
      method,
      url: `${BASE}${path}`,
      params,
      data,
      timeout,
      validateStatus: () => true,
      decompress: true,
      headers: {
        "x-api-key": key,
        accept: "application/json",
        "user-agent": "artapedia-nokos/1.0",
        ...(data ? { "content-type": "application/json" } : {})
      }
    });
  } catch (err) {
    // Error jaringan axios menyimpan config lengkap (termasuk header x-api-key).
    // Dibungkus ulang supaya key tidak ikut tercetak di log.
    const e = new WarungNokosError(
      `Tidak bisa terhubung ke WarungNokos (${err?.code || err?.message || "network"})`,
      503
    );
    e.ambiguous = true;
    throw e;
  }

  const body = res.data;
  if (res.status === 401 || res.status === 403) {
    throw new WarungNokosError(
      pick(body, ["message", "error"], "API key WarungNokos ditolak. Cek lagi WARUNGNOKOS_APIKEY."),
      res.status,
      body
    );
  }
  if (res.status >= 400) {
    throw new WarungNokosError(pick(body, ["message", "error"], `WarungNokos error ${res.status}`), res.status, body);
  }
  if (body && body.success === false) {
    throw new WarungNokosError(pick(body, ["message", "error"], "Permintaan ditolak WarungNokos."), 400, body);
  }
  return body;
}

// ─────────────────────── KATALOG SERVER EXPRESS (warkosv3) ───────────────────────
//
// API ini menanyakan layanan PER NEGARA (/services?country_id=) dan harga per
// negara+layanan (/products), sedangkan aplikasi memilih layanan dulu baru
// negara. Jadi layanan dari semua negara digabung berdasarkan namanya, dan
// kode layanan di aplikasi = nama yang disederhanakan (mis. "whatsapp"). Saat
// order, kode itu diterjemahkan lagi ke service_id milik masing-masing negara,
// jadi tidak bergantung pada id yang sama di semua negara.
const V3_TTL_MS = 10 * 60 * 1000;
const V3_PRODUK_TTL_MS = 60 * 1000;
let v3Katalog = null; // { at, countries: [{id,name,dial}], services: Map(countryId → [{id,name,slug}]) }
let v3KatalogJanji = null;
const v3Produk = new Map(); // "cid:sid" → { at, list }

const slugLayanan = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

// Menjalankan tugas dengan batas paralel supaya tidak membanjiri API provider.
async function paralel(items, batas, fn) {
  const hasil = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(batas, items.length) }, async () => {
      while (i < items.length) {
        const n = i++;
        try { hasil[n] = await fn(items[n]); } catch { hasil[n] = null; }
      }
    })
  );
  return hasil;
}

async function muatKatalogV3() {
  if (v3Katalog && Date.now() - v3Katalog.at < V3_TTL_MS) return v3Katalog;
  if (v3KatalogJanji) return v3KatalogJanji;
  v3KatalogJanji = (async () => {
    const body = await request("GET", "/api/warkosv3/countries");
    const countries = toList(body.data)
      .map((c) => ({
        id: String(pick(c, ["id"], "")),
        name: String(pick(c, ["name"], "-")),
        dial: pick(c, ["dial_code"], null)
      }))
      .filter((c) => c.id);
    const services = new Map();
    const hasil = await paralel(countries, 6, async (c) => {
      const b = await request("GET", "/api/warkosv3/services", { params: { country_id: c.id } });
      return toList(b.data)
        .map((x) => ({ id: String(pick(x, ["id"], "")), name: String(pick(x, ["name"], "")) }))
        .filter((x) => x.id && x.name)
        .map((x) => ({ ...x, slug: slugLayanan(x.name) }));
    });
    countries.forEach((c, i) => { if (hasil[i]?.length) services.set(c.id, hasil[i]); });
    v3Katalog = { at: Date.now(), countries, services };
    return v3Katalog;
  })();
  try { return await v3KatalogJanji; } finally { v3KatalogJanji = null; }
}

async function produkV3(countryId, serviceId) {
  const k = `${countryId}:${serviceId}`;
  const hit = v3Produk.get(k);
  if (hit && Date.now() - hit.at < V3_PRODUK_TTL_MS) return hit.list;
  let list = [];
  try {
    const b = await request("GET", "/api/warkosv3/products", { params: { country_id: countryId, service_id: serviceId } });
    list = toList(b.data);
  } catch (e) {
    // 400 "tidak tersedia" / 404 = negara ini tidak punya produk untuk layanan itu.
    if (!(e instanceof WarungNokosError) || ![400, 404].includes(e.status)) throw e;
  }
  v3Produk.set(k, { at: Date.now(), list });
  return list;
}

// ─────────────────────────── KATALOG ───────────────────────────

// Daftar layanan. Bentuk hasilnya disamakan untuk kedua server: { code, name, img }.
export async function getWarungNokosServices(serverId) {
  const api = warungNokosApi(serverId);
  if (api === "warkosv3") {
    const kat = await muatKatalogV3();
    const unik = new Map();
    for (const list of kat.services.values()) {
      for (const sv of list) if (!unik.has(sv.slug)) unik.set(sv.slug, { code: sv.slug, name: sv.name, img: null });
    }
    return [...unik.values()].filter((s) => s.code);
  }

  const body = await request("GET", "/api/otp/services");
  return toList(body.data)
    .map((s) => ({
      code: String(pick(s, ["service_code", "id"], "")),
      name: String(pick(s, ["service_name", "name"], "")),
      img: pick(s, ["service_img"], null)
    }))
    .filter((s) => s.code && s.name);
}

/**
 * Daftar negara + harga untuk satu layanan.
 * Diseragamkan jadi:
 *   { countryId, name, prefix, flag, pricelist: [{ key, price, stock, rate, label }] }
 * `key` adalah satu-satunya nilai yang perlu dikirim balik saat order.
 */
export async function getWarungNokosCountries(serverId, serviceId, { countryId: hanyaNegara } = {}) {
  const api = warungNokosApi(serverId);

  if (api === "warkosv3") {
    const kat = await muatKatalogV3();
    const slug = slugLayanan(serviceId);
    // `hanyaNegara` dipakai saat order: cukup satu negara, bukan semuanya.
    const target = kat.countries.filter((c) => !hanyaNegara || String(c.id) === String(hanyaNegara));
    const baris = await paralel(target, 6, async (c) => {
      const list = kat.services.get(c.id) || [];
      // Cocokkan lewat nama; id mentah juga diterima supaya pesanan lama
      // (yang menyimpan id layanan angka) masih bisa dihitung ulang.
      const sv = list.find((x) => x.slug === slug) || list.find((x) => x.id === String(serviceId));
      if (!sv) return null;
      const produk = await produkV3(c.id, sv.id);
      const pricelist = produk
        .map((p) => ({
          // product_id:service_id:country_id — cukup untuk order di Server Express.
          key: `${pick(p, ["id"])}:${sv.id}:${c.id}`,
          price: num(pick(p, ["price"])) ?? 0,
          stock: null, // API tidak melaporkan stok; produk yang ada = tersedia.
          rate: null,
          label: String(pick(p, ["name"], "Server"))
        }))
        .filter((p) => p.price > 0)
        .sort((a, b) => a.price - b.price);
      if (!pricelist.length) return null;
      return { countryId: c.id, name: c.name, flag: null, prefix: c.dial, pricelist };
    });
    return baris.filter(Boolean);
  }

  const body = await request("GET", `/api/otp/countries/${encodeURIComponent(serviceId)}`);
  return toList(body.data)
    .map((c) => {
      const numberId = pick(c, ["number_id", "id"]);
      return {
        countryId: String(numberId),
        name: String(pick(c, ["name"], "-")),
        prefix: pick(c, ["prefix"], null),
        flag: null,
        pricelist: toList(c.pricelist)
          .map((p) => ({
            // number_id:provider_id — cukup untuk order di server utama.
            key: `${numberId}:${pick(p, ["provider_id"])}`,
            price: num(pick(p, ["price"])) ?? 0,
            stock: num(pick(p, ["stock"])),
            rate: num(pick(p, ["rate"])),
            label: `Server ${pick(p, ["server_id"], "?")}`
          }))
          .filter((p) => p.price > 0)
          .sort((a, b) => a.price - b.price)
      };
    })
    .filter((c) => c.pricelist.length > 0);
}

// Daftar operator. Hanya server utama yang menyediakannya; Server2 selalu otomatis.
export async function getWarungNokosOperators(serverId, { countryName, providerId }) {
  if (warungNokosApi(serverId) !== "otp") return [];
  const body = await request(
    "GET",
    `/api/otp/operators/${encodeURIComponent(String(countryName || "").toLowerCase())}/${encodeURIComponent(providerId)}`
  );
  return toList(body.data)
    .map((o) => ({ code: String(pick(o, ["id"], "any")), name: String(pick(o, ["name"], "any")) }))
    .filter((o) => o.code);
}

// ─────────────────────────── ORDER ───────────────────────────

/**
 * Beli nomor. `key` berasal dari pricelist di getWarungNokosCountries.
 *
 * Catatan penting soal price_jual (server utama): dokumentasi menyebutnya
 * "harga modal + markup Anda", tetapi respons order mengembalikan `amount` yang
 * sama persis dengan nilai yang dikirim. Karena tidak jelas apakah nilai itu
 * yang dipotong dari saldo WarungNokos, yang dikirim SELALU harga modal dari
 * pricelist. Markup ke user tetap dihitung di sisi kita sendiri, jadi tidak ada
 * risiko saldo provider terpotong lebih besar dari semestinya.
 */
export async function createWarungNokosOrder(serverId, { key, operator = "any", modalPrice, serviceName }) {
  const api = warungNokosApi(serverId);

  let body;
  if (api === "warkosv3") {
    const [productId, serviceId, countryId] = String(key).split(":");
    if (!productId || !serviceId || !countryId) throw new WarungNokosError("Pilihan negara tidak valid.", 400);
    // Harga tidak dikirim: dihitung ulang di server WarungNokos.
    body = await request("POST", "/api/warkosv3/order", {
      data: {
        country_id: Number(countryId),
        service_id: Number(serviceId),
        product_id: Number(productId),
        ...(serviceName ? { service_name: serviceName } : {})
      }
    });
  } else {
    const [numberId, providerId] = String(key).split(":");
    if (!numberId || !providerId) throw new WarungNokosError("Pilihan negara tidak valid.", 400);
    body = await request("POST", "/api/otp/order", {
      data: {
        number_id: String(numberId),
        provider_id: String(providerId),
        operator_id: operator || "any",
        price_jual: Math.round(Number(modalPrice)),
        ...(serviceName ? { service_name: serviceName } : {})
      }
    });
  }

  const d = body?.data || body;
  const id = pick(d, ["trxId", "trx_id", "order_id"]);
  if (!id) throw new WarungNokosError("Respons WarungNokos tidak berisi ID pesanan.", 502, d);
  return {
    id: String(id),
    number: pick(d, ["phoneNumber", "phone_number", "number"], null),
    price: num(pick(d, ["amount", "price"])),
    serviceName: pick(d, ["serviceName"], null)
  };
}

// Status pesanan. OTP muncul saat status "completed".
export async function getWarungNokosStatus(serverId, trxId) {
  const api = warungNokosApi(serverId);
  const path = api === "warkosv3" ? "/api/warkosv3/status/" : "/api/otp/status/";
  let body;
  try {
    body = await request("GET", `${path}${encodeURIComponent(trxId)}`);
  } catch (e) {
    // Pesanan Server Express yang dibuat SEBELUM pindah ke API baru hanya
    // dikenal oleh API lama. 404 di sini → tanya ke jalur lama sekali.
    if (api === "warkosv3" && e?.status === 404) body = await request("GET", `/api/smscode/status/${encodeURIComponent(trxId)}`);
    else throw e;
  }
  const raw = String(pick(body, ["status"], "")).toLowerCase();
  const otpRaw = pick(body, ["otp_code", "otp"], null);
  const otp = otpRaw ? String(otpRaw).trim() : null;
  return { status: normalizeWarungNokosStatus(raw, otp), rawStatus: raw, otp, raw: body };
}

export function normalizeWarungNokosStatus(raw, otp = null) {
  const s = String(raw || "").toLowerCase();
  if (s === "completed" || s === "success" || s === "done") return otp ? "done" : "completed";
  if (s === "canceled" || s === "cancelled" || s === "cancel") return "canceled";
  if (s === "expired" || s === "timeout") return "expired";
  if (s === "failed" || s === "error") return "failed";
  return "pending";
}

// Batalkan pesanan. Saldo di sisi WarungNokos dikembalikan otomatis.
export async function cancelWarungNokosOrder(serverId, trxId) {
  const api = warungNokosApi(serverId);
  if (api === "warkosv3") {
    try {
      return await request("POST", "/api/warkosv3/cancel", { data: { trxId } });
    } catch (e) {
      // Pesanan lama (dibuat lewat API sebelumnya) dibatalkan lewat jalur lamanya.
      if (e?.status === 404) return request("POST", "/api/smscode/cancel", { data: { trxId } });
      throw e;
    }
  }
  return request("POST", "/api/otp/set_status", { data: { trxId, action_status: "cancel" } });
}

// ─────────────────────────── DEPOSIT QRIS ───────────────────────────

export const WARUNGNOKOS_DEPOSIT_KEY = "warungnokos";

/**
 * Buat tagihan QRIS. Maksimal 3 transaksi pending di sisi WarungNokos.
 * Hasil: { id, qrString, qrImage, total, expiredAt }
 */
export async function createWarungNokosDeposit(amount, method = "qris") {
  const body = await request("POST", "/api/deposit/create", {
    data: { amount: Math.round(Number(amount)), method }
  });
  const d = body?.data || body;
  const id = pick(d, ["trxId", "trx_id"]);
  if (!id) throw new WarungNokosError("Respons WarungNokos tidak berisi ID deposit.", 502, d);
  return {
    id: String(id),
    qrString: pick(d, ["qr_string"], null),
    qrImage: pick(d, ["qr_image"], null),
    total: num(pick(d, ["total"])),
    expiredAt: toEpochMs(pick(d, ["expired_at"]))
  };
}

export async function getWarungNokosDepositStatus(trxId) {
  const body = await request("GET", `/api/deposit/status/${encodeURIComponent(trxId)}`);
  const detail = body?.detail || {};
  return {
    status: normalizeWarungNokosDepositStatus(pick(body, ["status"], "")),
    amount: num(pick(body, ["amount"])),
    total: num(pick(detail, ["total"])),
    fee: num(pick(detail, ["fee"])),
    brand: pick(detail, ["brand_name"], null),
    raw: body
  };
}

export async function cancelWarungNokosDeposit(trxId) {
  return request("POST", "/api/deposit/cancel", { data: { trxId } });
}

export function normalizeWarungNokosDepositStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (["success", "completed", "paid", "settlement"].includes(s)) return "completed";
  if (["cancel", "canceled", "cancelled"].includes(s)) return "canceled";
  if (["expired", "expire"].includes(s)) return "expired";
  if (["failed", "failure", "error"].includes(s)) return "failed";
  return "pending";
}

// WarungNokos mengirim waktu kedaluwarsa sebagai epoch milidetik.
export function toEpochMs(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (Number.isFinite(n)) return n > 1e12 ? n : n * 1000;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

// Dipakai tombol Diagnosa di dashboard admin: melaporkan koneksi & saldo,
// tanpa pernah membocorkan API key.
export async function diagnoseWarungNokos() {
  if (!(await warungNokosConfigured())) {
    return { configured: false, error: "WARUNGNOKOS_APIKEY belum diisi (Dasbor Admin → Konfigurasi, atau Environment Variables Vercel)" };
  }
  const out = { configured: true, base: await baseUrl() };
  try {
    const body = await request("GET", "/api/user/profile");
    const d = body?.data || body;
    out.profile = { username: pick(d, ["username"], null), balance: num(pick(d, ["balance"])) };
  } catch (err) {
    out.profile = { error: err?.message || "gagal" };
  }
  for (const s of WARUNGNOKOS_SERVERS) {
    try {
      const list = await getWarungNokosServices(s.id);
      out[s.id] = { ok: true, services: list.length };
    } catch (err) {
      out[s.id] = { ok: false, error: err?.message || "gagal" };
    }
  }
  return out;
}
