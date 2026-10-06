// Autentikasi admin: satu kode rahasia, ditukar jadi SESI BERTANDA TANGAN.
//
// Yang salah sebelumnya, dan kenapa ini penting:
// cookienya berisi teks tetap "granted". httpOnly hanya menghalangi JavaScript
// di halaman membacanya — ia sama sekali tidak menghalangi siapa pun MEMASANG
// cookie itu sendiri. Satu perintah
//     curl -H "Cookie: artapedia_admin=granted" .../api/admin/withdraw
// sudah cukup untuk masuk sebagai admin, tanpa pernah tahu kode adminnya. Dan
// di balik pintu itu ada penarikan saldo: uang sungguhan, keluar.
//
// Sekarang isinya "<kedaluwarsa>.<tanda tangan>". Tanda tangannya HMAC-SHA256
// memakai rahasia yang cuma ada di server, jadi cookie buatan sendiri tidak
// akan lolos — pemalsunya harus menebak rahasianya, bukan menebak satu kata.
//
// KODE ADMIN BOLEH DARI DUA TEMPAT
//   - dasbor web: disimpan sebagai HASH scrypt (tidak bisa dibaca balik)
//   - Vercel ADMIN_CODE: tetap sah, jadi kunci cadangan kalau kode dari web lupa
// Kode bawaan di repositori hanya berlaku kalau tidak ada keduanya DAN
// konfigurasi berhasil dibaca (lihat kodeBawaanBerlaku).
//
// SEMUA pemeriksaan di sini async karena kode webnya ada di database. Fungsi
// sinkron lama (isAdminRequest, isAdminCookieStore) sengaja MELEMPAR error, tidak
// dihapus: pemanggil yang lupa `await` pada fungsi async menerima Promise, dan
// `!Promise` bernilai false — pemeriksaan admin akan LOLOS untuk siapa pun.
// Dengan melempar, pemanggil yang terlewat gagal tertutup (500), bukan terbuka.
import crypto from "crypto";
import { cfg, konfigTerbaca, bacaInternal, tulisInternal } from "@/lib/config";
import { boleh } from "@/lib/adminIzin";

export const ADMIN_COOKIE = "artapedia_admin";
const KODE_BAWAAN = "arta12123";
const KUNCI_HASH = "adminKodeHash";
export const KODE_MIN = 8;

// Umur sesi. Tertulis DI DALAM cookienya, bukan cuma di maxAge peramban:
// maxAge ditentukan peramban dan bisa diabaikan, yang di dalam tanda tangan
// tidak bisa diubah tanpa merusak tanda tangannya.
// 30 hari, dan diperpanjang otomatis selama panel dipakai (/api/admin/sesi) — admin tidak perlu memasukkan kode berulang.
const UMUR_MS = 30 * 24 * 60 * 60 * 1000;

function samaWaktuTetap(a, b) {
  const x = Buffer.from(String(a ?? ""));
  const y = Buffer.from(String(b ?? ""));
  if (x.length !== y.length) {
    // Tetap melakukan satu perbandingan supaya waktunya tidak membocorkan
    // panjang yang benar.
    crypto.timingSafeEqual(x, x);
    return false;
  }
  return crypto.timingSafeEqual(x, y);
}

export function hashKode(kode) {
  const garam = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(kode), garam, 32);
  return `scrypt$${garam.toString("base64")}$${h.toString("base64")}`;
}

function cocokHash(kode, tersimpan) {
  try {
    const [skema, garam, h] = String(tersimpan).split("$");
    if (skema !== "scrypt" || !garam || !h) return false;
    const hitung = crypto.scryptSync(String(kode ?? ""), Buffer.from(garam, "base64"), 32);
    const benar = Buffer.from(h, "base64");
    return hitung.length === benar.length && crypto.timingSafeEqual(hitung, benar);
  } catch {
    return false;
  }
}

async function hashWeb() {
  try {
    return (await bacaInternal(KUNCI_HASH)) || "";
  } catch {
    return "";
  }
}

async function kodeEnv() {
  return (await cfg("ADMIN_CODE")) || "";
}

