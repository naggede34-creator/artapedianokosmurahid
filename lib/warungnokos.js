// Client API WarungNokos (https://warungnokos.web.id) — dipakai untuk:
//   1. Beli nomor OTP (dua sistem API terpisah = dua "server" di web ini)
//   2. Deposit QRIS
//
// API key WAJIB disimpan di environment variable WARUNGNOKOS_APIKEY (server only).
// Jangan pernah dikirim ke browser atau ditulis langsung di kode, karena siapa pun
// yang pegang key ini bisa memakai saldo akun WarungNokos kamu.
//
// SEKARANG kedua server (Server 1 & Server 2) memakai SATU API: "Dokumentasi API Server 2" (/api/warkosv3/*, di bawah).
// API lama (/api/otp/* untuk Server 1, /api/smscode/* untuk Server 2) hanya dipertahankan sebagai cadangan membaca status /
// membatalkan pesanan yang dibuat SEBELUM migrasi. Pembelian baru selalu lewat warkosv3.
//
// Riwayat — dulu WarungNokos punya DUA sistem API yang bentuk datanya berbeda jauh:
//
//   Server Plus (H2H utama, /api/otp/*)  — "Developer API Docs" WarungNokos
//     GET  /api/otp/services                    daftar layanan
//     GET  /api/otp/countries/:serviceId        negara + pricelist
//     GET  /api/otp/operators/:country/:providerId
//     POST /api/otp/order                       number_id, provider_id, operator_id, price_jual
//     GET  /api/otp/status/:orderId             waiting | completed | canceled
//     POST /api/otp/set_status                  trxId + action_status: cancel | done | resend
//     order pakai number_id + provider_id + operator_id, id transaksi trxId
//
//   Server Express (Server 2, /api/warkosv3/*)  — "Dokumentasi API Server 2"
//     GET  /api/warkosv3/countries
//     GET  /api/warkosv3/services?country_id=
//     GET  /api/warkosv3/products?country_id=&service_id=   (price = harga final)
//     POST /api/warkosv3/order                  country_id, service_id, product_id
//     GET  /api/warkosv3/status/{trxId}         waiting | completed | canceled
//     POST /api/warkosv3/cancel                 trxId (baru bisa 3 menit setelah order)
//     Daftar layanannya PER NEGARA; header autentikasi x-api-key.
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
// Keduanya memakai API warkosv3. `grup` = produk mana yang tampil: API baru menamai pilihan harga "Server 1", "Server 2", …
// per negara+layanan — Server 1 menampilkan produk "Server 1", Server 2 menampilkan "Server 2" (dst). `lama` = nama API lama
// untuk pesanan yang dibuat sebelum migrasi. Bila WARUNGNOKOS_PISAH_SERVER=0, kedua server menampilkan SEMUA produk.
export const WARUNGNOKOS_SERVERS = [
  { id: "warungnokos_s1", api: "warkosv3", grup: 1, lama: "otp", name: "Server Plus" },
  { id: "warungnokos_s2", api: "warkosv3", grup: 2, lama: "smscode", name: "Server Express" }
];

/** Produk "Server N" masuk grup 1 (N ≤ 1 / tanpa angka) atau grup 2 (N ≥ 2). */
export function grupProdukV3(nama) {
  const m = /(\d+)/.exec(String(nama || ""));
  return m && Number(m[1]) >= 2 ? 2 : 1;
}

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

