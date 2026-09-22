// Client API RuangOTP (https://api.ruangotp.io) — dipakai untuk:
//   1. Beli nomor OTP (dua server: V1 = Server Plus, V2 = Server Express)
//   2. Deposit QRIS   (dua gateway: V1 dan V2)
//
// User ID WAJIB disimpan di environment variable RUANGOTP_USER_ID (server only).
// Jangan pernah dikirim ke browser atau ditulis langsung di kode, karena siapa pun
// yang pegang ID ini bisa memakai saldo akun RuangOTP kamu.
//
// PENTING — WHITELIST IP: seluruh endpoint RuangOTP menolak request dari IP yang
// belum didaftarkan di menu Profil RuangOTP. Vercel TIDAK punya IP keluar yang
// tetap, jadi kalau dipanggil langsung dari Vercel, request akan ditolak begitu
// IP-nya berganti. Setel RUANGOTP_PROXY ke proxy ber-IP statis (lihat README)
// supaya semua panggilan keluar lewat satu IP yang bisa didaftarkan.
//
// Perbedaan penting dua versi:
//   V1 — order pakai number_id + provider_id + operator_id, dikenali lewat order_id
//   V2 — order pakai product_code (mis. RUANGOTP_6_whatsapp), dikenali lewat invoice_id
import axios from "axios";

// Host API. Dokumentasi RuangOTP menyebut api.ruangotp.io, tetapi subdomain itu
// belum punya catatan DNS sehingga panggilan gagal dengan ENOTFOUND. Karena itu
// daftar host dicoba berurutan, dan yang pertama berhasil diingat.
//
// Kegagalan DNS aman untuk dicoba ulang ke host lain: tidak ada request yang
// benar-benar terkirim, jadi tidak mungkin ada order/deposit yang dobel.
// Kegagalan HTTP TIDAK pernah dicoba ulang ke host lain.
const HOST_CANDIDATES = [
  (process.env.RUANGOTP_BASE_URL || "").trim().replace(/\/+$/, ""),
  "https://api.ruangotp.io/api",
  "https://ruangotp.io/api"
].filter(Boolean);

let activeHost = null;

const DNS_ERRORS = new Set(["ENOTFOUND", "EAI_AGAIN"]);

// Dua server nokos RuangOTP. id dipakai di seluruh aplikasi & tersimpan di DB.
export const RUANGOTP_SERVERS = [
  { id: "ruangotp_s1", version: "v1", name: "Server Plus" },
  { id: "ruangotp_s2", version: "v2", name: "Server Express" }
];

export function ruangOtpVersion(id) {
  return RUANGOTP_SERVERS.find((s) => s.id === id)?.version || null;
}

export function isRuangOtpServer(id) {
  return RUANGOTP_SERVERS.some((s) => s.id === id);
}

// Status akhir pesanan RuangOTP — setelah ini tidak perlu ditanya lagi.
export const RUANGOTP_TERMINAL = ["completed", "canceled", "expired", "failed"];

export class RuangOtpError extends Error {
  constructor(message, status = 500, body = null) {
    super(message);
    this.name = "RuangOtpError";
    this.status = status;
    this.body = body;
    // true = tidak ada respons HTTP sama sekali (timeout / jaringan putus), jadi
    // hasil aksinya di sisi RuangOTP TIDAK diketahui (bisa sudah terproses).
    this.ambiguous = false;
    // true = kemungkinan besar IP server belum di-whitelist.
    this.ipBlocked = false;
  }
}

function userId() {
  return (process.env.RUANGOTP_USER_ID || "").trim();
}