/**
 * Kode bawaan hanya berlaku kalau: tidak ada kode dari web, tidak ada dari
 * Vercel, DAN konfigurasi berhasil dibaca. Syarat terakhir yang penting: kalau
 * database sedang tidak terjangkau, "tidak ada kode dari web" bisa jadi cuma
 * karena tidak terbaca — dan bawaan yang publik tidak boleh mendadak sah
 * tepat pada saat itu.
 */
async function kodeBawaanBerlaku() {
  if (!(await konfigTerbaca())) return false;
  return !(await hashWeb()) && !(await kodeEnv());
}

/** true kalau situs masih memakai kode bawaan yang publik. */
export async function adminCodeIsDefault() {
  return kodeBawaanBerlaku();
}

/** Status untuk panel: dari mana kode admin berasal. */
export async function statusKodeAdmin() {
  const web = !!(await hashWeb());
  const env = !!(await kodeEnv());
  return { web, env, bawaan: !web && !env && (await konfigTerbaca()) };
}

// Yang dipakai menurunkan rahasia tanda tangan: kode "utama". Mengganti kode
// otomatis membatalkan semua sesi lama — itu memang yang diinginkan.
async function identitasKodeUtama() {
  const w = await hashWeb();
  if (w) return `web:${w}`;
  const e = await kodeEnv();
  if (e) return `env:${e}`;
  return `bawaan:${KODE_BAWAAN}`;
}

async function rahasia() {
  const eksplisit = await cfg("ADMIN_SECRET");
  const dasar = eksplisit || `${await identitasKodeUtama()}:${(await cfg("CRON_SECRET")) || "artapedia"}`;
  return crypto.createHash("sha256").update(dasar).digest();
}

async function tandaTangan(payload) {
  return crypto.createHmac("sha256", await rahasia()).update(payload).digest("base64url");
}

export async function createAdminSession() {
  const kedaluwarsa = String(Date.now() + UMUR_MS);
  return `${kedaluwarsa}.${await tandaTangan(kedaluwarsa)}`;
}

/** Sesi untuk akun admin tambahan: "<kedaluwarsa>.<idAkun>.<tanda tangan>" (tanda tangan atas "<kedaluwarsa>.<idAkun>"). */
export async function createAdminSessionAkun(id) {
  const kedaluwarsa = String(Date.now() + UMUR_MS);
  const dasar = `${kedaluwarsa}.${id}`;
  return `${dasar}.${await tandaTangan(dasar)}`;
}

// Cache ringan status akun (aktif? peran?) supaya tiap permintaan admin tidak membaca database: 20 detik.
const cacheAkun = new Map();
async function statusAkun(id) {
  const c = cacheAkun.get(id);
  if (c && Date.now() - c.t < 20000) return c.v;
  let v = null;
  try {
    const { ambilAkun } = await import("@/lib/adminAkun");
    const a = await ambilAkun(id);
    v = a && a.aktif ? { peran: a.peran, id: a.id, nama: a.nama } : null;
  } catch { v = null; }
  cacheAkun.set(id, { t: Date.now(), v });
  return v;
}
export function lupakanCacheAkunAdmin() { cacheAkun.clear(); }

/** null (tidak sah) | { peran: "owner" } | { peran, id, nama } untuk akun admin tambahan. */
export async function sesiAdmin(value) {
  if (typeof value !== "string" || !value.includes(".")) return null;
  const bagian = value.split(".");
  if (bagian.length === 3) {
    const [kedaluwarsa, id, sig] = bagian;
    if (!kedaluwarsa || !id || !sig) return null;
    if (!(await konfigTerbaca())) return null;
    if (!samaWaktuTetap(sig, await tandaTangan(`${kedaluwarsa}.${id}`))) return null;
    const batas = Number(kedaluwarsa);
    if (!(Number.isFinite(batas) && Date.now() < batas)) return null;
    return statusAkun(id);
  }
  return (await verifyAdminSession(value)) ? { peran: "owner" } : null;
}