// API baru (warkosv3 = "Dokumentasi API Server 2") boleh memakai API key SENDIRI (WARUNGNOKOS_V3_APIKEY) bila akun WarungNokos
// menerbitkan key terpisah untuk Server 2. Kosong = pakai WARUNGNOKOS_APIKEY yang sama.
async function apiKeyUntuk(path) {
  if (String(path).startsWith("/api/warkosv3/")) {
    const k = ((await cfg("WARUNGNOKOS_V3_APIKEY")) || "").trim();
    if (k) return k;
  }
  return apiKey();
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

async function request(method, path, opts = {}) {
  try {
    return await requestSekali(method, path, opts);
  } catch (e) {
    // Hanya GET (aman diulang): 429 / 5xx / gangguan jaringan sesaat dicoba sekali lagi setelah jeda singkat.
    const sementara = e instanceof WarungNokosError && (e.status === 429 || e.status >= 500);
    if (method !== "GET" || !sementara) throw e;
    await new Promise((r) => setTimeout(r, e.status === 429 ? 1200 : 500));
    return requestSekali(method, path, opts);
  }
}

async function requestSekali(method, path, { params, data, timeout = 25000 } = {}) {
  const key = await apiKeyUntuk(path);
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
    const e = new WarungNokosError(pick(body, ["message", "error"], `WarungNokos error ${res.status}`), res.status, body);
    e.path = path;
    throw e;
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
const V3_PRODUK_TTL_MS = 60 * 1000; // harga tampil maksimal ±1 menit tertinggal dari provider
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

// Katalog juga disimpan di database (koleksi wn_katalog): instance serverless baru (cold start) tidak perlu mengulang puluhan
// panggilan /services per negara. Pembangunan katalog dibatasi anggaran waktu supaya tidak melewati batas fungsi — negara yang
// belum sempat dibaca ikut terbaca di pembangunan berikutnya (katalog sebagian tidak disimpan lama: 2 menit saja).
const V3_DB_TTL_MS = 30 * 60 * 1000;
const V3_ANGGARAN_MS = 20000;

/** Membuang cache katalog di memori (dan di DB bila `db`) — dipakai uji & bila admin ingin memaksa muat ulang. */
export async function lupakanKatalogWarungNokos({ db = false } = {}) {
  v3Katalog = null; v3KatalogJanji = null; v3Produk.clear();
  if (db) { try { const { getDb } = await import("@/lib/db"); const d = await getDb(); await d.collection("wn_katalog").deleteMany({}); await d.collection("wn_produk").deleteMany({}); } catch {} }
}

async function bacaKatalogDb({ basi = false } = {}) {
  try {
    const { getDb } = await import("@/lib/db");
    const d = await (await getDb()).collection("wn_katalog").findOne({ _id: "v3" });
    if (!d || !Array.isArray(d.countries) || !Array.isArray(d.services)) return null;
    if (!basi && Date.now() - new Date(d.at).getTime() > (d.sebagian ? 15 * 1000 : V3_DB_TTL_MS)) return null;
    if (basi && !d.services.length) return null;
    return { at: new Date(d.at).getTime(), countries: d.countries, services: new Map(d.services), sebagian: !!d.sebagian };
  } catch { return null; }
}
async function simpanKatalogDb(kat) {
  try {
    const { getDb } = await import("@/lib/db");
    await (await getDb()).collection("wn_katalog").replaceOne({ _id: "v3" }, { _id: "v3", at: new Date(kat.at), countries: kat.countries, services: [...kat.services.entries()], sebagian: !!kat.sebagian }, { upsert: true });
  } catch { /* cache hanya percepatan */ }
}

async function muatKatalogV3() {
  if (v3Katalog && Date.now() - v3Katalog.at < (v3Katalog.sebagian ? 15 * 1000 : V3_TTL_MS)) return v3Katalog;
  if (v3KatalogJanji) return v3KatalogJanji;
  v3KatalogJanji = (async () => {
    const dariDb = await bacaKatalogDb();
    if (dariDb) { v3Katalog = dariDb; return dariDb; }
    // Katalog sebagian / kedaluwarsa sebelumnya dipakai sebagai bibit: negara yang SUDAH terbaca tidak diminta ulang
    // (membangun daftar layanan = satu panggilan per negara; dengan bibit, beberapa kali muat saja sudah lengkap).
    const bibit = (v3Katalog && v3Katalog.sebagian ? v3Katalog : null) || (await bacaKatalogDb({ basi: true }));
    let body;
    try {
      body = await request("GET", "/api/warkosv3/countries");
    } catch (e) {
      // Provider sedang bermasalah: pakai katalog terakhir yang tersimpan (walau sudah lama) daripada menampilkan galat.
      if (bibit && bibit.services.size) { v3Katalog = { ...bibit, at: Date.now() - V3_TTL_MS + 60 * 1000 }; return v3Katalog; }
      throw e;
    }
    const countries = toList(body.data)
      .map((c) => ({
        id: String(pick(c, ["id"], "")),
        name: String(pick(c, ["name"], "-")),
        dial: pick(c, ["dial_code"], null)
      }))
      .filter((c) => c.id);
    const services = new Map();
    if (bibit) for (const [k, v] of bibit.services) services.set(k, v); // [] = negara itu sudah dicek & memang kosong
    const belum = countries.filter((c) => !services.has(c.id));
    const batas = Date.now() + V3_ANGGARAN_MS;
    let berhenti = false, galatTerakhir = null;
    await paralel(belum, 10, async (c) => {
      if (berhenti || Date.now() > batas) return null;
      try {
        const b = await request("GET", "/api/warkosv3/services", { params: { country_id: c.id }, timeout: 12000 });
        services.set(c.id, toList(b.data)
          .map((x) => ({ id: String(pick(x, ["id"], "")), name: String(pick(x, ["name"], "")) }))
          .filter((x) => x.id && x.name)
          .map((x) => ({ ...x, slug: slugLayanan(x.name) })));
      } catch (e) {
        galatTerakhir = e;
        // 429 = provider menolak karena terlalu sering: berhenti dulu, lanjutkan di muat berikutnya.
        if (e?.status === 429) berhenti = true;
        else if (e?.status === 400 || e?.status === 404) services.set(c.id, []); // negara tanpa layanan
      }
      return null;
    });
    const sebagian = countries.some((c) => !services.has(c.id));
    if (![...services.values()].some((l) => l.length)) {
      // Tidak satu negara pun punya layanan: kalau penyebabnya galat provider, teruskan galat aslinya (supaya bisa didiagnosa).
      if (galatTerakhir) throw galatTerakhir;
      throw new WarungNokosError("Daftar layanan WarungNokos kosong — provider tidak mengembalikan layanan untuk negara mana pun.", 502);
    }
    v3Katalog = { at: Date.now(), countries, services, sebagian };
    await simpanKatalogDb(v3Katalog);
    return v3Katalog;
  })();
  try { return await v3KatalogJanji; } finally { v3KatalogJanji = null; }
}

// Produk per negara+layanan juga disimpan di database (wn_produk). Tujuannya: daftar negara TIDAK menyusut tiap kali
// provider lambat/membatasi (429) atau instance serverless baru mulai kosong. Data segar dipakai langsung; kalau gagal
// diambil ulang, data lama (maks 24 jam) dipakai sebagai cadangan — lebih baik harga kemarin daripada negaranya hilang.
const V3_PRODUK_DB_SEGAR_MS = 60 * 1000;
// Stale-while-revalidate: data lebih tua dari 1 menit tapi < 15 menit langsung ditampilkan (cepat), lalu diperbarui di latar.
const V3_PRODUK_SWR_MS = 15 * 60 * 1000;
const V3_PRODUK_DB_BASI_MS = 24 * 3600 * 1000;

async function bacaProdukDb(kunci) {
  const out = new Map();
  if (!kunci.length) return out;
  try {
    const { getDb } = await import("@/lib/db");
    const rows = await (await getDb()).collection("wn_produk").find({ _id: { $in: kunci } }).toArray();
    for (const r of rows) if (Array.isArray(r.list)) out.set(r._id, { at: new Date(r.at).getTime(), list: r.list });
  } catch { /* cache hanya percepatan */ }
  return out;
}
async function simpanProdukDb(daftar) {
  if (!daftar.length) return;
  try {
    const { getDb } = await import("@/lib/db");
    await (await getDb()).collection("wn_produk").bulkWrite(
      daftar.map(([k, v]) => ({ replaceOne: { filter: { _id: k }, replacement: { _id: k, at: new Date(v.at), list: v.list }, upsert: true } })),
      { ordered: false }
    );
  } catch { /* abaikan */ }
}

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

// Jalankan pekerjaan setelah respons terkirim (Next `after`); di luar konteks request cukup dijalankan lepas.
async function jalankanLatar(fn) {
  try {
    const { after } = await import("next/server");
    after(fn);
  } catch {
    Promise.resolve().then(fn).catch(() => {});
  }
}

// Ambil produk dari provider. 400/404 = memang tidak ada (daftar kosong). Galat lain DILEMPAR agar pemanggil bisa
// memakai cadangan, bukan menganggap negaranya kosong.
async function ambilProdukV3(countryId, serviceId) {
  for (let percobaan = 0; ; percobaan++) {
    try {
      const b = await request("GET", "/api/warkosv3/products", { params: { country_id: countryId, service_id: serviceId } });
      return toList(b.data);
    } catch (e) {
      if (e instanceof WarungNokosError && [400, 404].includes(e.status)) return [];
      if (percobaan >= 1) throw e;
      await tidur(e?.status === 429 ? 800 : 300);
    }
  }
}

/**
 * Produk untuk banyak pasangan [countryId, serviceId] sekaligus.
 * Mengembalikan Map "cid:sid" → list (pasangan yang benar-benar tak punya data tidak ada di Map).
 */
async function produkV3Banyak(pasangan, { anggaranMs = 25000, segar = false } = {}) {
  const hasil = new Map();
  const perlu = []; // harus diambil sekarang (tidak ada data layak pakai)
  const latar = []; // data agak lama dipakai dulu, diperbarui setelah respons
  const kunciSemua = pasangan.map(([c, sv]) => `${c}:${sv}`);
  const adaSegarMem = (k) => { const m = v3Produk.get(k); return !!(m && Date.now() - m.at < V3_PRODUK_TTL_MS); };
  // `segar` (jalur order/ganti nomor): harga HARUS terbaru — tidak membaca cache DB dan tidak memakai data lama.
  const dariDb = segar ? new Map() : await bacaProdukDb(kunciSemua.filter((k) => !adaSegarMem(k)));

  for (const [c, sv] of pasangan) {
    const k = `${c}:${sv}`;
    const m = v3Produk.get(k);
    if (m && Date.now() - m.at < V3_PRODUK_TTL_MS) { hasil.set(k, m.list); continue; }
    const d = dariDb.get(k);
    if (d && Date.now() - d.at < V3_PRODUK_DB_SEGAR_MS) { v3Produk.set(k, d); hasil.set(k, d.list); continue; }
    const lama = d || m || null;
    if (!segar && lama && Date.now() - lama.at < V3_PRODUK_SWR_MS) { hasil.set(k, lama.list); latar.push([c, sv, k]); continue; }
    perlu.push([c, sv, k, lama]);
  }

  const baru = [];
  const ambil = async ([c, sv, k], lama, batas) => {
    const pakaiLama = () => { if (!segar && lama && Date.now() - lama.at < V3_PRODUK_DB_BASI_MS) hasil.set(k, lama.list); };
    if (Date.now() > batas) { pakaiLama(); return; }
    try {
      const list = await ambilProdukV3(c, sv);
      const entri = { at: Date.now(), list };
      v3Produk.set(k, entri);
      hasil.set(k, list);
      baru.push([k, entri]);
    } catch { pakaiLama(); }
  };

  const batas = Date.now() + anggaranMs;
  await paralel(perlu, 20, async (t) => { await ambil(t.slice(0, 3), t[3], batas); return null; });
  await simpanProdukDb(baru);

  if (latar.length) {
    jalankanLatar(async () => {
      const tulis = [];
      await paralel(latar, 20, async ([c, sv, k]) => {
        try {
          const list = await ambilProdukV3(c, sv);
          const entri = { at: Date.now(), list };
          v3Produk.set(k, entri);
          tulis.push([k, entri]);
        } catch { /* biarkan data lama */ }
        return null;
      });
      await simpanProdukDb(tulis);
    });
  }
  return hasil;
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
    // Cocokkan layanan per negara dulu (murah, dari katalog), baru ambil produk semuanya sekaligus.
    const cocok = [];
    for (const c of target) {
      const list = kat.services.get(c.id) || [];
      // Cocokkan lewat nama; id mentah juga diterima supaya pesanan lama
      // (yang menyimpan id layanan angka) masih bisa dihitung ulang.
      const sv = list.find((x) => x.slug === slug) || list.find((x) => x.id === String(serviceId));
      if (sv) cocok.push([c, sv]);
    }
    const produkMap = await produkV3Banyak(cocok.map(([c, sv]) => [c.id, sv.id]), { anggaranMs: hanyaNegara ? 12000 : 25000, segar: !!hanyaNegara });
    const pisah = String((await cfg("WARUNGNOKOS_PISAH_SERVER")) ?? "1") !== "0";
    const grup = WARUNGNOKOS_SERVERS.find((x) => x.id === serverId)?.grup || 0;
    const baris = cocok.map(([c, sv]) => {
      const produk = produkMap.get(`${c.id}:${sv.id}`) || [];
      const pricelist = produk
        .filter((p) => !pisah || !grup || grupProdukV3(pick(p, ["name"], "")) === grup)
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
/**
 * Jalur CEPAT untuk order: `key` (produk:layanan:negara) sudah memuat semua id yang dibutuhkan, jadi cukup SATU
 * panggilan /products ke provider (selalu segar) — tanpa memuat katalog seluruh negara.
 * Mengembalikan { countryId, pricelist } seperti baris getWarungNokosCountries, atau null bila bukan kunci v3.
 */
export async function getWarungNokosHargaLangsung(serverId, key) {
  if (warungNokosApi(serverId) !== "warkosv3") return null;
  const [pid, sid, cid] = String(key || "").split(":");
  if (!pid || !sid || !cid) return null;
  const produk = await ambilProdukV3(cid, sid);
  v3Produk.set(`${cid}:${sid}`, { at: Date.now(), list: produk });
  const pisah = String((await cfg("WARUNGNOKOS_PISAH_SERVER")) ?? "1") !== "0";
  const grup = WARUNGNOKOS_SERVERS.find((x) => x.id === serverId)?.grup || 0;
  const pricelist = produk
    .filter((p) => !pisah || !grup || grupProdukV3(pick(p, ["name"], "")) === grup)
    .map((p) => ({
      key: `${pick(p, ["id"])}:${sid}:${cid}`,
      price: num(pick(p, ["price"])) ?? 0,
      stock: null,
      rate: null,
      label: String(pick(p, ["name"], "Server"))
    }))
    .filter((p) => p.price > 0)
    .sort((a, b) => a.price - b.price);
  return { countryId: cid, pricelist };
}

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
  const lama = WARUNGNOKOS_SERVERS.find((x) => x.id === serverId)?.lama;
  let body;
  try {
    body = await request("GET", `${path}${encodeURIComponent(trxId)}`);
  } catch (e) {
    // Pesanan yang dibuat SEBELUM pindah ke API baru hanya dikenal oleh API lamanya
    // (Server 1 → /api/otp, Server 2 → /api/smscode). 404 di sini → tanya ke jalur lama sekali.
    if (api === "warkosv3" && e?.status === 404 && lama) body = await request("GET", `/api/${lama}/status/${encodeURIComponent(trxId)}`);
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
      const lama = WARUNGNOKOS_SERVERS.find((x) => x.id === serverId)?.lama;
      if (e?.status === 404 && lama === "smscode") return request("POST", "/api/smscode/cancel", { data: { trxId } });
      if (e?.status === 404 && lama === "otp") return request("POST", "/api/otp/set_status", { data: { trxId, action_status: "cancel" } });
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
  const out = { configured: true, base: await baseUrl(), kunciV3Terpisah: !!((await cfg("WARUNGNOKOS_V3_APIKEY")) || "").trim() };
  const langkah = async (nama, fn) => {
    const t0 = Date.now();
    try { return { ok: true, ms: Date.now() - t0, ...(await fn()) }; }
    catch (err) { return { ok: false, ms: Date.now() - t0, status: err?.status || 0, jalur: err?.path || nama, error: err?.message || "gagal" }; }
  };
  // Rantai pemanggilan persis seperti alur beli: negara → layanan → produk (API baru warkosv3, dipakai Server 1 & 2).
  let negara = [];
  out.api = await langkah("/api/warkosv3/countries", async () => {
    const b = await request("GET", "/api/warkosv3/countries", { timeout: 15000 });
    negara = toList(b.data);
    return { negara: negara.length };
  });
  if (out.api.ok && negara[0]) {
    const cid = pick(negara[0], ["id"]);
    let layanan = [];
    out.layanan = await langkah("/api/warkosv3/services", async () => {
      const b = await request("GET", "/api/warkosv3/services", { params: { country_id: cid }, timeout: 15000 });
      layanan = toList(b.data);
      return { negaraUji: String(pick(negara[0], ["name"], cid)), layanan: layanan.length };
    });
    if (out.layanan.ok && layanan[0]) {
      out.produk = await langkah("/api/warkosv3/products", async () => {
        const b = await request("GET", "/api/warkosv3/products", { params: { country_id: cid, service_id: pick(layanan[0], ["id"]) }, timeout: 15000 });
        return { layananUji: String(pick(layanan[0], ["name"], "-")), produk: toList(b.data).length };
      });
    }
  }
  try {
    const body = await request("GET", "/api/user/profile");
    const d = body?.data || body;
    out.profile = { username: pick(d, ["username"], null), balance: num(pick(d, ["balance"])) };
  } catch (err) {
    out.profile = { error: err?.message || "gagal" }; // API baru tidak mendokumentasikan profil — kegagalan ini bukan masalah.
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
