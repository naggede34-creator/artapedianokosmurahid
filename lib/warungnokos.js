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
//   Server Express (Server2, /api/smscode/*)
//     order pakai product_id + app_id + country_id, id transaksi trxId
//
// Keduanya dibungkus di sini supaya sisa aplikasi tidak perlu tahu bedanya:
// tiap pilihan harga diberi satu field `key` yang isinya cukup untuk order.
import axios from "axios";

const BASE = (process.env.WARUNGNOKOS_BASE_URL || "https://warungnokos.web.id").trim().replace(/\/+$/, "");

// Dua server nokos. id dipakai di seluruh aplikasi & tersimpan di DB.
export const WARUNGNOKOS_SERVERS = [
  { id: "warungnokos_s1", api: "otp", name: "Server Plus" },
  { id: "warungnokos_s2", api: "smscode", name: "Server Express" }
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

function apiKey() {
  return (process.env.WARUNGNOKOS_APIKEY || "").trim();
}

export function warungNokosConfigured() {
  return apiKey().length > 0;
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
  const key = apiKey();
  if (!key) throw new WarungNokosError("WARUNGNOKOS_APIKEY belum diisi di environment variables.", 500);

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

// ─────────────────────────── KATALOG ───────────────────────────

// Daftar layanan. Bentuk hasilnya disamakan untuk kedua server: { code, name, img }.
export async function getWarungNokosServices(serverId) {
  const api = warungNokosApi(serverId);
  if (api === "smscode") {
    const body = await request("GET", "/api/smscode/services");
    return toList(body.data)
      .filter((s) => s.active !== false)
      .map((s) => ({ code: String(pick(s, ["id"], "")), name: String(pick(s, ["name", "code"], "")), img: null }))
      .filter((s) => s.code && s.name);
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
export async function getWarungNokosCountries(serverId, serviceId) {
  const api = warungNokosApi(serverId);

  if (api === "smscode") {
    // Server2 memisahkan daftar negara dari daftar produk. Produk diambil untuk
    // SELURUH negara sekaligus (tanpa country_id) supaya cukup dua panggilan,
    // bukan satu panggilan per negara.
    const [countriesBody, productsBody] = await Promise.all([
      request("GET", "/api/smscode/countries"),
      request("GET", "/api/smscode/products", { params: { platform_id: serviceId } })
    ]);

    const names = new Map(
      toList(countriesBody.data).map((c) => [
        String(pick(c, ["id"], "")),
        { name: String(pick(c, ["name"], "-")), flag: pick(c, ["emoji"], null) }
      ])
    );

    const grouped = new Map();
    for (const p of toList(productsBody.data)) {
      if (p.active === false) continue;
      const cid = String(pick(p, ["country_id"], ""));
      if (!cid) continue;
      if (!grouped.has(cid)) grouped.set(cid, []);
      grouped.get(cid).push({
        // product_id:app_id:country_id — cukup untuk order di Server2.
        key: `${pick(p, ["id"])}:${serviceId}:${cid}`,
        price: num(pick(p, ["price"])) ?? 0,
        stock: num(pick(p, ["available"])),
        rate: null,
        label: String(pick(p, ["name"], "Server"))
      });
    }

    return [...grouped.entries()]
      .map(([cid, list]) => ({
        countryId: cid,
        name: names.get(cid)?.name || `Negara ${cid}`,
        flag: names.get(cid)?.flag || null,
        prefix: null,
        pricelist: list.filter((p) => p.price > 0).sort((a, b) => a.price - b.price)
      }))
      .filter((c) => c.pricelist.length > 0);
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
  if (api === "smscode") {
    const [productId, appId, countryId] = String(key).split(":");
    if (!productId || !appId || !countryId) throw new WarungNokosError("Pilihan negara tidak valid.", 400);
    body = await request("POST", "/api/smscode/order", {
      data: {
        product_id: Number(productId),
        app_id: Number(appId),
        country_id: Number(countryId),
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
  const path = api === "smscode" ? "/api/smscode/status/" : "/api/otp/status/";
  const body = await request("GET", `${path}${encodeURIComponent(trxId)}`);
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
  if (api === "smscode") return request("POST", "/api/smscode/cancel", { data: { trxId } });
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
  if (!warungNokosConfigured()) {
    return { configured: false, error: "WARUNGNOKOS_APIKEY belum diisi di environment variables." };
  }
  const out = { configured: true, base: BASE };
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