export async function verifyAdminSession(value) {
  if (typeof value !== "string" || !value.includes(".")) return false;
  const bagianSesi = value.split(".");
  if (bagianSesi.length !== 2) return false; // sesi akun tambahan (3 bagian) diperiksa lewat sesiAdmin()
  const [kedaluwarsa, sig] = bagianSesi;
  if (!kedaluwarsa || !sig) return false;

  // Konfigurasi tidak terbaca → rahasia penandatangan bisa berbeda dari yang
  // dipakai saat sesi dibuat. Ditolak, bukan dicocokkan dengan rahasia yang
  // salah; adminnya cukup mencoba lagi beberapa detik kemudian.
  if (!(await konfigTerbaca())) return false;

  if (!samaWaktuTetap(sig, await tandaTangan(kedaluwarsa))) return false;

  const batas = Number(kedaluwarsa);
  return Number.isFinite(batas) && Date.now() < batas;
}

/** Perbandingan kode admin, waktu-tetap. Sah: kode web ATAU kode Vercel ATAU (hanya bila tak ada keduanya) bawaan. */
export async function adminCodeMatches(code) {
  const masuk = String(code ?? "");
  if (!masuk) return false;
  const w = await hashWeb();
  const e = await kodeEnv();
  // Semuanya dihitung tanpa berhenti di yang pertama cocok, supaya waktunya
  // tidak membocorkan kode mana yang salah.
  const cocokWeb = w ? cocokHash(masuk, w) : false;
  const cocokEnv = e ? samaWaktuTetap(masuk, e) : false;
  const cocokBawaan = (await kodeBawaanBerlaku()) ? samaWaktuTetap(masuk, KODE_BAWAAN) : false;
  return cocokWeb || cocokEnv || cocokBawaan;
}

/** Memasang kode admin dari web. Mengembalikan { ok, alasan }. */
export async function setKodeAdminWeb(kodeBaru) {
  const k = String(kodeBaru ?? "");
  if (k.length < KODE_MIN) return { ok: false, alasan: `Kode admin minimal ${KODE_MIN} karakter.` };
  if (k.length > 128) return { ok: false, alasan: "Kode admin terlalu panjang." };
  if (k === KODE_BAWAAN) return { ok: false, alasan: "Itu kode bawaan yang ada di repositori. Pilih kode lain." };
  await tulisInternal(KUNCI_HASH, hashKode(k));
  return { ok: true };
}

/** Menghapus kode dari web (kembali ke Vercel / bawaan). */
export async function hapusKodeAdminWeb() {
  await tulisInternal(KUNCI_HASH, "");
}

/** Peran penelepon di route handler: null | { peran, id?, nama? }. */
export async function peranAdmin(req) {
  return sesiAdmin(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Dipakai di route handler (app/api/admin/**): true/false. Owner boleh semuanya; peran lain hanya jalur yang diizinkan (lib/adminIzin.js).
export async function adminSah(req) {
  const s = await peranAdmin(req);
  if (!s) return false;
  if (s.peran === "owner") return true;
  let jalur = "";
  try { jalur = req.nextUrl?.pathname || new URL(req.url).pathname; } catch { return false; }
  return boleh(s.peran, jalur, req.method);
}

// Khusus Owner (mis. kelola akun admin, konfigurasi rahasia).
export async function adminOwner(req) {
  return (await peranAdmin(req))?.peran === "owner";
}

// Dipakai di server component lewat cookies() dari next/headers (hanya "boleh membuka dasbor": peran apa pun yang sah).
export async function adminSahCookieStore(store) {
  return !!(await sesiAdmin(store.get(ADMIN_COOKIE)?.value));
}

const LAMA = "isAdminRequest / isAdminCookieStore sudah tidak ada: gunakan `await adminSah(req)` / `await adminSahCookieStore(store)`.";
export function isAdminRequest() {
  throw new Error(LAMA);
}
export function isAdminCookieStore() {
  throw new Error(LAMA);
}

// Pengaturan cookie yang sama untuk login & logout, supaya tidak ada yang
// terlewat di salah satunya.
export function adminCookieOptions(maxAge = UMUR_MS / 1000) {
  return {
    httpOnly: true,
    sameSite: "lax",
    // secure hanya di produksi: di localhost (http) cookie secure tidak pernah
    // terkirim, dan panelnya jadi tidak bisa dipakai saat pengembangan.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  };
}