export function ruangOtpConfigured() {
  return userId().length > 0;
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

// Proxy ber-IP statis opsional, supaya IP keluar bisa didaftarkan di RuangOTP.
let proxyAgent = null;
let proxyAgentResolved = false;
async function agent() {
  if (proxyAgentResolved) return proxyAgent;
  proxyAgentResolved = true;
  const url = (process.env.RUANGOTP_PROXY || "").trim();
  if (!url) return null;
  try {
    const { HttpsProxyAgent } = await import("https-proxy-agent");
    proxyAgent = new HttpsProxyAgent(url);
  } catch (err) {
    console.error("[ruangotp] proxy gagal dipasang:", err?.message || err);
    proxyAgent = null;
  }
  return proxyAgent;
}

// Semua endpoint RuangOTP memakai GET + header x-user-id, dan membalas
// { success, message, data } atau { success:false, message }.
async function request(version, path, params = {}, timeout = 25000) {
  const id = userId();
  if (!id) throw new RuangOtpError("RUANGOTP_USER_ID belum diisi di environment variables.", 500);

  const httpsAgent = await agent();
  // Host yang sudah terbukti jalan dipakai lebih dulu supaya tidak menunggu DNS
  // gagal berulang kali.
  const hosts = activeHost ? [activeHost, ...HOST_CANDIDATES.filter((h) => h !== activeHost)] : HOST_CANDIDATES;

  let res = null;
  let lastDnsErr = null;
  let usedHost = null;

  for (const host of hosts) {
    try {
      res = await axios({
        method: "GET",
        url: `${host}/${version}${path}`,
        params,
        timeout,
        validateStatus: () => true,
        decompress: true,
        ...(httpsAgent ? { httpsAgent, proxy: false } : {}),
        headers: {
          "x-user-id": id,
          accept: "application/json",
          "user-agent": "artapedia-nokos/1.0"
        }
      });
      usedHost = host;
      break;
    } catch (err) {
      // Hanya kegagalan DNS yang boleh lanjut ke host berikutnya.
      if (DNS_ERRORS.has(err?.code)) {
        lastDnsErr = err;
        continue;
      }
      // Error jaringan axios menyimpan config lengkap (termasuk header x-user-id).
      // Dibungkus ulang supaya ID tidak ikut tercetak di log.
      const e = new RuangOtpError(
        `Tidak bisa terhubung ke RuangOTP (${err?.code || err?.message || "network"})`,
        503
      );
      e.ambiguous = true;
      throw e;
    }
  }

  if (!res) {
    const e = new RuangOtpError(
      `Alamat API RuangOTP tidak ditemukan (${lastDnsErr?.code || "ENOTFOUND"}). ` +
        `Host yang dicoba: ${hosts.join(", ")}. Tanyakan base URL yang benar ke RuangOTP, ` +
        `lalu isi RUANGOTP_BASE_URL di environment variables.`,
      503
    );
    e.dnsFailed = true;
    throw e;
  }

  activeHost = usedHost;

  const body = res.data;
  if (res.status === 401 || res.status === 403) {
    const e = new RuangOtpError(
      pick(body, ["message", "error"], "Akses ditolak RuangOTP. Kemungkinan IP server belum di-whitelist."),
      res.status,
      body
    );
    e.ipBlocked = true;
    throw e;
  }
  if (res.status === 404) {
    throw new RuangOtpError(
      `Endpoint tidak ditemukan di ${usedHost}. Kemungkinan base URL-nya beda — tanyakan ke RuangOTP.`,
      404,
      body
    );
  }
  if (res.status >= 400) {
    throw new RuangOtpError(pick(body, ["message", "error"], `RuangOTP error ${res.status}`), res.status, body);
  }
  if (body && body.success === false) {
    throw new RuangOtpError(pick(body, ["message", "error"], "Permintaan ditolak RuangOTP."), 400, body);
  }
  return body?.data !== undefined ? body.data : body;
}

// Host yang sedang terpakai — ditampilkan di diagnosa admin.
export function ruangOtpActiveHost() {
  return activeHost;
}

const toList = (v) => (Array.isArray(v) ? v : Array.isArray(v?.data) ? v.data : []);

// ─────────────────────────── KATALOG ───────────────────────────

// Daftar layanan. Bentuk hasilnya disamakan untuk V1 & V2 supaya UI tidak perlu
// tahu versinya: { code, name }.
export async function getRuangOtpServices(serverId) {
  const v = ruangOtpVersion(serverId);
  const raw = await request(v, "/services/list");
  return toList(raw)
    .filter((s) => s && s.status !== false)
    .map((s) => ({
      code: String(pick(s, ["service_code", "code", "id"], "")),
      name: String(pick(s, ["service_name", "name"], "")) || String(pick(s, ["service_code"], "")),
      category: pick(s, ["category"], null)
    }))
    .filter((s) => s.code);
}

/**
 * Daftar negara + harga untuk satu layanan.
 * Hasilnya sengaja diseragamkan jadi:
 *   { countryId, name, prefix, pricelist: [{ key, providerId, productCode, price, stock, serverName }] }
 * `key` adalah satu-satunya nilai yang perlu dikirim balik saat order.
 */
export async function getRuangOtpCountries(serverId, serviceId) {
  const v = ruangOtpVersion(serverId);
  const raw = await request(v, "/countries/list", { service_id: serviceId });
  const rows = toList(raw);

  if (v === "v1") {
    return rows.map((c) => {
      const numberId = pick(c, ["number_id", "id"]);
      return {
        countryId: String(numberId),
        name: String(pick(c, ["name", "country_name"], "-")),
        prefix: pick(c, ["prefix", "dial_code"], null),
        pricelist: toList(c.pricelist)
          .map((p) => ({
            // number_id:provider_id — cukup untuk order di V1.
            key: `${numberId}:${pick(p, ["provider_id", "id"])}`,
            providerId: String(pick(p, ["provider_id", "id"], "")),
            productCode: null,
            price: num(pick(p, ["price"])) ?? 0,
            stock: num(pick(p, ["stock"])),
            serverName: pick(p, ["server_name"], null) || `Server ${pick(p, ["server_id"], "?")}`
          }))
          .filter((p) => p.price > 0)
      };
    });
  }

  return rows.map((c) => ({
    countryId: String(pick(c, ["country_id", "id"])),
    name: String(pick(c, ["country_name", "name"], "-")),
    prefix: pick(c, ["prefix", "dial_code"], null),
    pricelist: toList(c.pricelist)
      .map((p) => ({
        // product_code sudah unik di V2, jadi itu saja kuncinya.
        key: String(pick(p, ["product_code"], "")),
        providerId: null,
        productCode: String(pick(p, ["product_code"], "")),
        price: num(pick(p, ["price"])) ?? 0,
        stock: num(pick(p, ["stock"])),
        serverName: pick(p, ["server_name"], null)
      }))
      .filter((p) => p.key && p.price > 0)
  }));
}

// Daftar operator. V1 butuh nama negara + provider_id, V2 butuh country_id.
export async function getRuangOtpOperators(serverId, { countryName, providerId, countryId }) {
  const v = ruangOtpVersion(serverId);
  const params = v === "v1" ? { country: countryName, provider_id: providerId } : { country_id: countryId };
  const raw = await request(v, "/operators/list", params);
  return toList(raw)
    .map((o) => ({
      code: String(pick(o, ["operator_code", "name", "id"], "any")),
      name: String(pick(o, ["operator_name", "name"], "any"))
    }))
    .filter((o) => o.code);
}

// ─────────────────────────── ORDER ───────────────────────────

/**
 * Beli nomor. `key` berasal dari pricelist di getRuangOtpCountries.
 * expected_price WAJIB sama dengan harga pricelist — RuangOTP menolak kalau beda,
 * dan itu justru melindungi kita dari harga yang berubah di tengah jalan.
 */
export async function createRuangOtpOrder(serverId, { key, operator = "any", expectedPrice }) {
  const v = ruangOtpVersion(serverId);
  let params;
  if (v === "v1") {
    const [numberId, providerId] = String(key).split(":");
    if (!numberId || !providerId) throw new RuangOtpError("Pilihan negara tidak valid.", 400);
    params = {
      number_id: numberId,
      provider_id: providerId,
      operator_id: operator || "any",
      expected_price: expectedPrice
    };
  } else {
    params = { product_code: key, operator_id: operator || "any", expected_price: expectedPrice };
  }

  const d = await request(v, "/orders/buy", params);
  const id = pick(d, ["order_id", "invoice_id"]);
  if (!id) throw new RuangOtpError("Respons RuangOTP tidak berisi ID pesanan.", 502, d);
  return {
    id: String(id),
    number: pick(d, ["phone_number", "number"], null),
    price: num(pick(d, ["price"])),
    balance: num(pick(d, ["remaining_balance", "balance"]))
  };
}

// Status pesanan. OTP muncul saat status COMPLETED.
export async function getRuangOtpStatus(serverId, orderId) {
  const v = ruangOtpVersion(serverId);
  const params = v === "v1" ? { order_id: orderId } : { invoice_id: orderId };
  const d = await request(v, "/orders/check-status", params);
  const raw = String(pick(d, ["status"], "")).toUpperCase();
  const otpRaw = pick(d, ["otp_code", "otp", "sms"], null);
  // V2 mengirim "WAITING" saat OTP belum masuk — itu bukan kode.
  const otp = otpRaw && String(otpRaw).toUpperCase() !== "WAITING" ? String(otpRaw).trim() : null;
  return {
    status: normalizeRuangOtpStatus(raw, otp),
    rawStatus: raw,
    otp,
    raw: d
  };
}

export function normalizeRuangOtpStatus(raw, otp = null) {
  const s = String(raw || "").toUpperCase();
  if (s === "COMPLETED" || s === "SUCCESS" || s === "DONE") return otp ? "done" : "completed";
  if (s === "CANCELED" || s === "CANCELLED") return "canceled";
  if (s === "EXPIRED" || s === "TIMEOUT") return "expired";
  if (s === "FAILED" || s === "ERROR") return "failed";
  return "pending";
}

export async function cancelRuangOtpOrder(serverId, orderId) {
  const v = ruangOtpVersion(serverId);
  const params = v === "v1" ? { order_id: orderId } : { invoice_id: orderId };
  const d = await request(v, "/orders/cancel", params);
  return { refund: num(pick(d, ["refund_amount", "refund"])), balance: num(pick(d, ["current_balance", "balance"])) };
}

// ─────────────────────────── DEPOSIT QRIS ───────────────────────────

// Dua gateway deposit terpisah, dipakai sebagai dua metode di halaman deposit.
export const RUANGOTP_DEPOSIT = [
  { key: "ruangotp_s1", version: "v1", name: "QRIS RuangOTP S1" },
  { key: "ruangotp_s2", version: "v2", name: "QRIS RuangOTP S2" }
];

export function ruangOtpDepositVersion(key) {
  return RUANGOTP_DEPOSIT.find((d) => d.key === key)?.version || null;
}

export function isRuangOtpDeposit(key) {
  return RUANGOTP_DEPOSIT.some((d) => d.key === key);
}

/**
 * Buat tagihan QRIS. Hasil diseragamkan untuk kedua versi:
 *   { id, amountReceived, totalPay, qrImage, qrString, expiredAt }
 * expiredAt selalu epoch milidetik.
 */
export async function createRuangOtpDeposit(providerKey, amount) {
  const v = ruangOtpDepositVersion(providerKey);
  if (!v) throw new RuangOtpError("Metode deposit RuangOTP tidak dikenal.", 400);
  const d = await request(v, "/deposit/create", { amount: Math.round(Number(amount)) });

  const id = pick(d, ["deposit_id", "invoice_id"]);
  if (!id) throw new RuangOtpError("Respons RuangOTP tidak berisi ID deposit.", 502, d);

  return {
    id: String(id),
    amountReceived: num(pick(d, ["amount_received", "balance_received"])),
    totalPay: num(pick(d, ["total_pay", "payment_amount"])),
    qrImage: pick(d, ["qr_image"], null),
    qrString: pick(d, ["qr_string"], null),
    expiredAt: toEpochMs(pick(d, ["expired_at", "valid_until"]))
  };
}

export async function getRuangOtpDepositStatus(providerKey, depositId) {
  const v = ruangOtpDepositVersion(providerKey);
  if (!v) throw new RuangOtpError("Metode deposit RuangOTP tidak dikenal.", 400);
  const params = v === "v1" ? { deposit_id: depositId } : { invoice_id: depositId };
  const d = await request(v, "/deposit/cekstatus", params);
  return { status: normalizeRuangOtpDepositStatus(pick(d, ["status"], "")), raw: d };
}

export async function cancelRuangOtpDeposit(providerKey, depositId) {
  const v = ruangOtpDepositVersion(providerKey);
  if (!v) throw new RuangOtpError("Metode deposit RuangOTP tidak dikenal.", 400);
  const params = v === "v1" ? { deposit_id: depositId } : { invoice_id: depositId };
  return request(v, "/deposit/cancel", params);
}

export function normalizeRuangOtpDepositStatus(raw) {
  const s = String(raw || "").toLowerCase();
  if (["success", "completed", "paid", "settlement"].includes(s)) return "completed";
  if (["canceled", "cancelled", "cancel"].includes(s)) return "canceled";
  if (["expired", "expire"].includes(s)) return "expired";
  if (["failed", "failure", "error"].includes(s)) return "failed";
  return "pending";
}

// RuangOTP mengirim waktu kedaluwarsa kadang sebagai epoch ms, kadang ISO string.
export function toEpochMs(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v > 1e12 ? v : v * 1000;
  const n = Number(v);
  if (Number.isFinite(n) && String(v).trim() !== "") return n > 1e12 ? n : n * 1000;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

// Dipakai tombol Diagnosa di dashboard admin: melaporkan apakah koneksi &
// whitelist IP sudah benar, tanpa pernah membocorkan user id.
export async function diagnoseRuangOtp() {
  if (!ruangOtpConfigured()) {
    return { configured: false, error: "RUANGOTP_USER_ID belum diisi di environment variables." };
  }
  const out = {
    configured: true,
    proxy: Boolean((process.env.RUANGOTP_PROXY || "").trim()),
    hostsDicoba: HOST_CANDIDATES
  };
  for (const s of RUANGOTP_SERVERS) {
    try {
      const list = await getRuangOtpServices(s.id);
      out[s.id] = { ok: true, services: list.length, host: activeHost };
    } catch (err) {
      out[s.id] = {
        ok: false,
        error: err?.message || "gagal",
        ipBlocked: Boolean(err?.ipBlocked),
        dnsFailed: Boolean(err?.dnsFailed)
      };
    }
  }
  return out;
}
